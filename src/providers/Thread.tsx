import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";

interface ThreadContextType {
  getThreads: () => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  renameThread: (threadId: string, name: string) => Promise<void>;
  pinThread: (threadId: string, isPinned: boolean) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId) return [];
    const client = createClient(apiUrl, getApiKey() ?? undefined);

    const threads = await client.threads.search({
      metadata: {
        ...getThreadSearchMetadata(assistantId),
      },
      limit: 100,
    });

    return threads;
  }, [apiUrl, assistantId]);

  const value = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    renameThread: async (threadId: string, name: string) => {
      console.log("Renaming thread:", threadId, "to", name);
      // Optimistic update
      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === threadId
            ? { ...t, metadata: { ...t.metadata, thread_name: name } }
            : t
        )
      );
      
      if (!apiUrl) {
        console.error("API URL is missing");
        return;
      }
      try {
        console.log("Creating client with apiUrl:", apiUrl);
        const client = createClient(apiUrl, getApiKey() ?? undefined);
        console.log("Client created. Calling update...");
        const result = await client.threads.update(threadId, {
          metadata: { thread_name: name },
        });
        console.log("Rename result raw:", JSON.stringify(result, null, 2));
        
        // Force fetch to verify
        const updatedThreads = await client.threads.search({
            metadata: { thread_name: name }
        });
        console.log("Verification search result:", updatedThreads);

        await getThreads(); // Re-fetch to confirm
      } catch (e) {
        console.error("Failed to rename thread:", e);
      }
    },
    pinThread: async (threadId: string, isPinned: boolean) => {
      // Optimistic update
      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === threadId
            ? { ...t, metadata: { ...t.metadata, is_pinned: isPinned } }
            : t
        )
      );

      if (!apiUrl) return;
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      await client.threads.update(threadId, {
        metadata: { is_pinned: isPinned },
      });
      getThreads(); // Re-fetch to confirm
    },
    deleteThread: async (threadId: string) => {
      // Optimistic update
      setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));

      if (!apiUrl) return;
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      await client.threads.delete(threadId);
      // No need to re-fetch if optimistic update is correct, but safe to do eventually
    },
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
