import { v4 as uuidv4 } from "uuid";

// ================================================================
// 타입 정의
// ================================================================

interface PendingRequest {
  resolveResponse: (r: Response) => void;
  rejectResponse: (e: Error) => void;
  streamController: ReadableStreamDefaultController<Uint8Array> | null;
}

interface ResponseMetaMessage {
  type: "RESPONSE_META";
  id: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  ok: boolean;
}

interface ChunkMessage {
  type: "CHUNK";
  id: string;
  data: Uint8Array;
}

interface DoneMessage {
  type: "DONE";
  id: string;
}

interface ErrorMessage {
  type: "ERROR";
  id: string;
  message: string;
}

type WorkerMessage =
  | ResponseMetaMessage
  | ChunkMessage
  | DoneMessage
  | ErrorMessage;

// ================================================================
// Worker 싱글톤
// ================================================================

let workerInstance: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL("../workers/stream-throttler.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerInstance.addEventListener("message", handleWorkerMessage);
    workerInstance.addEventListener("error", handleWorkerError);
  }
  return workerInstance;
}

// ================================================================
// Worker → Main 메시지 라우팅
// ================================================================

function handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
  const msg = event.data;
  const pending = pendingRequests.get(msg.id);
  if (!pending) return;

  switch (msg.type) {
    case "RESPONSE_META": {
      // 가짜 Response 생성 — body는 Worker CHUNK를 받는 ReadableStream
      // new ReadableStream의 start()는 동기 실행 → controller가 즉시 pending에 등록됨
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          pending.streamController = controller;
        },
        cancel() {
          // SDK가 stream cancel 시 Worker에 ABORT 전파
          getWorker().postMessage({ type: "ABORT", id: msg.id });
        },
      });
      const fakeResponse = new Response(stream, {
        status: msg.status,
        statusText: msg.statusText,
        headers: new Headers(msg.headers),
      });
      pending.resolveResponse(fakeResponse);
      break;
    }

    case "CHUNK": {
      try {
        pending.streamController?.enqueue(msg.data);
      } catch {
        /* stream already closed */
      }
      break;
    }

    case "DONE": {
      try {
        pending.streamController?.close();
      } catch {
        /* ignore */
      }
      pendingRequests.delete(msg.id);
      break;
    }

    case "ERROR": {
      const err = new Error(msg.message);
      try {
        pending.streamController?.error(err);
      } catch {
        /* ignore */
      }
      pending.rejectResponse(err);
      pendingRequests.delete(msg.id);
      break;
    }
  }
}

function handleWorkerError(event: ErrorEvent): void {
  console.error("[WorkerFetch] Worker crashed:", event.message);
  workerInstance?.terminate();
  workerInstance = null;
  for (const pending of pendingRequests.values()) {
    const err = new Error("Worker crashed: " + event.message);
    pending.rejectResponse(err);
    try {
      pending.streamController?.error(err);
    } catch {
      /* ignore */
    }
  }
  pendingRequests.clear();
}

// ================================================================
// SSE 스트리밍 요청 판별
// ================================================================

function isSSEStreamRequest(url: string): boolean {
  // LangGraph SDK SSE 엔드포인트 패턴
  return (
    /\/(?:threads\/[^/]+\/)?runs\/stream$/.test(url) ||
    /\/threads\/[^/]+\/stream$/.test(url) ||
    /\/runs\/[^/]+\/stream$/.test(url)
  );
}

// ================================================================
// fetch init 직렬화 (postMessage로 Worker에 전달하기 위해)
// ================================================================

async function serializeInit(init?: RequestInit): Promise<{
  method: string;
  headers: Record<string, string>;
  body: string | null;
  credentials: RequestCredentials;
}> {
  const method = init?.method ?? "GET";
  const credentials: RequestCredentials =
    (init?.credentials as RequestCredentials) ?? "same-origin";

  const headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) {
        headers[k] = v;
      }
    } else {
      Object.assign(headers, init.headers);
    }
  }

  let body: string | null = null;
  if (init?.body != null) {
    body =
      typeof init.body === "string" ? init.body : String(init.body);
  }

  return { method, headers, body, credentials };
}

// ================================================================
// SDK에 주입할 custom fetch
// ================================================================

export async function workerFetch(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const urlStr =
    url instanceof Request
      ? url.url
      : url instanceof URL
        ? url.href
        : url;

  const resolvedInit: RequestInit | undefined =
    url instanceof Request
      ? {
          method: url.method,
          headers: url.headers,
          body: url.body,
          credentials: url.credentials,
          signal: url.signal,
          ...init,
        }
      : init;

  // SSE 스트리밍 요청이 아니면 일반 fetch 그대로 통과
  if (!isSSEStreamRequest(urlStr)) {
    return fetch(urlStr, resolvedInit);
  }

  const id = uuidv4();
  const { method, headers, body, credentials } = await serializeInit(resolvedInit);

  // 메인스레드 AbortSignal → Worker ABORT 전파
  resolvedInit?.signal?.addEventListener(
    "abort",
    () => {
      getWorker().postMessage({ type: "ABORT", id });
    },
    { once: true },
  );

  return new Promise<Response>((resolve, reject) => {
    pendingRequests.set(id, {
      resolveResponse: resolve,
      rejectResponse: reject,
      streamController: null,
    });
    getWorker().postMessage({
      type: "FETCH",
      id,
      url: urlStr,
      method,
      headers,
      body,
      credentials,
    });
  });
}

// ================================================================
// 정리 (앱 종료 시 선택적으로 호출)
// ================================================================

export function terminateWorker(): void {
  workerInstance?.terminate();
  workerInstance = null;
  pendingRequests.clear();
}
