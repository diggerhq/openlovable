import { useState, useEffect, useRef } from "react";
import { RefreshCw, Loader2, Eye, Code2 } from "lucide-react";
import type { FileEntry } from "../types";
import FileTree from "./FileTree";
import CodeEditor from "./CodeEditor";

interface Props {
  url: string | null;
  isLoading: boolean;
  files: FileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}

export default function Preview({ url, isLoading, files, activeFile, onSelectFile }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const wasLoadingRef = useRef(isLoading);

  // Debug logging
  console.log("[DEBUG Preview] render:", { url, isLoading, filesCount: files.length, showIframe: !!(url && !isLoading), wasLoading: wasLoadingRef.current });

  const fileContent =
    files.find((f) => f.path === activeFile)?.content ?? "";

  // Auto-refresh iframe when loading finishes (agent turn completes)
  useEffect(() => {
    console.log("[DEBUG Preview] useEffect: wasLoading=", wasLoadingRef.current, "isLoading=", isLoading, "url=", url);
    if (wasLoadingRef.current && !isLoading && url) {
      console.log("[DEBUG Preview] Loading finished! Scheduling iframe refresh in 2s");
      const timer = setTimeout(() => {
        console.log("[DEBUG Preview] Refreshing iframe now (key++)");
        setRefreshKey((k) => k + 1);
      }, 2000);
      wasLoadingRef.current = isLoading;
      return () => clearTimeout(timer);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, url]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-2 px-3 border-b border-border shrink-0">
        {/* Tab toggle */}
        <div className="flex items-center gap-0.5 bg-surface-light rounded-lg p-0.5">
          <button
            onClick={() => setTab("preview")}
            className={`p-1.5 rounded-md transition-colors ${
              tab === "preview"
                ? "bg-surface-lighter text-white"
                : "text-[#8888a0] hover:text-white"
            }`}
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTab("code")}
            className={`p-1.5 rounded-md transition-colors ${
              tab === "code"
                ? "bg-surface-lighter text-white"
                : "text-[#8888a0] hover:text-white"
            }`}
            title="Code"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {tab === "preview" ? (
          <>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={!url}
              className="p-1.5 rounded-md hover:bg-surface-lighter text-[#8888a0] hover:text-white transition-colors disabled:opacity-30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 flex items-center bg-surface-light rounded-lg px-3 py-1 text-xs text-[#8888a0] truncate border border-border/50">
              {url || "Preview"}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center text-xs text-[#8888a0] truncate px-1">
            {activeFile || "No file selected"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {tab === "preview" ? (
          <div className="h-full bg-white">
            {url ? (
              <iframe
                key={refreshKey}
                src={url}
                className="w-full h-full border-0"
                title="App preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-light">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
                <p className="text-sm text-[#8888a0]">
                  {isLoading
                    ? "Setting up environment..."
                    : "Enter a prompt to get started"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <FileTree
              files={files}
              activeFile={activeFile}
              onSelect={onSelectFile}
            />
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                content={fileContent}
                filePath={activeFile}
                readOnly={isLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
