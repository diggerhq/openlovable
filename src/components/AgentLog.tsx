import { useEffect, useRef } from "react";
import type { AgentLogEntry } from "../types";
import { Bot, AlertCircle, User } from "lucide-react";

interface Props {
  entries: AgentLogEntry[];
}

export default function AgentLog({ entries }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#555570] gap-2">
        <Bot className="w-8 h-8" />
        <p className="text-sm">Waiting for agent activity...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-3 space-y-2"
    >
      {entries.map((entry) => {
        // Tool summary — single faint line
        if (entry.type === "tool") {
          return (
            <div key={entry.id} className="px-2 py-1.5 text-xs text-[#555570] italic">
              {entry.text}
            </div>
          );
        }

        // User message card
        if (entry.type === "user") {
          return (
            <div
              key={entry.id}
              className="rounded-lg border px-3 py-2.5 bg-emerald-500/10 border-emerald-500/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">You</span>
                <span className="text-[10px] text-[#555570] ml-auto tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-xs text-[#c0c0d8] leading-relaxed whitespace-pre-wrap break-words">
                {entry.text}
              </p>
            </div>
          );
        }

        // Info — compact line
        if (entry.type === "info") {
          return (
            <div key={entry.id} className="px-2 py-1 text-xs text-[#555570]">
              {entry.text}
            </div>
          );
        }

        // Error card
        if (entry.type === "error") {
          return (
            <div
              key={entry.id}
              className="rounded-lg border px-3 py-2.5 bg-red-500/10 border-red-500/20"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-semibold text-red-400">Error</span>
                <span className="text-[10px] text-[#555570] ml-auto tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-xs text-[#c0c0d8] leading-relaxed whitespace-pre-wrap break-words">
                {entry.text}
              </p>
            </div>
          );
        }

        // Assistant message card
        return (
          <div
            key={entry.id}
            className="rounded-lg border px-3 py-2.5 bg-blue-500/10 border-blue-500/20"
          >
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">Agent</span>
              <span className="text-[10px] text-[#555570] ml-auto tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <p className="text-xs text-[#c0c0d8] leading-relaxed whitespace-pre-wrap break-words">
              {entry.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
