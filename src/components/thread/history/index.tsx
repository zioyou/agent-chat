import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useState, useRef } from "react";
import {
  isToday,
  isYesterday,
  subDays,
  isAfter,
  startOfDay,
} from "date-fns";

import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PanelRightOpen,
  PanelRightClose,
  MoreHorizontal,
  SquarePen,
  Trash2,
  Pencil,
  MessageSquare,
  Plus,
  Pin,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getContentString } from "../utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function ThreadItem({
  thread,
  isActive,
  onClick,
}: {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}) {
  const { renameThread, pinThread, deleteThread } = useThreads();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  let itemText: string =
    (thread.metadata as { thread_name?: string })?.thread_name ||
    (thread.metadata?.thread_name as string);

  if (!itemText) {
    const values = thread.values as Record<string, any>;
    const firstMessage =
      values && values.messages && Array.isArray(values.messages)
        ? values.messages[0]
        : null;
    if (firstMessage) {
      itemText = getContentString(firstMessage.content);
    }
  }

  // Fallback for empty conversations
  if (!itemText || itemText === thread.thread_id) {
    itemText = "새로운 대화";
  }

  const handleRename = () => {
    renameThread(thread.thread_id, renameValue);
    setIsRenameDialogOpen(false);
  };

  const handleDelete = () => {
    deleteThread(thread.thread_id);
    setIsDeleteDialogOpen(false);
    toast.info("채팅방이 삭제되었습니다.");
  };

  const isPinned = (thread.metadata as { is_pinned?: boolean })?.is_pinned;

  return (
    <>
      <div
        className={cn(
          "group flex w-full items-center rounded-full pr-2 transition-colors",
          isActive
            ? "bg-blue-100/50 text-blue-700 hover:bg-blue-100/50"
            : "text-gray-700 hover:bg-gray-100/80"
        )}
      >
        <button
          className="flex min-w-0 flex-1 items-center justify-start overflow-hidden rounded-l-full py-2 pl-4 text-left font-normal focus:outline-none"
          onClick={(e) => {
            e.preventDefault();
            onClick();
          }}
        >
          <MessageSquare className="mr-2 size-4 shrink-0 opacity-50" />
          <span className="truncate text-sm">{itemText}</span>
        </button>
        
        {isPinned && (
           <Pin className="mr-1 size-3 text-gray-400 rotate-45 transform" />
        )}

        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden transition-all duration-200 ease-in-out",
            "w-0 opacity-0 group-hover:w-8 group-hover:opacity-100",
            (isMenuOpen || isRenameDialogOpen || isDeleteDialogOpen) && "w-8 opacity-100"
          )}
        >
          <DropdownMenu 
            onOpenChange={setIsMenuOpen} 
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-gray-200"
              >
                <MoreHorizontal className="size-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(itemText);
                  setIsRenameDialogOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                <Pencil className="mr-2 size-4" />
                <span>이름 변경</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  pinThread(thread.thread_id, !isPinned);
                }}
              >
                <Pin className={cn("mr-2 size-4", isPinned && "fill-current")} />
                <span>{isPinned ? "고정 해제" : "고정"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteDialogOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                <span>삭제</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>채팅방 이름 변경</DialogTitle>
            <DialogDescription>
              변경할 채팅방의 이름을 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                이름
              </Label>
              <Input
                id="name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="col-span-3"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>취소</Button>
            <Button onClick={handleRename}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 채팅방을 삭제하면 복구할 수 없습니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  // Group threads by date
  const groupedThreads = {
    pinned: [] as Thread[],
    today: [] as Thread[],
    yesterday: [] as Thread[],
    previous7Days: [] as Thread[],
    previous30Days: [] as Thread[],
    older: [] as Thread[],
  };

  threads.forEach((t) => {
    // Check for pinned status first
    const isPinned = (t.metadata as { is_pinned?: boolean })?.is_pinned;
    if (isPinned) {
      groupedThreads.pinned.push(t);
      return;
    }

    const date = new Date(t.created_at);
    if (isToday(date)) {
      groupedThreads.today.push(t);
    } else if (isYesterday(date)) {
      groupedThreads.yesterday.push(t);
    } else if (isAfter(date, subDays(startOfDay(new Date()), 7))) {
      groupedThreads.previous7Days.push(t);
    } else if (isAfter(date, subDays(startOfDay(new Date()), 30))) {
      groupedThreads.previous30Days.push(t);
    } else {
      groupedThreads.older.push(t);
    }
  });

  const renderGroup = (title: string, items: Thread[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6 w-full">
        <h3 className="mb-2 px-4 text-xs font-semibold text-gray-500">{title}</h3>
        <div className="flex flex-col gap-0.5">
          {items.map((t) => (
            <ThreadItem
              key={t.thread_id}
              thread={t}
              isActive={t.thread_id === threadId}
              onClick={() => {
                onThreadClick?.(t.thread_id);
                if (t.thread_id !== threadId) {
                  setThreadId(t.thread_id);
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-2 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {renderGroup("고정됨", groupedThreads.pinned)}
      {renderGroup("오늘", groupedThreads.today)}
      {renderGroup("어제", groupedThreads.yesterday)}
      {renderGroup("지난 7일", groupedThreads.previous7Days)}
      {renderGroup("지난 30일", groupedThreads.previous30Days)}
      {renderGroup("더 오래전", groupedThreads.older)}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 px-4 pt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`group-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full rounded-full" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [_, setThreadId] = useQueryState("threadId");

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, []);

  const handleNewChat = () => {
    setThreadId(null);
    if (!isLargeScreen) {
      setChatHistoryOpen(false);
    }
  };

  return (
    <>
      <div className="hidden h-screen w-[300px] shrink-0 flex-col border-r bg-gray-50/50 lg:flex">
        {/* Header Area */}
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:bg-gray-200"
              onClick={() => setChatHistoryOpen(false)}
            >
              <PanelRightClose className="size-5" />
            </Button>
            <div className="flex gap-1">
               {/* Setting Icons could go here if needed, but keeping Sidebar clean */}
            </div>
          </div>
          
          {/* New Chat Button (Prominent) */}
          <Button
            className="h-12 w-full justify-start gap-3 rounded-full bg-gray-100 pl-4 text-gray-600 shadow-sm transition-all hover:bg-white hover:shadow-md hover:ring-1 hover:ring-gray-200"
            variant="ghost"
            onClick={handleNewChat}
          >
            <Plus className="size-5 text-gray-500" />
            <span className="text-sm font-medium">새 채팅</span>
          </Button>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-hidden">
             {threadsLoading ? (
            <ThreadHistoryLoading />
          ) : (
            <ThreadList threads={threads} />
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent side="left" className="flex w-[300px] flex-col p-0 lg:hidden">
             <div className="flex flex-col gap-4 p-4">
                <SheetHeader className="text-left">
                  <SheetTitle className="text-lg font-semibold">메뉴</SheetTitle>
                </SheetHeader>
                <Button
                    className="h-12 w-full justify-start gap-3 rounded-full bg-gray-100 pl-4 text-gray-600 shadow-sm transition-all hover:bg-white hover:shadow-md hover:ring-1 hover:ring-gray-200"
                    variant="ghost"
                    onClick={handleNewChat}
                >
                    <Plus className="size-5 text-gray-500" />
                    <span className="text-sm font-medium">새 채팅</span>
                </Button>
             </div>
             <div className="flex-1 overflow-y-auto">
                <ThreadList
                threads={threads}
                onThreadClick={() => setChatHistoryOpen(false)}
                />
             </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
