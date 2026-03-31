"use client";

import { useEffect, useState } from "react";
import { Loader2, Monitor } from "lucide-react";

interface BrowserIframeProps {
  threadId: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 브라우저 컨테이너 준비 여부를 폴링하다가
 * 준비되면 noVNC iframe으로 전환하는 컴포넌트.
 *
 * /browser/session/{threadId}/ready 엔드포인트를 2초마다 폴링.
 * API + noVNC 양쪽이 모두 준비된 후에만 ready:true 반환됨.
 */
export function BrowserIframe({ threadId, className, style }: BrowserIframeProps) {
  const [ready, setReady] = useState(false);

  const safeId = threadId.replace(/-/g, "");
  const vncSrc = `http://session-${safeId}.localhost:6080/vnc.html?autoconnect=true&resize=scale&show_dot_cursor=true`;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";
  const statusUrl = `${apiUrl}/browser/session/${threadId}/ready`;

  // ready 상태 폴링
  useEffect(() => {
    if (ready) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(statusUrl);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ready && !cancelled) setReady(true);
      } catch {
        // 네트워크 오류 무시, 재시도
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [statusUrl, ready]);

  if (!ready) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#0f0f0f",
          color: "#aaa",
          ...style,
        }}
      >
        <Monitor size={32} strokeWidth={1.2} style={{ opacity: 0.4 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" />
          브라우저 컨테이너 시작 중...
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={vncSrc}
      className={className}
      style={style}
      title="브라우저 화면"
    />
  );
}
