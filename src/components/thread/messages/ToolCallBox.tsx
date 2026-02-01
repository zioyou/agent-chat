"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  Loader2,
  CheckCircle,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
// import { ToolApprovalInterrupt } from "@/app/components/ToolApprovalInterrupt";

export interface ToolCallBoxProps {
  toolCall: {
    name: string;
    args: Record<string, any>;
    id: string;
    type?: string;
  };
  result?: any;
  status?: "pending" | "success" | "error" | "interrupted";
  uiComponent?: any;
  stream?: any;
  graphId?: string;
}

export const ToolCallBox = React.memo<ToolCallBoxProps>(
  ({
    toolCall,
    result,
    status: propStatus,
    uiComponent,
    stream,
    graphId,
  }) => {
    const [isExpanded, setIsExpanded] = useState(
      () => !!uiComponent
    );
    const [expandedArgs, setExpandedArgs] = useState<Record<string, boolean>>(
      {}
    );

    const { name, args, status } = useMemo(() => {
      return {
        name: toolCall.name || "Unknown Tool",
        args: toolCall.args || {},
        status: propStatus || "success",
      };
    }, [toolCall, propStatus]);

    const statusIcon = useMemo(() => {
      switch (status) {
        case "success":
          return <CheckCircle size={16} className="text-green-500" />;
        case "error":
          return (
            <AlertCircle
              size={14}
              className="text-destructive"
            />
          );
        case "pending":
          return (
            <Loader2
              size={14}
              className="animate-spin"
            />
          );
        case "interrupted":
          return (
            <StopCircle
              size={14}
              className="text-orange-500"
            />
          );
        default:
          return (
            <Terminal
              size={14}
              className="text-muted-foreground"
            />
          );
      }
    }, [status]);

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const toggleArgExpanded = useCallback((argKey: string) => {
      setExpandedArgs((prev) => ({
        ...prev,
        [argKey]: !prev[argKey],
      }));
    }, []);

    const hasContent = result || Object.keys(args).length > 0;

    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg border border-gray-200 transition-colors duration-200 hover:bg-gray-50",
          isExpanded && hasContent && "bg-gray-50"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className={cn(
            "flex w-full items-center justify-between gap-2 border-none px-3 py-2 text-left shadow-none outline-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-default cursor-pointer"
          )}
          disabled={!hasContent}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className="text-sm font-medium text-foreground">
                {name}
              </span>
            </div>
            {hasContent &&
              (isExpanded ? (
                <ChevronUp
                  size={14}
                  className="shrink-0 text-muted-foreground"
                />
              ) : (
                <ChevronDown
                  size={14}
                  className="shrink-0 text-muted-foreground"
                />
              ))}
          </div>
        </Button>

        {isExpanded && hasContent && (
          <div className="px-3 pb-3">
            {uiComponent && stream && graphId ? (
              <div className="mt-2">
                <LoadExternalComponent
                  key={uiComponent.id}
                  stream={stream}
                  message={uiComponent}
                  namespace={graphId}
                  meta={{ status, args, result: result ?? "No Result Yet" }}
                />
              </div>
            ) : (
              <>
                {Object.keys(args).length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Arguments
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(args).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-sm border border-border"
                        >
                          <button
                            onClick={() => toggleArgExpanded(key)}
                            className="flex w-full items-center justify-between bg-muted/30 p-2 text-left text-xs font-medium transition-colors hover:bg-muted/50"
                          >
                            <span className="font-mono">{key}</span>
                            {expandedArgs[key] ? (
                              <ChevronUp
                                size={12}
                                className="text-muted-foreground"
                              />
                            ) : (
                              <ChevronDown
                                size={12}
                                className="text-muted-foreground"
                              />
                            )}
                          </button>
                          {expandedArgs[key] && (
                            <div className="border-t border-border bg-muted/20 p-2">
                              <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-foreground">
                                {typeof value === "string"
                                  ? value
                                  : JSON.stringify(value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result && (
                  <div className="mt-4">
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Result
                    </h4>
                    {/* Custom Todo Renderer Injection Point */}
                    {(name === "write_todos" || name === "update_todo") && Array.isArray(result) ? (
                        <div className="space-y-2 rounded-md border border-border bg-card p-3">
                           {result.map((todo: any, idx: number) => (
                             <div key={idx} className="flex items-start gap-3">
                                <div className="mt-0.5 shrink-0">
                                {todo.status === 'completed' ? (
                                    <CheckCircle size={16} className="text-green-600/80" />
                                ) : todo.status === 'in_progress' ? (
                                     <Loader2 size={16} className="animate-spin text-amber-500/80" />
                                ) : (
                                    <div className="size-4 rounded-full border-2 border-muted" />
                                )}
                                </div>
                                <span className={cn("text-sm leading-relaxed text-foreground break-words", todo.status === 'completed' && "line-through text-muted-foreground")}>
                                    {todo.content}
                                </span>
                             </div>
                           ))}
                        </div>
                    ) : (
                        <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border bg-muted/40 p-2 font-mono text-xs leading-7 text-foreground">
                        {typeof result === "string"
                            ? result
                            : JSON.stringify(result, null, 2)}
                        </pre>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToolCallBox.displayName = "ToolCallBox";
