"use client";

import "./markdown-styles.css";
import React from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import { useCallback, useRef, useState, FC, memo } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { SyntaxHighlighter } from "@/components/thread/syntax-highlighter";

import { TooltipIconButton } from "@/components/thread/tooltip-icon-button";
import { cn } from "@/lib/utils";
import { AgentListTiles, AgentInfo } from "./AgentListTiles";

import "katex/dist/katex.min.css";

// ============================================================
// Resizable Table: standalone `th` with inline drag handle
// ============================================================
function ResizableTh({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const dragging = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!thRef.current) return;
    const startWidth = thRef.current.offsetWidth;
    dragging.current = { startX: e.clientX, startWidth };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !thRef.current) return;
    const delta = e.clientX - dragging.current.startX;
    const newWidth = Math.max(60, dragging.current.startWidth + delta);
    thRef.current.style.width = `${newWidth}px`;
    thRef.current.style.minWidth = `${newWidth}px`;
    thRef.current.style.maxWidth = `${newWidth}px`;
  };

  const onPointerUp = () => {
    dragging.current = null;
  };

  return (
    <th
      ref={thRef}
      className={cn(
        "group relative select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/80",
        "whitespace-nowrap overflow-hidden text-ellipsis",
        "[&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      style={{ position: "relative" }}
      {...props}
    >
      {children}
      {/* Resize handle: wide invisible hit area, thin visible bar */}
      <div
        className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-stretch justify-center [th:last-child_&]:hidden"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="w-0.5 h-full opacity-0 group-hover:opacity-40 hover:!opacity-100 active:!opacity-100 bg-primary transition-opacity" />
      </div>
    </th>
  );
}


interface CodeHeaderProps {
  language?: string;
  code: string;
}

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-t-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
      <span className="lowercase [&>span]:text-xs">{language}</span>
      <TooltipIconButton
        tooltip="Copy"
        onClick={onCopy}
      >
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

const defaultComponents: any = {
  h1: ({ className, ...props }: { className?: string }) => (
    <h1
      className={cn(
        "mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: { className?: string }) => (
    <h2
      className={cn(
        "mt-8 mb-4 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: { className?: string }) => (
    <h3
      className={cn(
        "mt-6 mb-4 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }: { className?: string }) => (
    <h4
      className={cn(
        "mt-6 mb-4 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }: { className?: string }) => (
    <h5
      className={cn(
        "my-4 text-lg font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }: { className?: string }) => (
    <h6
      className={cn("my-4 font-semibold first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  p: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    // If paragraph contains raw <agent-list-data> text, catch it here and swap.
    const textContent = String(children);
    if (textContent.includes("<agent-list-data>")) {
      try {
        const jsonMatch = textContent.match(/<agent-list-data>([\s\S]*?)<\/agent-list-data>/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[1].trim());
          if (parsedData.type === "agent_list" && Array.isArray(parsedData.agents)) {
            return <AgentListTiles agents={parsedData.agents as AgentInfo[]} />;
          }
        }
      } catch (e) {
        // Fallback to streaming block if not fully formed
        return <div className="animate-pulse space-y-4 my-6 opacity-50"><div className="h-24 bg-muted rounded-2xl w-full max-w-sm"></div></div>;
      }
    }

    return (
      <p
        className={cn("mt-5 mb-5 leading-7 first:mt-0 last:mb-0", className)}
        {...props}
      >
        {children}
      </p>
    );
  },
  a: ({ className, ...props }: { className?: string }) => (
    <a
      className={cn(
        "text-primary font-medium underline underline-offset-4",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }: { className?: string }) => (
    <blockquote
      className={cn("border-l-2 pl-6 italic", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: { className?: string }) => (
    <ul
      className={cn("my-5 ml-6 list-disc [&>li]:mt-2", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: { className?: string }) => (
    <ol
      className={cn("my-5 ml-6 list-decimal [&>li]:mt-2", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }: { className?: string }) => (
    <hr
      className={cn("my-5 border-b", className)}
      {...props}
    />
  ),
  table: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
    <div className="my-6 overflow-hidden rounded-xl border border-border/50 shadow-sm">
      <div className="overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
      </div>
    </div>
  ),
  thead: ({ className, ...props }: { className?: string }) => (
    <thead
      className={cn("border-b border-border/50 bg-muted/60 backdrop-blur-sm", className)}
      {...props}
    />
  ),
  tbody: ({ className, ...props }: { className?: string }) => (
    <tbody
      className={cn("divide-y divide-border/30", className)}
      {...props}
    />
  ),
  th: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => (
    <ResizableTh className={className} {...props}>{children}</ResizableTh>
  ),
  td: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => (
    <td
      className={cn(
        "px-4 py-3 text-sm leading-relaxed text-foreground/90 transition-colors overflow-hidden max-w-0",
        "[&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    >
      <div className="overflow-hidden">{children}</div>
    </td>
  ),
  tr: ({ className, ...props }: { className?: string }) => (
    <tr
      className={cn(
        "transition-colors hover:bg-primary/5",
        "odd:bg-background even:bg-muted/20",
        className,
      )}
      {...props}
    />
  ),
  img: ({ src, alt }: { src?: string; alt?: string }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";
    const fixedSrc = src?.startsWith("/static/") ? `${apiUrl}${src}` : src;
    return (
      <img
        src={fixedSrc}
        alt={alt || ""}
        className="max-w-full rounded-lg my-4 shadow-md"
        loading="lazy"
      />
    );
  },
  sup: ({ className, ...props }: { className?: string }) => (
    <sup
      className={cn("[&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }: { className?: string }) => (
    <pre
      className={cn(
        "max-w-4xl overflow-x-auto rounded-lg bg-black text-white",
        className,
      )}
      {...props}
    />
  ),
  code: ({
    className,
    children,
    ...props
  }: {
    className?: string;
    children: React.ReactNode;
  }) => {
    const match = /language-(\w+)/.exec(className || "");

    if (match) {
      const language = match[1];
      const code = String(children).replace(/\n$/, "");

      // Some LLMs might wrap the custom HTML tag inside an `xml` or `html` code block
      if ((language === "xml" || language === "html" || language === "json") && code.includes("<agent-list-data>")) {
        try {
          // Extract the JSON payload from inside the XML tags
          const jsonMatch = code.match(/<agent-list-data>([\s\S]*?)<\/agent-list-data>/);
          const rawJsonStr = jsonMatch ? jsonMatch[1].trim() : code.trim();
          const parsedData = JSON.parse(rawJsonStr);
          if (parsedData.type === "agent_list" && Array.isArray(parsedData.agents)) {
            return <AgentListTiles agents={parsedData.agents as AgentInfo[]} />;
          }
        } catch (e) {
          // Fallback to normal rendering if parsing fails or stream is incomplete
          if (code.includes('"type"')) { // Likely still streaming JSON
            return <div className="animate-pulse space-y-4 my-6 opacity-50">
              <div className="h-24 bg-muted rounded-2xl w-full max-w-sm"></div>
            </div>;
          }
        }
      }

      return (
        <>
          <CodeHeader
            language={language}
            code={code}
          />
          <SyntaxHighlighter
            language={language}
            className={className}
          >
            {code}
          </SyntaxHighlighter>
        </>
      );
    }

    return (
      <code
        className={cn("rounded font-semibold", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  "agent-list-data": ({ children }: { children: React.ReactNode }) => {
    try {
      const code = String(children).trim();
      if (!code) return null; // Wait for stream
      
      const parsedData = JSON.parse(code);
      if (parsedData.type === "agent_list" && Array.isArray(parsedData.agents)) {
        return <AgentListTiles agents={parsedData.agents as AgentInfo[]} />;
      }
    } catch (e) {
      // Stream in progress: return a loading state or nothing instead of throwing
      return <div className="animate-pulse space-y-4 my-6 opacity-50">
        <div className="h-24 bg-muted rounded-2xl w-full max-w-sm"></div>
      </div>;
    }
    return null;
  },
};

// ReactMarkdown을 별도 memo 컴포넌트로 분리 — content가 같으면 파싱 자체를 건너뜀
const MemoizedReactMarkdown = memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex, rehypeRaw]}
    components={defaultComponents}
  >
    {content}
  </ReactMarkdown>
));
MemoizedReactMarkdown.displayName = "MemoizedReactMarkdown";

const MarkdownTextImpl: FC<{ children: string }> = ({ children }) => {
  return (
    <div className="markdown-content">
      <MemoizedReactMarkdown content={children} />
    </div>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);
