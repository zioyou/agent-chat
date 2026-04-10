import { v4 as uuidv4 } from "uuid";
import { useEffect, useRef, useState, useCallback, FormEvent, Fragment } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useRefreshStream } from "@/providers/Stream";
import { Message, Checkpoint } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { BrowserIframe } from "./BrowserIframe";
import { HumanMessage } from "./messages/human";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  XIcon,
  Plus,
  Network,
  LogOut,
  LayoutGrid,
  Bot,
  CheckCircle,
  Clock,
  Circle,
  FileIcon,
  Square,
  ArrowUp,
  Settings,
  Monitor,
} from "lucide-react";
import { FilesPopover } from "./TasksFilesSidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { getApiKey } from "@/lib/api-key";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { TodoItem } from "@/components/thread/types";
import { WorkflowGraph } from "./WorkflowGraph";
import type { WorkflowGraphData } from "./WorkflowGraph";
import { StickyToBottomContent } from "./sticky-scroll";


export function Thread() {
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
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserActive, setBrowserActive] = useState(false);

  // 그래프 캐시 상태
  const [graphCache, setGraphCache] = useState<Record<string, WorkflowGraphData>>({});
  const [graphScrollPos, setGraphScrollPos] = useState<Record<string, number>>(
    {},
  );

  const [input, setInput] = useState("");
  const [assistantInfo, setAssistantInfo] = useState<{ name: string; description: string; graph_id?: string } | null>(null);

  const refreshStream = useRefreshStream();

  // 브라우저 서비스 상태 폴링
  // useEffect(() => {
  //   if (!isBrowserOpen) return;
  //   const poll = async () => {
  //     try {
  //       const res = await fetch("http://localhost:8010/status");
  //       const data = await res.json();
  //       setBrowserActive(data.active);
  //     } catch {
  //       setBrowserActive(false);
  //     }
  //   };
  //   poll();
  //   const interval = setInterval(poll, 2000);
  //   return () => clearInterval(interval);
  // }, [isBrowserOpen]);  // 폴링은 필요시 활성화

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

  const stream = useStreamContext();
  
  // Create setFiles handler (local only for now)
  const setFiles = async (newFiles: Record<string, string>) => {
      console.log("Files updated via UI (local only):", newFiles);
      toast.info("File saving is not fully wired up to the agent backend yet.");
  };

  // Extract todos and files from stream values
  const todos: TodoItem[] = (stream as any).todos ?? (stream as any).values?.todos ?? [];
  const files = (stream as any).files ?? (stream as any).values?.files ?? {};

  // Poll for background resume: if the webhook resumes the graph in the backend,
  // the SSE listener won't know. We poll the state to refresh when done.
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stream.interrupt !== undefined && threadId && apiUrl) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${apiUrl}/threads/${threadId}/history`, {
            headers: { "X-Api-Key": getApiKey() || "" }
          });
          if (res.ok) {
            const historyData = await res.json();
            if (historyData && historyData.length > 0) {
              const stateData = historyData[0];
              // If the thread is no longer interrupted/pending, trigger soft refresh
              if (stateData.next && stateData.next.length === 0 && !stateData.tasks?.some((t: any) => t.interrupts?.length > 0)) {
                refreshStream();
              }
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [stream.interrupt, threadId, apiUrl]);

  const [artifactOpen, closeArtifact] = useArtifactOpen();
  const [artifactContext, setArtifactContext] = useArtifactContext();
  
  const showTasks = (todos.length > 0 || Object.keys(files).length > 0) && !artifactOpen;

  const messages = stream.messages;
  const isLoading = stream.isLoading;
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

    const currentMessages = stream.messages || [];

    // Inject user_secrets from localStorage
    const storedSecrets = localStorage.getItem("agent_user_secrets");
    const userSecrets = storedSecrets ? JSON.parse(storedSecrets) : {};

    const context = {
      ...(Object.keys(artifactContext).length > 0 ? artifactContext : undefined),
      user_secrets: userSecrets,
    };

    stream.submit(
      { messages: [...currentMessages, newHumanMessage], context },
      {
        streamSubgraphs: true,
        streamResumable: true,
        streamMode: ["values", "messages"],
        optimisticValues: (prev: any) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = useCallback((
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamSubgraphs: true,
      streamResumable: true,
      streamMode: ["values", "messages"],
    });
  }, [stream]);

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m: any) => m.type === "ai" || m.type === "tool",
  );

  // Ported from deep-agents-ui ChatInterface.tsx
  const [metaOpen, setMetaOpen] = useState<"tasks" | "files" | null>(null);
  const tasksContainerRef = useRef<HTMLDivElement | null>(null);

  const groupedTodos = {
    in_progress: todos.filter((t) => t.status === "in_progress"),
    pending: todos.filter((t) => t.status === "pending"),
    completed: todos.filter((t) => t.status === "completed"),
  };

  const hasTasks = todos.length > 0;
  const hasFiles = Object.keys(files).length > 0;

  const getStatusIcon = (status: TodoItem["status"], className?: string) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle
            size={16}
            className={cn("text-green-600/80", className)}
          />
        );
      case "in_progress":
        return (
          <Clock
            size={16}
            className={cn("text-amber-500/80", className)}
          />
        );
      default:
        return (
          <Circle
            size={16}
            className={cn("text-gray-400/70", className)}
          />
        );
    }
  };

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
          "grid h-full w-full transition-all duration-500",
          artifactOpen 
            ? "grid-cols-[3fr_2fr]" 
            : "grid-cols-[1fr]",
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
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 bg-white/95 backdrop-blur-sm p-2 pl-4">
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
                <SettingsDialog
                  trigger={
                    <TooltipIconButton
                      size="lg"
                      className="p-4"
                      tooltip="Settings"
                      variant="ghost"
                    >
                      <Settings className="size-5" />
                    </TooltipIconButton>
                  }
                />
                
                {/* New Chat button moved to sidebar
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="New Thread"
                  variant="ghost"
                  onClick={() => {
                    setThreadId(null);
                  }}
                >
                  <SquarePen className="size-5" />
                </TooltipIconButton>
                */}

                {/* 브라우저 화면 버튼 */}
                <TooltipIconButton
                  size="lg"
                  className="p-4"
                  tooltip="브라우저 화면"
                  variant="ghost"
                  onClick={() => setIsBrowserOpen(true)}
                >
                  <div className="relative">
                    <Monitor className="size-5" />
                    {browserActive && (
                      <span className="absolute -top-1 -right-1 size-2 rounded-full bg-green-500" />
                    )}
                  </div>
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
                  tooltip="Switch Agent"
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

          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "flex flex-col items-center justify-center",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName={cn("pt-20 pb-16 max-w-3xl mx-auto flex flex-col gap-4 w-full", !chatStarted && "h-full justify-center")}
              content={
                <>
                  {!chatStarted && assistantInfo ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center mt-[15vh]">
                      <div className="rounded-full bg-muted p-4">
                        <Bot className="size-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold">{assistantInfo.name}</h2>
                        <p className="text-sm text-muted-foreground max-w-md text-balance">
                           {assistantInfo.description}
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages
                    .filter((m: any) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    // Deduplicate messages by ID to prevent React key errors
                    .filter((message: Message, index: number, self: Message[]) =>
                      message.id
                        ? self.findIndex((m: Message) => m.id === message.id) === index
                        : true // Keep messages without IDs
                    )
                    .map((message: Message, index: number, arr: Message[]) => {
                      // 스트리밍 중 마지막 메시지에만 isLoading=true 전달 — 이전 메시지는 불필요한 re-render 방지
                      const isLastMsg = index === arr.length - 1;
                      const msgIsLoading = isLoading && isLastMsg;
                      return message.type === "human" ? (
                        <HumanMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={msgIsLoading}
                        />
                      ) : (
                        <AssistantMessage
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                          isLoading={msgIsLoading}
                          handleRegenerate={handleRegenerate}
                          threadId={threadId ?? undefined}
                        />
                      );
                    })
                  )}
                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt.
                    We need to render it outside of the messages list, since there are no messages to render */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                      threadId={threadId ?? undefined}
                    />
                  )}
                  {isLoading && !firstTokenReceived && (
                    <AssistantMessageLoading />
                  )}
                </>
              }
            />
          </StickToBottom>

          {/* Footer Moved Outside StickToBottom to fix scroll bounce */}
          <div className="flex-shrink-0 bg-background z-10">
            <div
              ref={dropRef}
              className={cn(
                "mx-4 mb-6 flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background",
                "mx-auto w-[calc(100%-32px)] max-w-[1024px] transition-colors duration-200 ease-in-out",
                dragOver && "border-primary border-2 border-dotted"
              )}
            >
              {(hasTasks || hasFiles) && (
                <div className="flex max-h-72 flex-col overflow-y-auto border-b border-border bg-sidebar empty:hidden">
                  {!metaOpen && (
                    <>
                      {(() => {
                        const activeTask = todos.find(
                          (t) => t.status === "in_progress"
                        );

                        const totalTasks = todos.length;
                        const remainingTasks =
                          totalTasks - groupedTodos.pending.length;
                        const isCompleted = todos.every((t) => t.status === "completed");

                        const tasksTrigger = (() => {
                          if (!hasTasks) return null;
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setMetaOpen((prev) =>
                                  prev === "tasks" ? null : "tasks"
                                )
                              }
                              className="grid w-full cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-3 px-[18px] py-3 text-left hover:bg-accent/50 transition-colors"
                              aria-expanded={metaOpen === "tasks"}
                            >
                              {(() => {
                                if (isCompleted) {
                                  return [
                                    <CheckCircle
                                      key="icon"
                                      size={16}
                                      className="text-green-600/80"
                                    />,
                                    <span
                                      key="label"
                                      className="ml-[1px] min-w-0 truncate text-sm"
                                    >
                                      All tasks completed
                                    </span>,
                                  ];
                                }

                                if (activeTask != null) {
                                  return [
                                    <div key="icon">
                                      {getStatusIcon(activeTask.status)}
                                    </div>,
                                    <span
                                      key="label"
                                      className="ml-[1px] min-w-0 truncate text-sm"
                                    >
                                      Task{" "}
                                      {totalTasks - groupedTodos.pending.length} of{" "}
                                      {totalTasks}
                                    </span>,
                                    <span
                                      key="content"
                                      className="min-w-0 gap-2 truncate text-sm text-muted-foreground"
                                    >
                                      {activeTask.content}
                                    </span>,
                                  ];
                                }

                                return [
                                  <Circle
                                    key="icon"
                                    size={16}
                                    className="text-gray-400/70"
                                  />,
                                  <span
                                    key="label"
                                    className="ml-[1px] min-w-0 truncate text-sm"
                                  >
                                    Task {totalTasks - groupedTodos.pending.length}{" "}
                                    of {totalTasks}
                                  </span>,
                                ];
                              })()}
                            </button>
                          );
                        })();

                        const filesTrigger = (() => {
                          if (!hasFiles) return null;
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setMetaOpen((prev) =>
                                  prev === "files" ? null : "files"
                                )
                              }
                              className="flex flex-shrink-0 cursor-pointer items-center gap-2 px-[18px] py-3 text-left text-sm hover:bg-accent/50 transition-colors"
                              aria-expanded={metaOpen === "files"}
                            >
                              <FileIcon size={16} />
                              Files (State)
                              <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
                                {Object.keys(files).length}
                              </span>
                            </button>
                          );
                        })();

                        return (
                          <div className="grid grid-cols-[1fr_auto_auto] items-center">
                            {tasksTrigger}
                            {filesTrigger}
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {metaOpen && (
                    <>
                      <div className="sticky top-0 flex items-stretch bg-sidebar text-sm">
                        {hasTasks && (
                          <button
                            type="button"
                            className={cn("py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold hover:text-foreground/80 transition-colors", metaOpen === "tasks" && "font-semibold")}
                            onClick={() =>
                              setMetaOpen((prev) =>
                                prev === "tasks" ? null : "tasks"
                              )
                            }
                            aria-expanded={metaOpen === "tasks"}
                          >
                            Tasks
                          </button>
                        )}
                        {hasFiles && (
                          <button
                            type="button"
                            className={cn("inline-flex items-center gap-2 py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold hover:text-foreground/80 transition-colors", metaOpen === "files" && "font-semibold")}
                            onClick={() =>
                              setMetaOpen((prev) =>
                                prev === "files" ? null : "files"
                              )
                            }
                            aria-expanded={metaOpen === "files"}
                          >
                            Files (State)
                            <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
                              {Object.keys(files).length}
                            </span>
                          </button>
                        )}
                        <button
                          aria-label="Close"
                          className="flex-1"
                          onClick={() => setMetaOpen(null)}
                        />
                      </div>
                      <div
                        ref={tasksContainerRef}
                        className="px-[18px]"
                      >
                        {metaOpen === "tasks" &&
                          Object.entries(groupedTodos)
                            .filter(([_, todos]) => todos.length > 0)
                            .map(([status, todos]) => (
                              <div
                                key={status}
                                className="mb-4"
                              >
                                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {
                                    {
                                      pending: "Pending",
                                      in_progress: "In Progress",
                                      completed: "Completed",
                                    }[status]
                                  }
                                </h3>
                                <div className="grid grid-cols-[auto_1fr] gap-3 rounded-sm p-1 pl-0 text-sm">
                                  {todos.map((todo, index) => (
                                    <Fragment key={`${status}_${todo.id}_${index}`}>
                                      {getStatusIcon(todo.status, "mt-0.5")}
                                      <span className="break-words text-inherit">
                                        {todo.content}
                                      </span>
                                    </Fragment>
                                  ))}
                                </div>
                              </div>
                            ))}

                        {metaOpen === "files" && (
                          <div className="mb-6">
                            <FilesPopover
                              files={files}
                              setFiles={setFiles}
                              editDisabled={
                                stream.isLoading === true || stream.interrupt !== undefined
                              }
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <form
                onSubmit={handleSubmit}
                className="flex flex-col"
              >
                <ContentBlocksPreview
                  blocks={contentBlocks}
                  onRemove={removeBlock}
                />
                <textarea
                  disabled={stream.isLoading || stream.interrupt !== undefined}
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
                  placeholder={stream.isLoading ? "Running..." : (stream.interrupt !== undefined ? "서브 에이전트 대기 중..." : "대화 내용을 입력하세요...")}
                  className="font-inherit field-sizing-content flex-1 resize-none border-0 bg-transparent px-[18px] pb-[13px] pt-[14px] text-sm leading-7 text-primary outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={1}
                />
                <div className="flex justify-between gap-2 p-3">
                  <div className="flex items-center gap-2">
                      <Label
                        htmlFor="file-input"
                        className="flex cursor-pointer items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Plus className="size-5" />
                        <span className="sr-only">Upload</span>
                      </Label>
                      <input
                        id="file-input"
                        type="file"
                        onChange={handleFileUpload}
                        multiple
                        accept="*"
                        className="hidden"
                      />
                       <div className="flex items-center space-x-2">
                          <Switch
                            id="render-tool-calls"
                            checked={hideToolCalls ?? false}
                            onCheckedChange={setHideToolCalls}
                            className="scale-75"
                          />
                          <Label
                            htmlFor="render-tool-calls"
                            className="text-xs text-muted-foreground"
                          >
                            Tools
                          </Label>
                       </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type={stream.isLoading ? "button" : "submit"}
                      variant={stream.isLoading ? "destructive" : "default"}
                      onClick={stream.isLoading ? () => stream.stop() : undefined}
                      disabled={(!stream.isLoading && (isLoading || (!input.trim() && contentBlocks.length === 0))) || stream.interrupt !== undefined}
                      size="icon"
                      className="rounded-full w-8 h-8"
                    >
                      {stream.isLoading ? (
                        <Square size={14} className="fill-current" />
                      ) : (
                        <ArrowUp size={18} />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
        
        {/* Right Artifact Panel - Conditionally rendered only when artifactOpen */}
        {artifactOpen && (
        <div
          className={cn(
            "relative flex flex-col border-l transition-all duration-300 ease-in-out w-full border-l-0" 
          )}
        >
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
        )}
      </div>

      {/* Browser View Panel */}
      <Sheet open={isBrowserOpen} onOpenChange={setIsBrowserOpen}>
        <SheetContent side="right" className="min-w-full sm:min-w-[80vw] flex flex-col">
          <SheetHeader className="border-b pb-4 shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Monitor className="size-5" />
              브라우저 화면
              <span className={cn(
                "ml-2 flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full",
                browserActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              )}>
                <span className={cn("size-1.5 rounded-full", browserActive ? "bg-green-500" : "bg-gray-400")} />
                {browserActive ? "실행 중" : "대기 중"}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden min-h-0">
            {threadId ? (
              <BrowserIframe
                threadId={threadId}
                className="w-full h-full border-0"
                style={{ height: "100%" }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                대화를 시작하면 브라우저 화면이 표시됩니다.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
