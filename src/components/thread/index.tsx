import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  XIcon,
  Plus,
  Network,
  Wrench,
  LogOut,
  LayoutGrid,
  Bot,
  CodeXml,
  Terminal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { getApiKey } from "@/lib/api-key";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { GitHubSVG } from "../icons/github";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function WorkflowGraph({
  apiUrl,
  assistantId,
  cachedData,
  onDataFetched,
  initialScrollPos,
  onScroll,
}: {
  apiUrl: string;
  assistantId: string;
  cachedData: {
    imgUrl: string | null;
    tools: { name: string; description: string }[];
    functions: { name: string; description: string }[];
    subagents: { name: string; description: string }[];
  } | null;
  onDataFetched: (data: {
    imgUrl: string | null;
    tools: { name: string; description: string }[];
    functions: { name: string; description: string }[];
    subagents: { name: string; description: string }[];
  }) => void;
  initialScrollPos: number;
  onScroll: (pos: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (cachedData) return;

    async function fetchData() {
      setLoading(true);
      try {
        const apiKey = getApiKey();
        const headers = apiKey ? { "X-Api-Key": apiKey } : {};

        let fetchedTools: { name: string; description: string }[] = [];
        let fetchedFunctions: { name: string; description: string }[] = [];
        let fetchedSubagents: { name: string; description: string }[] = [];
        let fetchedImgUrl: string | null = null;

        // 1. 그래프 정보 가져오기 (JSON)
        const graphRes = await fetch(
          `${apiUrl}/assistants/${assistantId}/graph`,
          {
            headers,
          },
        );
        if (graphRes.ok) {
          const graphData = await graphRes.json();
          fetchedTools = graphData.tools || [];
          fetchedFunctions = graphData.functions || [];
          fetchedSubagents = graphData.subagents || [];
        }

        // 2. 이미지 가져오기 (Blob)
        const imgRes = await fetch(
          `${apiUrl}/assistants/${assistantId}/graph/image`,
          {
            headers,
          },
        );
        if (!imgRes.ok) throw new Error("Failed to fetch graph image");
        const blob = await imgRes.blob();
        fetchedImgUrl = URL.createObjectURL(blob);

        onDataFetched({
          imgUrl: fetchedImgUrl,
          tools: fetchedTools,
          functions: fetchedFunctions,
          subagents: fetchedSubagents,
        });
      } catch (err) {
        console.error(err);
        toast.error("그래프 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [apiUrl, assistantId, cachedData, onDataFetched]);

  // 스크롤 복원 및 저장 로직
  useEffect(() => {
    if (!loading && containerRef.current) {
      containerRef.current.scrollTop = initialScrollPos;
    }
  }, [loading, initialScrollPos]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll(e.currentTarget.scrollTop);
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-gray-400" />
      </div>
    );

  const imgUrl = cachedData?.imgUrl;
  const tools = cachedData?.tools ?? [];
  const functions = cachedData?.functions ?? [];
  const subagents = cachedData?.subagents ?? [];

  if (!imgUrl)
    return (
      <div className="p-8 text-center text-gray-500">
        워크플로우 이미지를 로드할 수 없습니다.
      </div>
    );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex h-full flex-col items-center overflow-y-auto p-4 pb-20"
    >
      <img
        src={imgUrl}
        alt="Workflow Graph"
        className="max-w-none rounded-lg border shadow-sm"
      />

      {/* Graph Legend */}
      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div className="flex items-start gap-4">
          <div className="mt-3 h-0.5 w-10 shrink-0 bg-gray-400" />
          <div>
            <p className="text-[15px] font-bold text-gray-900">실선 (Solid Line)</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              확정 경로: 화살표를 따라 정해진 다음 단계로 즉시 이동합니다.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <div className="mt-3 h-0.5 w-10 shrink-0 border-t-2 border-dashed border-gray-400" />
          <div>
            <p className="text-[15px] font-bold text-gray-900">점선 (Dashed Line)</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              조건부 경로: AI가 대화 맥락을 기반으로 다음 경로를 스스로 판단합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 w-full max-w-2xl space-y-10">
        {/* Available Tools */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-500 text-lg">
              🛠️
            </div>
            <h3 className="text-sm font-bold text-gray-900">도구 (Tools)</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tools.length > 0 ? (
              tools.map((tool: any) => (
                <div
                  key={tool.name}
                  className="group relative flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-500">
                    <Wrench className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{tool.name}</h4>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                      {tool.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="col-span-full py-4 text-center text-sm italic text-gray-400">
                노드가 존재하지 않습니다.
              </p>
            )}
          </div>
        </section>

        {/* Functions */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-500">
              <CodeXml className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">함수 (Functions)</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {functions.length > 0 ? (
              functions.map((fn: any) => (
                <div
                  key={fn.name}
                  className="group relative flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-amber-200 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors group-hover:bg-amber-50 group-hover:text-amber-500">
                    <CodeXml className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{fn.name}</h4>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                      {fn.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="col-span-full py-4 text-center text-sm italic text-gray-400">
                노드가 존재하지 않습니다.
              </p>
            )}
          </div>
        </section>

        {/* Sub-agents */}
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-500 text-lg">
              🤖
            </div>
            <h3 className="text-sm font-bold text-gray-900">서브 에이전트 (Sub-agents)</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {subagents.length > 0 ? (
              subagents.map((agent: any) => (
                <div
                  key={agent.name}
                  className="group relative flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-emerald-200 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-500">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{agent.name}</h4>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                      {agent.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="col-span-full py-4 text-center text-sm italic text-gray-400">
                노드가 존재하지 않습니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function Thread() {
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [apiUrl, setApiUrl] = useQueryState("apiUrl");
  const [assistantId, setAssistantId] = useQueryState("assistantId");
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  // 그래프 캐시 상태
  const [graphCache, setGraphCache] = useState<Record<
    string,
    {
      imgUrl: string | null;
      tools: { name: string; description: string }[];
      functions: { name: string; description: string }[];
      subagents: { name: string; description: string }[];
    }
  >>({});
  const [graphScrollPos, setGraphScrollPos] = useState<Record<string, number>>(
    {},
  );

  const [input, setInput] = useState("");
  const [assistantInfo, setAssistantInfo] = useState<{ name: string; description: string; graph_id?: string } | null>(null);

  // 어시스턴트 정보 조회
  useEffect(() => {
    if (apiUrl && assistantId) {
      const fetchInfo = async () => {
        try {
          const res = await fetch(`${apiUrl}/assistants/${assistantId}`);
          if (res.ok) {
            const data = await res.json();
            setAssistantInfo({
              name: data.name || assistantId,
              description: data.description || "",
              graph_id: data.graph_id
            });
          }
        } catch (e) {
          console.error("Failed to fetch assistant info:", e);
        }
      };
      fetchInfo();
    }
  }, [apiUrl, assistantId]);
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
  };

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
      streamSubgraphs: true,
      streamResumable: true,
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-white"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <ThreadHistory />
          </div>
        </motion.div>
      </div>

      <div
        className={cn(
          "grid w-full grid-cols-[1fr_0fr] transition-all duration-500",
          artifactOpen && "grid-cols-[3fr_2fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-2 pl-4">
              <div>
                {(!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-5" />
                    ) : (
                      <PanelRightClose className="size-5" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4 pr-2">
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="Workflow graph"
                  variant="ghost"
                  onClick={() => setIsGraphOpen(true)}
                >
                  <Network className="size-5" />
                </TooltipIconButton>

                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="에이전트 변경"
                  variant="ghost"
                  onClick={() => {
                    setAssistantId(null);
                    setThreadId(null);
                  }}
                >
                  <LayoutGrid className="size-5" />
                </TooltipIconButton>

                <TooltipIconButton
                  size="lg"
                  className="p-4 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                  tooltip="Exit and Reset"
                  variant="ghost"
                  onClick={() => {
                    setApiUrl(null);
                    setAssistantId(null);
                    setThreadId(null);
                  }}
                >
                  <LogOut className="size-5" />
                </TooltipIconButton>
              </div>
            </div>
          )}
          {chatStarted && (
            <div className="relative z-10 flex items-center justify-between gap-3 p-2">
              <div className="relative flex items-center justify-start gap-2">
                <div className="absolute left-0 z-10">
                  {(!chatHistoryOpen || !isLargeScreen) && (
                    <Button
                      className="hover:bg-gray-100"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      {chatHistoryOpen ? (
                        <PanelRightOpen className="size-5" />
                      ) : (
                        <PanelRightClose className="size-5" />
                      )}
                    </Button>
                  )}
                </div>
                <motion.button
                  className="flex cursor-pointer items-center gap-2"
                  onClick={() => setThreadId(null)}
                  animate={{
                    marginLeft: !chatHistoryOpen ? 48 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold tracking-tight text-gray-900 leading-none">
                        {assistantInfo?.name || assistantId}
                      </span>
                      {assistantInfo?.graph_id && (
                        <code className="bg-muted text-muted-foreground rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-mono leading-none">
                          {assistantInfo.graph_id}
                        </code>
                      )}
                    </div>
                  </div>
                </motion.button>
              </div>

              <div className="flex items-center gap-4 pr-2">
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="New thread"
                  variant="ghost"
                  onClick={() => setThreadId(null)}
                >
                  <Plus className="size-5" />
                </TooltipIconButton>

                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="Workflow graph"
                  variant="ghost"
                  onClick={() => setIsGraphOpen(true)}
                >
                  <Network className="size-5" />
                </TooltipIconButton>

                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="에이전트 변경"
                  variant="ghost"
                  onClick={() => {
                    setAssistantId(null);
                    setThreadId(null);
                  }}
                >
                  <LayoutGrid className="size-5" />
                </TooltipIconButton>

                <TooltipIconButton
                  size="lg"
                  className="p-4 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                  tooltip="Exit and Reset"
                  variant="ghost"
                  onClick={() => {
                    setApiUrl(null);
                    setAssistantId(null);
                    setThreadId(null);
                  }}
                >
                  <LogOut className="size-5" />
                </TooltipIconButton>
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "mt-[25vh] flex flex-col items-stretch",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName="pt-8 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full"
              content={
                <>
                  {messages
                    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    // Deduplicate messages by ID to prevent React key errors
                    .filter((message, index, self) =>
                      message.id
                        ? self.findIndex(m => m.id === message.id) === index
                        : true // Keep messages without IDs
                    )
                    .map((message, index) =>
                      message.type === "human" ? (
                        <HumanMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                        />
                      ) : (
                        <AssistantMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={isLoading}
                          handleRegenerate={handleRegenerate}
                        />
                      ),
                    )}
                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt.
                    We need to render it outside of the messages list, since there are no messages to render */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                    />
                  )}
                  {isLoading && !firstTokenReceived && (
                    <AssistantMessageLoading />
                  )}
                </>
              }
              footer={
                <div className="sticky bottom-0 flex flex-col items-center gap-8 bg-white">
                  {!chatStarted && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">
                          {assistantInfo?.name || assistantId}
                        </h1>
                        {assistantInfo?.graph_id && (
                          <code className="bg-muted text-muted-foreground rounded-full border border-gray-200 px-3 py-1 text-xs font-mono">
                            {assistantInfo.graph_id}
                          </code>
                        )}
                      </div>
                      {assistantInfo?.description && (
                        <p className="text-muted-foreground max-w-lg text-center text-sm font-medium leading-relaxed">
                          {assistantInfo.description}
                        </p>
                      )}
                    </div>
                  )}

                  <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                  <div
                    ref={dropRef}
                    className={cn(
                      "bg-muted relative z-10 mx-auto mb-8 w-full max-w-3xl rounded-2xl shadow-xs transition-all",
                      dragOver
                        ? "border-primary border-2 border-dotted"
                        : "border border-solid",
                    )}
                  >
                    <form
                      onSubmit={handleSubmit}
                      className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2"
                    >
                      <ContentBlocksPreview
                        blocks={contentBlocks}
                        onRemove={removeBlock}
                      />
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.metaKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            const el = e.target as HTMLElement | undefined;
                            const form = el?.closest("form");
                            form?.requestSubmit();
                          }
                        }}
                        placeholder="대화 내용을 입력하세요..."
                        className="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
                      />

                      <div className="flex items-center gap-6 p-2 pt-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="render-tool-calls"
                              checked={hideToolCalls ?? false}
                              onCheckedChange={setHideToolCalls}
                            />
                            <Label
                              htmlFor="render-tool-calls"
                              className="text-sm text-gray-600"
                            >
                              도구 숨기기
                            </Label>
                          </div>
                        </div>
                        <Label
                          htmlFor="file-input"
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Plus className="size-5 text-gray-600" />
                          <span className="text-sm text-gray-600">
                            파일 업로드
                          </span>
                        </Label>
                        <input
                          id="file-input"
                          type="file"
                          onChange={handleFileUpload}
                          multiple
                          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                          className="hidden"
                        />
                        {stream.isLoading ? (
                          <Button
                            key="stop"
                            onClick={() => stream.stop()}
                            className="ml-auto"
                          >
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Cancel
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            className="ml-auto shadow-md transition-all"
                            disabled={
                              isLoading ||
                              (!input.trim() && contentBlocks.length === 0)
                            }
                          >
                            보내기
                          </Button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              }
            />
          </StickToBottom>
        </motion.div>
        <div className="relative flex flex-col border-l">
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <ArtifactTitle className="truncate overflow-hidden" />
              <button
                onClick={closeArtifact}
                className="cursor-pointer"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <ArtifactContent className="relative flex-grow" />
          </div>
        </div>
      </div>

      <Sheet
        open={isGraphOpen}
        onOpenChange={setIsGraphOpen}
      >
        <SheetContent
          side="right"
          className="min-w-full sm:min-w-[80vw]"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Network className="size-5" />
              워크플로우 흐름도
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {apiUrl && assistantId ? (
              <WorkflowGraph
                apiUrl={apiUrl}
                assistantId={assistantId}
                cachedData={graphCache[assistantId] || null}
                onDataFetched={(data) => {
                  setGraphCache((prev) => ({ ...prev, [assistantId]: data }));
                }}
                initialScrollPos={graphScrollPos[assistantId] || 0}
                onScroll={(pos) => {
                  setGraphScrollPos((prev) => ({
                    ...prev,
                    [assistantId]: pos,
                  }));
                }}
              />
            ) : (
              <div className="p-8 text-center text-gray-500">
                에이전트 정보를 찾을 수 없습니다.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
