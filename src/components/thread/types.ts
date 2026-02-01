export interface FileItem {
  path: string;
  content: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  updatedAt?: Date;
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, any>;
  output?: { result: string };
  status: string;
}
