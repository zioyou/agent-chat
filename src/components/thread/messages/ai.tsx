import { parsePartialJson } from "@langchain/core/output_parsers";
import { useState } from "react";
import { SubAgentIndicator } from "../SubAgentIndicator";
import { SubAgent } from "../types";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { MessageContentComplex } from "@langchain/core/messages";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

  return toolCallContents.map((tc) => {
    const toolCall = tc as Record<string, any>;
    let json: Record<string, any> = {};
    if (toolCall?.input) {
      try {
        json = parsePartialJson(toolCall.input) ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: toolCall.name ?? "",
      id: toolCall.id ?? "",
      args: json,
      type: "tool_call",
    };
  });
}

interface InterruptProps {
  interrupt?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interrupt,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  const fallbackValue = Array.isArray(interrupt)
    ? (interrupt as Record<string, any>[])
    : (((interrupt as { value?: unknown } | undefined)?.value ??
      interrupt) as Record<string, any>);

  return (
    <>
      {isAgentInboxInterruptSchema(interrupt) &&
        (isLastMessage || hasNoAIOrToolMessages) && (
          <ThreadView interrupt={interrupt} />
        )}
      {interrupt &&
        !isAgentInboxInterruptSchema(interrupt) &&
        (isLastMessage || hasNoAIOrToolMessages) ? (
        <GenericInterruptView interrupt={fallbackValue} />
      ) : null}
    </>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );

  const thread = useStreamContext();
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = Array.isArray(content)
    ? parseAnthropicStreamedToolCalls(content)
    : undefined;

  const hasToolCalls =
    message &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;
  const toolCallsHaveContents =
    hasToolCalls &&
    message.tool_calls?.some(
      (tc) => tc.args && Object.keys(tc.args).length > 0,
    );
  const hasAnthropicToolCalls = !!anthropicStreamedToolCalls?.length;
  const isToolResult = message?.type === "tool";

  // Collect tool results from the thread
  const toolResultsMap: Record<string, any> = {};
  if (hasToolCalls) {
    message.tool_calls?.forEach((tc) => {
      if (!tc.id) return;
      const toolMessage = thread.messages.find(
        (m) => m.type === "tool" && (m as any).tool_call_id === tc.id
      );
      if (toolMessage) {
         let parsedContent = toolMessage.content;
         try {
            if (typeof toolMessage.content === "string") {
                const parsed = JSON.parse(toolMessage.content);
                parsedContent = parsed;
            }
         } catch {}
         toolResultsMap[tc.id] = parsedContent;
      }
    });
  }

  // Hide standalone ToolMessages because they are now rendered inside the AI Message
  if (isToolResult) {
    return null;
  }

  // Extract SubAgents
  const toolCalls = (message as AIMessage)?.tool_calls || [];
  const subAgents = toolCalls
    .filter((tc: any) => tc.name === "task" && tc.args["subagent_type"])
    .map((tc: any) => ({
      id: tc.id || "",
      name: tc.name,
      subAgentName: tc.args["subagent_type"],
      input: tc.args,
      output: toolResultsMap[tc.id || ""] ? { result: toolResultsMap[tc.id || ""] } : undefined,
      status: "completed",
    })) as SubAgent[] || [];

  // Filter out task tool calls from regular display
  const regularToolCalls = toolCalls.filter((tc: any) => tc.name !== "task") || [];

  const [expandedSubAgents, setExpandedSubAgents] = useState<Record<string, boolean>>({});
  const toggleSubAgent = (id: string) => {
    setExpandedSubAgents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const { values } = thread;
  const customComponents = values.ui?.filter(
    (ui: any) => ui.metadata?.message_id === message?.id,
  );
  const hasCustomComponents = customComponents && customComponents.length > 0;

  const hasVisibleContent =
    contentString.length > 0 ||
    subAgents.length > 0 ||
    (!hideToolCalls && (hasToolCalls || hasAnthropicToolCalls)) ||
    hasCustomComponents ||
    (isLastMessage && threadInterrupt);

  if (!hasVisibleContent) return null;

  return (
    <div className="group mr-auto flex w-full items-start gap-2">
      <div className="flex w-full flex-col gap-2">
        {/* Helper for text content */}
        {contentString.length > 0 && (
          <div className="py-1">
            <MarkdownText>{contentString}</MarkdownText>
          </div>
        )}

        {/* SubAgents Display */}
        {subAgents.length > 0 && (
          <div className="flex w-fit max-w-full flex-col gap-4 my-2">
            {subAgents.map((subAgent) => (
              <div key={subAgent.id} className="flex w-full flex-col gap-2">
                 <div className="w-[calc(100%-20px)]">
                    <SubAgentIndicator
                      subAgent={subAgent}
                      onClick={() => toggleSubAgent(subAgent.id)}
                      isExpanded={expandedSubAgents[subAgent.id] ?? true}
                    />
                 </div>
                 {(expandedSubAgents[subAgent.id] ?? true) && (
                    <div className="w-full max-w-full pl-4">
                      <div className="bg-muted/30 rounded-md border border-border/50 p-4">
                        <h4 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
                          Input
                        </h4>
                        <div className="mb-4 text-xs">
                          <MarkdownText>{JSON.stringify(subAgent.input, null, 2)}</MarkdownText>
                        </div>
                        {subAgent.output && (
                          <>
                            <h4 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
                              Output
                            </h4>
                             <div className="text-xs">
                                <MarkdownText>{typeof subAgent.output.result === 'string' ? subAgent.output.result : JSON.stringify(subAgent.output.result, null, 2)}</MarkdownText>
                             </div>
                          </>
                        )}
                      </div>
                    </div>
                 )}
              </div>
            ))}
          </div>
        )}

        {!hideToolCalls && (
          <>
            {(hasToolCalls && toolCallsHaveContents && (
              <ToolCalls toolCalls={regularToolCalls} toolResults={toolResultsMap} />
            )) ||
              (hasAnthropicToolCalls && (
                <ToolCalls toolCalls={anthropicStreamedToolCalls} />
              )) ||
              (hasToolCalls && (
                <ToolCalls toolCalls={regularToolCalls} toolResults={toolResultsMap} />
              ))}
          </>
        )}

        {message && (
          <CustomComponent
            message={message}
            thread={thread}
          />
        )}
        <Interrupt
          interrupt={threadInterrupt}
          isLastMessage={isLastMessage}
          hasNoAIOrToolMessages={hasNoAIOrToolMessages}
        />
        <div
          className={cn(
            "mr-auto flex items-center gap-2 transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <BranchSwitcher
            branch={meta?.branch}
            branchOptions={meta?.branchOptions}
            onSelect={(branch) => thread.setBranch(branch)}
            isLoading={isLoading}
          />
          {contentString.length > 0 && (
            <CommandBar
              content={contentString}
              isLoading={isLoading}
              isAiMessage={true}
              handleRegenerate={() => handleRegenerate(parentCheckpoint)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="mr-auto flex items-start gap-2">
      <div className="bg-muted flex h-8 items-center gap-1 rounded-2xl px-4 py-2">
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
      </div>
    </div>
  );
}
