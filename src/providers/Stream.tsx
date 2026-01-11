import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, Bot } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "./Thread";
import { toast } from "sonner";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      context?: Record<string, unknown>;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`, {
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });

    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();
  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    fetchStateHistory: true,
    onCustomEvent: (event, options) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
    onThreadId: (id) => {
      setThreadId(id);
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed graph).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Default values for the form
const DEFAULT_API_URL = "http://localhost:8002";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Use URL params with env var fallbacks
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    return storedKey || "";
  });

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Determine final values to use
  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId || envAssistantId;

  const [availableAssistants, setAvailableAssistants] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (finalApiUrl && !finalAssistantId) {
      const fetchAssistants = async () => {
        setIsFetching(true);
        try {
          const res = await fetch(`${finalApiUrl}/assistants`, {
            headers: apiKey ? { "X-Api-Key": apiKey } : {},
          });
          if (res.ok) {
            const data = await res.json();
            const assistants = data.assistants || [];
            // 시스템 에이전트(기본 에이전트)만 표시하도록 필터링 (테스트용 익명 에이전트 제외)
            const filtered = assistants.filter((a: any) => a.user_id === "system");
            setAvailableAssistants(filtered.length > 0 ? filtered : assistants);
          }
        } catch (e) {
          console.error("Failed to fetch assistants:", e);
        } finally {
          setIsFetching(false);
        }
      };
      fetchAssistants();
    }
  }, [finalApiUrl, finalAssistantId, apiKey]);

  // Case 2: API URL is set but Assistant ID is not -> Show selection list
  if (finalApiUrl && !finalAssistantId) {
    return (
      <div className="bg-background flex min-h-screen w-full flex-col items-center p-4 pt-20">
        <div className="w-full max-w-4xl space-y-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="from-indigo-500 to-purple-500 rounded-2xl bg-gradient-to-br p-3 shadow-lg">
              <Bot className="size-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">에이전트 선택</h1>
              <p className="text-muted-foreground text-lg">
                사용하실 대화 상대를 선택해주세요. 각 에이전트는 서로 다른 전문 분야를 가지고 있습니다.
              </p>
            </div>
          </div>

          {isFetching ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="text-muted-foreground animate-pulse">사용 가능한 에이전트 목록을 불러오는 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableAssistants.map((assistant) => (
                <button
                  key={assistant.assistant_id}
                  onClick={() => setAssistantId(assistant.assistant_id)}
                  className="group hover:border-primary border-muted bg-card relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all hover:shadow-xl active:scale-95"
                >
                  <div className="from-muted to-background flex size-12 items-center justify-center rounded-xl bg-gradient-to-br transition-colors group-hover:from-indigo-50 group-hover:to-white">
                    <ArrowRight className="text-muted-foreground group-hover:text-primary size-6 transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold leading-none tracking-tight">
                      {assistant.name || assistant.assistant_id}
                    </h3>
                    <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                      {assistant.description || "이 에이전트에 대한 설명이 없습니다."}
                    </p>
                  </div>
                  <div className="mt-auto flex w-full items-center justify-between pt-4">
                    <span className="text-primary/70 group-hover:text-primary text-xs font-semibold tracking-wider uppercase">
                      선택하기
                    </span>
                    <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-mono">
                      {assistant.graph_id}
                    </code>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-12 flex justify-center pt-8">
            <Button
              variant="ghost"
              onClick={() => {
                setApiUrl(null);
                setAssistantId(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              어시스턴트 서버 주소 변경하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Case 1: No API URL -> Show initial setup form
  if (!finalApiUrl) {
    return (
      <div className="bg-background flex min-h-screen w-full items-center justify-center p-4">
        <div className="animate-in fade-in-0 zoom-in-95 bg-card flex w-full max-w-md flex-col overflow-hidden rounded-3xl border shadow-2xl">
          <div className="from-indigo-600 to-purple-600 flex flex-col items-center gap-4 bg-gradient-to-br p-10 text-white">
            <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
              <Bot className="size-10 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">에이전트 서버 연결</h1>
              <p className="mt-2 text-indigo-100/80">어시스턴트 서버의 주소를 입력해 주세요.</p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              setApiUrl(formData.get("apiUrl") as string);
              setApiKey(formData.get("apiKey") as string);
            }}
            className="flex flex-col gap-6 p-8"
          >
            <div className="space-y-2">
              <Label htmlFor="apiUrl" className="text-sm font-semibold">서버 주소 (API URL)</Label>
              <Input
                id="apiUrl"
                name="apiUrl"
                placeholder="http://localhost:8000"
                defaultValue={apiUrl || DEFAULT_API_URL}
                className="h-12 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-sm font-semibold">API Key (선택사항)</Label>
              <PasswordInput
                id="apiKey"
                name="apiKey"
                placeholder="접근 토큰 입력..."
                defaultValue={apiKey}
                className="h-12 rounded-xl"
              />
            </div>
            <Button type="submit" size="lg" className="from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 mt-4 h-12 rounded-xl bg-gradient-to-r text-white shadow-lg transition-all active:scale-95">
              접속하기
              <ArrowRight className="ml-2 size-5" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StreamSession
      apiKey={apiKey}
      apiUrl={apiUrl}
      assistantId={assistantId}
    >
      {children}
    </StreamSession>
  );
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
