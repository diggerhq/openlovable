export interface FileEntry {
  path: string;
  content: string;
}

export interface AgentLogEntry {
  id: number;
  timestamp: number;
  type: "assistant" | "tool" | "system" | "error" | "info" | "user";
  text: string;
}

export interface Settings {
  apiUrl: string;
  apiKey: string;
  anthropicApiKey: string;
}

export interface StudioState {
  status: "idle" | "creating" | "running" | "scanning" | "ready";
  statusMessage: string;
  sandboxId: string | null;
  previewUrl: string | null;
  files: FileEntry[];
  activeFile: string | null;
  agentLog: AgentLogEntry[];
  error: string | null;
}
