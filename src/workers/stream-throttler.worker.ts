/// <reference lib="webworker" />

// ================================================================
// 타입 정의
// ================================================================

interface FetchRequestMessage {
  type: "FETCH";
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  credentials: RequestCredentials;
}

interface AbortRequestMessage {
  type: "ABORT";
  id: string;
}

type IncomingMessage = FetchRequestMessage | AbortRequestMessage;

// ================================================================
// 상태
// ================================================================

const activeRequests = new Map<string, AbortController>();

// ================================================================
// 메시지 핸들러
// ================================================================

self.addEventListener("message", (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  if (msg.type === "FETCH") {
    handleFetch(msg);
  } else if (msg.type === "ABORT") {
    activeRequests.get(msg.id)?.abort();
    activeRequests.delete(msg.id);
  }
});

// ================================================================
// SSE 읽기 + 50ms 배치 전송
// ================================================================

async function handleFetch(msg: FetchRequestMessage): Promise<void> {
  const { id, url, method, headers, body, credentials } = msg;

  const abortController = new AbortController();
  activeRequests.set(id, abortController);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ?? undefined,
      credentials,
      signal: abortController.signal,
    });
  } catch (err) {
    activeRequests.delete(id);
    self.postMessage({
      type: "ERROR",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // 1단계: Response 메타 전송 — SDK의 ok 체크보다 먼저
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    responseHeaders[k] = v;
  });
  self.postMessage({
    type: "RESPONSE_META",
    id,
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    ok: response.ok,
  });

  // ok가 아니면 에러 body만 전달하고 종료
  if (!response.ok) {
    try {
      const errText = await response.text();
      const enc = new TextEncoder().encode(errText);
      self.postMessage({ type: "CHUNK", id, data: enc }, [enc.buffer]);
    } catch {
      /* ignore */
    }
    self.postMessage({ type: "DONE", id });
    activeRequests.delete(id);
    return;
  }

  // 2단계: SSE 스트림을 Worker에서 읽기 + 50ms 배치 전송
  const reader = response.body!.getReader();
  let pendingChunks: Uint8Array[] = [];
  let totalPending = 0;

  const flush = () => {
    if (pendingChunks.length === 0) return;
    const merged = new Uint8Array(totalPending);
    let offset = 0;
    for (const c of pendingChunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    pendingChunks = [];
    totalPending = 0;
    // Transferable로 zero-copy 전송
    self.postMessage({ type: "CHUNK", id, data: merged }, [merged.buffer]);
  };

  // 50ms마다 누적 데이터 배치 전송 — 메인스레드는 이 간격 사이에 렌더링 가능
  const batchTimer = setInterval(flush, 50);

  try {
    while (true) {
      // 이 루프가 Worker 스레드에서 돌아서 메인스레드 starvation 해소
      const { done, value } = await reader.read();
      if (done || abortController.signal.aborted) break;
      pendingChunks.push(value);
      totalPending += value.length;
    }
  } catch (err) {
    if (!(err instanceof Error && err.name === "AbortError")) {
      self.postMessage({
        type: "ERROR",
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    clearInterval(batchTimer);
    flush(); // 마지막 남은 데이터 flush
    self.postMessage({ type: "DONE", id });
    activeRequests.delete(id);
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
