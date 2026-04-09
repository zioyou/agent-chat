import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Wrench, CodeXml, Bot } from "lucide-react";
import { getApiKey } from "@/lib/api-key";
import { toast } from "sonner";

export interface WorkflowGraphData {
  imgUrl: string | null;
  tools: { name: string; description: string }[];
  functions: { name: string; description: string }[];
  subagents: { name: string; description: string }[];
}

export function WorkflowGraph({
  apiUrl,
  assistantId,
  cachedData,
  onDataFetched,
  initialScrollPos,
  onScroll,
}: {
  apiUrl: string;
  assistantId: string;
  cachedData: WorkflowGraphData | null;
  onDataFetched: (data: WorkflowGraphData) => void;
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
            headers: headers as any,
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
            headers: headers as any,
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
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500 line-clamp-2">
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
