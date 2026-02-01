import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

function isComplexValue(value: any): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

export function ToolCalls({
  toolCalls,
  toolResults,
}: {
  toolCalls: AIMessage["tool_calls"];
  toolResults?: Record<string, any>;
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-rows-[1fr_auto] gap-2">
      {toolCalls.map((tc, idx) => {
        const result = toolResults?.[tc.id || ""];
        const status = result ? "success" : "pending";
        return (
          <ToolCallBox
            key={idx}
            toolCall={{
              name: tc.name,
              args: tc.args as Record<string, any>,
              id: tc.id || "",
              type: "tool_call",
            }}
            result={result}
            status={status}
          />
        );
      })}
    </div>
  );
}

import { ToolCallBox } from "./ToolCallBox";

export function ToolResult({ message }: { message: ToolMessage }) {
  let parsedContent: any;
  try {
    if (typeof message.content === "string") {
      parsedContent = JSON.parse(message.content);
    } else {
        parsedContent = message.content;
    }
  } catch {
    parsedContent = message.content;
  }
  
  // Clean up tool call id if needed, though message.tool_call_id is standard
  const toolCallId = message.tool_call_id || "unknown";

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-rows-[1fr_auto] gap-2">
       <ToolCallBox 
         toolCall={{
             name: message.name || "Tool Result",
             args: {}, // ToolResult typically doesn't have args in the message itself, primarily for result display
             id: toolCallId,
         }}
         result={parsedContent}
         status={message.status === 'error' ? 'error' : 'success'}
       />
    </div>
  );
}
