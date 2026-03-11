import { useState } from "react";
import type { StudioState } from "../types";
import Preview from "./Preview";
import PromptInput from "./PromptInput";
import AgentLog from "./AgentLog";
import {
  Loader2,
  Eye,
  MessageSquare,
  Settings,
} from "lucide-react";

interface Props {
  state: StudioState;
  onGenerate: (prompt: string) => void;
  onOpenSettings: () => void;
}

export default function Workspace({ state, onGenerate, onOpenSettings }: Props) {
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const selectedFile = activeFile ?? state.activeFile;

  const isWorking =
    state.status === "creating" ||
    state.status === "running" ||
    state.status === "scanning";

  console.log("[DEBUG Workspace] state.status:", state.status, "isWorking:", isWorking, "previewUrl:", state.previewUrl, "isLoading (passed to Preview):", state.status !== "ready");

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-white">
            OpenComputer Studio
          </span>
          {state.statusMessage && (
            <div className="flex items-center gap-2 text-xs text-[#8888a0]">
              {isWorking && (
                <Loader2 className="w-3 h-3 animate-spin text-brand-400" />
              )}
              <span>{state.statusMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-surface-lighter text-[#8888a0] hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Mobile tab switcher */}
          <div className="flex md:hidden items-center gap-1 bg-surface-light rounded-lg p-0.5">
            <button
              onClick={() => setMobileTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mobileTab === "chat"
                  ? "bg-surface-lighter text-white"
                  : "text-[#8888a0]"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setMobileTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mobileTab === "preview"
                  ? "bg-surface-lighter text-white"
                  : "text-[#8888a0]"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Agent log + prompt input */}
        <div
          className={`${
            mobileTab === "chat" ? "flex" : "hidden"
          } md:flex flex-col w-full md:w-[520px] md:min-w-[440px] md:max-w-[600px] border-r border-border`}
        >
          {/* Agent log header */}
          <div className="h-10 flex items-center gap-2 px-3 border-b border-border shrink-0">
            <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs font-medium text-white">Agent Activity</span>
            {isWorking && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse ml-1" />
            )}
          </div>

          {/* Scrollable log */}
          <div className="flex-1 overflow-hidden">
            <AgentLog entries={state.agentLog} />
          </div>

          {/* Prompt input pinned to bottom */}
          <PromptInput onSubmit={onGenerate} disabled={isWorking} />
        </div>

        {/* Right panel: Full preview */}
        <div
          className={`${
            mobileTab === "preview" ? "flex" : "hidden"
          } md:flex flex-col flex-1`}
        >
          <Preview
            url={state.previewUrl}
            isLoading={state.status !== "ready"}
            files={state.files}
            activeFile={selectedFile}
            onSelectFile={setActiveFile}
          />
        </div>
      </div>

      {/* Error toast */}
      {state.error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg backdrop-blur max-w-md truncate">
          {state.error}
        </div>
      )}
    </div>
  );
}
