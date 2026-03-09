import React, { useState } from "react";
import { Bot, ArrowRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  protocol?: string;
  contact?: string;
}

export const AgentListTiles: React.FC<{ agents: AgentInfo[] }> = ({ agents }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  if (!agents || agents.length === 0) return null;

  return (
    <div className="my-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className="group hover:border-primary border-muted bg-card relative flex flex-col items-start gap-4 rounded-2xl border p-5 text-left transition-all hover:shadow-lg active:scale-95"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="from-indigo-500 to-purple-500 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm">
                  <Bot className="size-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-none tracking-tight">
                    {agent.name}
                  </h3>
                </div>
              </div>
              <div className="from-muted to-background flex size-8 items-center justify-center rounded-lg bg-gradient-to-br transition-colors group-hover:from-indigo-50 group-hover:to-white">
                <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
              {agent.description}
            </p>
          </button>
        ))}
      </div>

      <Dialog open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
               <div className="from-indigo-500 to-purple-500 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm">
                  <Bot className="size-6 text-white" />
                </div>
                <span>{selectedAgent?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Agent Protocol Metadata
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4 pt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Assistant ID</p>
                <code className="bg-muted block rounded-md p-2 text-xs text-muted-foreground">
                  {selectedAgent.id}
                </code>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAgent.description}
                </p>
              </div>

              {selectedAgent.protocol && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Supported Protocol</p>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-700 rounded-md px-2 py-1 text-xs font-semibold">
                      {selectedAgent.protocol}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
