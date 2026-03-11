import { useState, useCallback, useRef } from "react";
import { Sandbox } from "@opencomputer/sdk";
import type { AgentSession, AgentEvent } from "@opencomputer/sdk";
import type { StudioState, AgentLogEntry, FileEntry, Settings } from "../types";

const SYSTEM_PROMPT = `You are an expert React developer building apps inside a sandbox environment.

A Vite + React + TypeScript + Tailwind CSS v4 project is ALREADY scaffolded and running at /workspace.
The dev server is already live on port 80. You do NOT need to create the project, run npm install, or start the dev server.

The existing project structure:
- /workspace/package.json (vite, react, react-dom, @vitejs/plugin-react, typescript, tailwindcss, @tailwindcss/vite, lucide-react, recharts)
- /workspace/index.html
- /workspace/vite.config.ts (react + tailwindcss plugins, server on 0.0.0.0:80, hmr: false)
- /workspace/tsconfig.json
- /workspace/src/main.tsx
- /workspace/src/App.tsx (placeholder — replace this with the real app)
- /workspace/src/index.css (with @import "tailwindcss";)

When the user describes an app they want:
1. Start writing code IMMEDIATELY. Do NOT plan, outline, or explain what you will do first. Jump straight into editing files.
2. Edit /workspace/src/App.tsx and add any additional component files you need under /workspace/src/
3. If you need additional npm packages, run: cd /workspace && npm install <package>
4. The dev server is already running — changes will appear automatically when you save files.

IMPORTANT:
- Do NOT restart or re-create the dev server. It is already running.
- Do NOT re-create package.json, vite.config.ts, index.html, main.tsx, or index.css unless you need to modify them.
- Use Tailwind CSS v4 for all styling (already configured with @import "tailwindcss" in index.css)
- Make the app visually polished and fully functional
- Keep everything self-contained — no external API calls unless the user asks
- Write clean, well-structured TypeScript/React code
- Start coding the actual app immediately — no planning phase`;

const initialState: StudioState = {
  status: "idle",
  statusMessage: "",
  sandboxId: null,
  previewUrl: null,
  files: [],
  activeFile: null,
  agentLog: [],
  error: null,
};

const HAIKU_DEBUG = false;
const DEBUG = true; // Debug logging for state transitions

async function summarizeTools(
  apiKey: string,
  tools: Array<{ name: string; input: unknown }>,
  signal?: AbortSignal,
  debugLog?: (msg: string) => void,
): Promise<string> {
  const descriptions = tools.map((t) => {
    const snippet = JSON.stringify(t.input ?? {}).slice(0, 300);
    return `${t.name}: ${snippet}`;
  }).join("\n");

  debugLog?.(`[haiku] calling with ${tools.length} tools, key=${apiKey ? apiKey.slice(0, 8) + "..." : "MISSING"}`);

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 40,
        messages: [
          {
            role: "user",
            content: `Summarize what these tool calls are doing in one short casual sentence (max 12 words). No quotes, no period at end, lowercase. Be specific.\n\n${descriptions}`,
          },
        ],
      }),
      signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      debugLog?.(`[haiku] HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      return "working...";
    }
    const data = await resp.json();
    const text = data?.content?.[0]?.text;
    debugLog?.(`[haiku] success: "${text}"`);
    return text ? text.trim() : "working...";
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      debugLog?.(`[haiku] aborted`);
      throw err;
    }
    debugLog?.(`[haiku] catch error: ${(err as Error).message}`);
    return "working...";
  }
}

// Scaffold files for instant preview before Claude starts working
async function scaffoldProject(sandbox: Sandbox) {
  const files: Record<string, string> = {
    "/workspace/package.json": JSON.stringify({
      name: "studio-app",
      private: true,
      type: "module",
      scripts: {
        dev: "vite --host 0.0.0.0 --port 80",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "lucide-react": "^0.460.0",
        recharts: "^2.15.0",
      },
      devDependencies: {
        "@types/react": "^18.3.12",
        "@types/react-dom": "^18.3.1",
        "@vitejs/plugin-react": "^4.3.4",
        tailwindcss: "^4.0.0",
        "@tailwindcss/vite": "^4.0.0",
        typescript: "^5.6.3",
        vite: "^6.0.0",
      },
    }, null, 2),

    "/workspace/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

    "/workspace/vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 80,
    allowedHosts: true,
    hmr: false,
  },
});`,

    "/workspace/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
      include: ["src"],
    }, null, 2),

    "/workspace/src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);`,

    "/workspace/src/index.css": `@import "tailwindcss";`,

    "/workspace/src/App.tsx": `export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-6">
          <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Building your app...</h1>
        <p className="text-slate-400 text-sm">The AI agent is writing your code</p>
      </div>
    </div>
  );
}`,
  };

  // Write all files in parallel
  await Promise.all(
    Object.entries(files).map(([path, content]) =>
      sandbox.files.write(path, content)
    )
  );

  // Install deps and start dev server
  await sandbox.commands.run("cd /workspace && npm install", { timeout: 60 });
  // Start dev server in background (don't await — it runs forever)
  sandbox.commands.run("cd /workspace && npm run dev", { timeout: 600 }).catch(() => {});
  // Give vite a moment to start
  await new Promise((r) => setTimeout(r, 2000));
}

// Cloudflare Worker proxy URL — rewrite raw HTTP connect URLs to go
// through this SSL-terminating proxy so both fetch and WebSocket work.
const CF_PROXY = "https://opencomputer-proxy.mo-b8f.workers.dev";

// Rewrite SDK sub-client URLs from http://IP:PORT to
// https://WORKER/http/IP:PORT so all traffic is SSL-terminated.
function patchSandboxUrls(sandbox: Sandbox) {
  for (const sub of [sandbox.files, sandbox.exec, sandbox.agent, sandbox.pty]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = sub as any;
    if (s && typeof s.apiUrl === "string" && s.apiUrl.startsWith("http://")) {
      // Convert http://IP:PORT -> CF_PROXY/http/IP/PORT (no colon — breaks WebSocket URLs)
      const raw = s.apiUrl.replace("http://", "").replace(":", "/");
      s.apiUrl = `${CF_PROXY}/http/${raw}`;
    }
  }
}

let logIdCounter = Date.now();

function makeLogEntry(
  type: AgentLogEntry["type"],
  text: string
): AgentLogEntry {
  return { id: ++logIdCounter, timestamp: Date.now(), type, text };
}

export function useSandboxAgent(settings: Settings) {
  const [state, setState] = useState<StudioState>(initialState);
  const sandboxRef = useRef<Sandbox | null>(null);
  const sessionRef = useRef<AgentSession | null>(null);
  const sessionAliveRef = useRef(false);
  // Track the Claude session ID (from the Claude Agent SDK) for resume
  const claudeSessionIdRef = useRef<string | null>(null);
  // Shared resolver for turn_complete detection
  const turnResolveRef = useRef<(() => void) | null>(null);

  // Debug: log every state change
  if (DEBUG) {
    console.log("[DEBUG] Current state:", {
      status: state.status,
      statusMessage: state.statusMessage,
      sandboxId: state.sandboxId,
      previewUrl: state.previewUrl,
      filesCount: state.files.length,
      error: state.error,
      isLoading: state.status !== "ready",
    });
  }

  const addLog = useCallback(
    (type: AgentLogEntry["type"], text: string) => {
      setState((prev) => ({
        ...prev,
        agentLog: [...prev.agentLog, makeLogEntry(type, text)],
      }));
    },
    []
  );

  // Rolling tool summary: accumulate tool calls between assistant messages,
  // keep a single "tool" log entry that gets re-summarized by Haiku
  const pendingToolsRef = useRef<Array<{ name: string; input: unknown }>>([]);
  const toolLogIdRef = useRef<number | null>(null);
  const summarizeAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addOrUpdateToolSummary = useCallback(
    (toolName: string, toolInput: unknown) => {
      pendingToolsRef.current.push({ name: toolName, input: toolInput });

      if (toolLogIdRef.current === null) {
        // Create the single tool summary entry
        const entry = makeLogEntry("tool", "working...");
        toolLogIdRef.current = entry.id;
        setState((prev) => ({
          ...prev,
          agentLog: [...prev.agentLog, entry],
        }));
      }

      // Debounce: wait 500ms after the last tool call before calling Haiku,
      // so rapid consecutive tool calls get batched into one request
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const currentLogId = toolLogIdRef.current;

      const debugLog = HAIKU_DEBUG
        ? (msg: string) => {
            setState((prev) => ({
              ...prev,
              agentLog: [...prev.agentLog, makeLogEntry("info", msg)],
            }));
          }
        : undefined;

      debounceTimerRef.current = setTimeout(() => {
        // Cancel any in-flight Haiku request
        if (summarizeAbortRef.current) {
          summarizeAbortRef.current.abort();
        }

        const abort = new AbortController();
        summarizeAbortRef.current = abort;
        const toolsCopy = [...pendingToolsRef.current];

        debugLog?.(`[haiku] debounce fired, ${toolsCopy.length} tools, logId=${currentLogId}`);

        summarizeTools(settings.anthropicApiKey, toolsCopy, abort.signal, debugLog)
          .then((summary) => {
            debugLog?.(`[haiku] updating logId=${currentLogId} with: "${summary}"`);
            setState((prev) => ({
              ...prev,
              agentLog: prev.agentLog.map((e) =>
                e.id === currentLogId ? { ...e, text: summary } : e
              ),
            }));
          })
          .catch((err) => {
            debugLog?.(`[haiku] promise rejected: ${(err as Error).message}`);
          });
      }, 500);
    },
    [settings.anthropicApiKey]
  );

  const resetToolAccumulator = useCallback(() => {
    pendingToolsRef.current = [];
    toolLogIdRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (summarizeAbortRef.current) {
      summarizeAbortRef.current.abort();
      summarizeAbortRef.current = null;
    }
  }, []);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      console.log("[agent-event]", event.type, event);

      if (DEBUG) console.log("[DEBUG] handleEvent called:", event.type, JSON.stringify(event).slice(0, 200));

      // Capture Claude session ID from any event that carries it
      const eventSessionId = event.session_id as string | undefined;
      if (eventSessionId && !claudeSessionIdRef.current) {
        claudeSessionIdRef.current = eventSessionId;
        if (DEBUG) console.log("[DEBUG] Captured claude session_id:", eventSessionId);
      }
      // Also check turn_complete which carries claude_session_id
      if (event.type === "turn_complete" && event.claude_session_id) {
        claudeSessionIdRef.current = event.claude_session_id as string;
        if (DEBUG) console.log("[DEBUG] Captured claude_session_id from turn_complete:", event.claude_session_id);
      }

      switch (event.type) {
        case "assistant": {
          const message = event.message as Record<string, unknown> | undefined;
          if (message && typeof message === "object") {
            const content = message.content;
            if (Array.isArray(content)) {
              let hasText = false;
              for (const block of content) {
                if (block.type === "text" && block.text) {
                  // New assistant text resets the tool accumulator
                  resetToolAccumulator();
                  addLog("assistant", block.text);
                  hasText = true;
                } else if (block.type === "tool_use") {
                  addOrUpdateToolSummary(block.name || "unknown", block.input);
                }
              }
              // If only tool_use blocks and no text, that's fine — accumulator handles it
            }
          }
          break;
        }
        case "tool_use_summary": {
          const tool = event.tool as string | undefined;
          const summary = event.summary as string | undefined;
          addOrUpdateToolSummary(tool || "tool", { summary: summary || "" });
          break;
        }
        case "result": {
          resetToolAccumulator();
          const cost = event.total_cost_usd as number | undefined;
          addLog(
            "info",
            `Turn complete${cost ? ` (cost: $${cost.toFixed(4)})` : ""}`
          );
          // Also resolve turn on result, since turn_complete may not always fire
          if (DEBUG) console.log("[DEBUG] result event: resolving turnResolveRef, exists:", !!turnResolveRef.current);
          if (turnResolveRef.current) {
            turnResolveRef.current();
            turnResolveRef.current = null;
          }
          break;
        }
        case "error":
          addLog("error", String(event.message || "Agent error"));
          setState((prev) => ({
            ...prev,
            error: String(event.message || "Agent error"),
          }));
          break;
        case "turn_complete":
          resetToolAccumulator();
          addLog("info", "Agent turn completed");
          if (DEBUG) console.log("[DEBUG] turn_complete received, turnResolveRef.current exists:", !!turnResolveRef.current);
          if (turnResolveRef.current) {
            turnResolveRef.current();
            turnResolveRef.current = null;
          } else {
            if (DEBUG) console.warn("[DEBUG] turn_complete fired but NO resolver was set!");
          }
          break;
        default:
          break;
      }
    },
    [addLog, addOrUpdateToolSummary, resetToolAccumulator]
  );

  const waitForTurn = useCallback((): Promise<void> => {
    if (DEBUG) console.log("[DEBUG] waitForTurn called, setting up promise");
    return new Promise((resolve) => {
      turnResolveRef.current = resolve;
      // Timeout after 5 minutes
      setTimeout(() => {
        if (turnResolveRef.current === resolve) {
          if (DEBUG) console.warn("[DEBUG] waitForTurn TIMED OUT after 5 minutes!");
          turnResolveRef.current = null;
          resolve();
        }
      }, 300_000);
    });
  }, []);

  const scanFiles = useCallback(async (sandbox: Sandbox) => {
    if (DEBUG) console.log("[DEBUG] scanFiles START");
    setState((prev) => ({
      ...prev,
      status: "scanning",
      statusMessage: "Scanning files...",
    }));

    const files: FileEntry[] = [];

    async function walk(dirPath: string) {
      try {
        if (DEBUG) console.log("[DEBUG] scanFiles walking:", dirPath);
        const entries = await sandbox.files.list(dirPath);
        if (DEBUG) console.log("[DEBUG] scanFiles entries in", dirPath, ":", entries.length);
        for (const entry of entries) {
          if (entry.isDir) {
            if (
              entry.name === "node_modules" ||
              entry.name === ".npm-cache" ||
              entry.name === ".git"
            )
              continue;
            await walk(entry.path);
          } else {
            try {
              const content = await sandbox.files.read(entry.path);
              files.push({ path: entry.path, content });
            } catch (readErr) {
              if (DEBUG) console.warn("[DEBUG] scanFiles skip unreadable:", entry.path, readErr);
            }
          }
        }
      } catch (dirErr) {
        if (DEBUG) console.warn("[DEBUG] scanFiles skip inaccessible dir:", dirPath, dirErr);
      }
    }

    try {
      await walk("/workspace");
      if (DEBUG) console.log("[DEBUG] scanFiles DONE, found", files.length, "files");
    } catch (walkErr) {
      if (DEBUG) console.error("[DEBUG] scanFiles walk FAILED:", walkErr);
    }

    if (DEBUG) console.log("[DEBUG] scanFiles setting status to 'ready'");
    setState((prev) => ({
      ...prev,
      status: "ready",
      statusMessage: "Ready",
      files,
      activeFile:
        prev.activeFile && files.some((f) => f.path === prev.activeFile)
          ? prev.activeFile
          : files.find((f) => f.path.endsWith("App.tsx"))?.path ??
            (files.length > 0 ? files[0].path : null),
    }));
    if (DEBUG) console.log("[DEBUG] scanFiles setState to ready CALLED");
  }, []);

  const generate = useCallback(
    async (prompt: string) => {
      // Clean up previous session
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        status: "creating",
        statusMessage: "Creating sandbox...",
        error: null,
        agentLog: [],
        files: prev.sandboxId ? prev.files : [],
      }));

      try {
        let sandbox = sandboxRef.current;

        if (!sandbox) {
          addLog("info", "Creating sandbox...");
          sandbox = await Sandbox.create({
            template: "default",
            timeout: 600,
            apiKey: settings.apiKey,
            apiUrl: settings.apiUrl,
            envs: {
              ANTHROPIC_API_KEY: settings.anthropicApiKey,
            },
            memoryMB: 1024,
            cpuCount: 2,
          });
          sandboxRef.current = sandbox;
          patchSandboxUrls(sandbox);
          addLog("info", `Sandbox created: ${sandbox.sandboxId}`);

          // Create preview URL
          const preview = await sandbox.createPreviewURL({ port: 80 });
          const hostname = preview.hostname;
          // In dev mode with nip.io, use http on port 8081 instead of https
          const previewUrl = hostname.includes("nip.io")
            ? `http://${hostname}:8081`
            : `https://${hostname}`;
          addLog("info", `Preview URL: ${previewUrl}`);

          setState((prev) => ({
            ...prev,
            sandboxId: sandbox!.sandboxId,
            previewUrl,
          }));

          // Scaffold Vite project, install deps, start dev server
          addLog("info", "Setting up project scaffold...");
          setState((prev) => ({
            ...prev,
            statusMessage: "Installing dependencies...",
          }));
          await scaffoldProject(sandbox);
          addLog("info", "Project scaffold ready — preview is live");
        } else {
          addLog("info", `Reusing sandbox: ${sandbox.sandboxId}`);
        }

        // Start agent session
        setState((prev) => ({
          ...prev,
          status: "running",
          statusMessage: "Agent is working...",
        }));
        addLog("info", "Starting agent session...");

        if (DEBUG) console.log("[DEBUG] generate: setting up turnPromise");
        const turnPromise = waitForTurn();

        if (DEBUG) console.log("[DEBUG] generate: calling sandbox.agent.start");
        const session = await sandbox.agent.start({
          prompt,
          systemPrompt: SYSTEM_PROMPT,
          maxTurns: 30,
          cwd: "/workspace",
          onEvent: handleEvent,
          onError: (text: string) => {
            if (text.includes("[claude-agent-wrapper]")) {
              if (DEBUG) console.log("[DEBUG] agent stderr:", text);
              return;
            }
            if (DEBUG) console.error("[DEBUG] agent onError:", text);
            addLog("error", text);
          },
          onExit: (code: number) => {
            if (DEBUG) console.log("[DEBUG] agent onExit with code:", code);
            addLog("info", `Agent exited with code ${code}`);
            sessionAliveRef.current = false;
            // If agent exits, also resolve turn
            if (turnResolveRef.current) {
              if (DEBUG) console.log("[DEBUG] agent onExit: resolving turnResolveRef");
              turnResolveRef.current();
              turnResolveRef.current = null;
            }
          },
        });
        sessionRef.current = session;
        sessionAliveRef.current = true;
        if (DEBUG) console.log("[DEBUG] generate: agent session started, waiting for turn...");

        // Wait for turn to complete
        await turnPromise;
        if (DEBUG) console.log("[DEBUG] generate: turnPromise resolved! Now scanning files...");

        // Scan files
        await scanFiles(sandbox);
        if (DEBUG) console.log("[DEBUG] generate: scanFiles completed, should be 'ready' now");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (DEBUG) console.error("[DEBUG] generate CATCH:", message, err);
        addLog("error", message);
        setState((prev) => ({
          ...prev,
          status: "idle",
          error: message,
        }));
      }
    },
    [settings, addLog, handleEvent, waitForTurn, scanFiles]
  );

  // Helper: start a new agent session, optionally resuming a previous Claude session
  const startAgentSession = useCallback(
    async (
      sandbox: Sandbox,
      prompt: string,
      resumeClaudeSessionId?: string,
    ): Promise<AgentSession> => {
      if (DEBUG) console.log("[DEBUG] startAgentSession: prompt:", prompt.slice(0, 100), "resume:", resumeClaudeSessionId);

      const session = await sandbox.agent.start({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: 30,
        cwd: "/workspace",
        resume: resumeClaudeSessionId,
        onEvent: handleEvent,
        onError: (text: string) => {
          // Wrapper stderr debug logs start with [claude-agent-wrapper] — don't show as errors
          if (text.includes("[claude-agent-wrapper]")) {
            if (DEBUG) console.log("[DEBUG] agent stderr:", text);
            return;
          }
          if (DEBUG) console.error("[DEBUG] agent onError:", text);
          addLog("error", text);
        },
        onExit: (code: number) => {
          if (DEBUG) console.log("[DEBUG] agent onExit with code:", code);
          addLog("info", `Agent exited with code ${code}`);
          sessionAliveRef.current = false;
          if (turnResolveRef.current) {
            turnResolveRef.current();
            turnResolveRef.current = null;
          }
        },
      });

      return session;
    },
    [handleEvent, addLog]
  );

  const sendFollowUp = useCallback(
    async (prompt: string) => {
      const sandbox = sandboxRef.current;

      if (DEBUG) console.log("[DEBUG] sendFollowUp called, sandbox:", !!sandbox, "sessionAlive:", sessionAliveRef.current, "claudeSessionId:", claudeSessionIdRef.current);

      if (!sandbox) {
        if (DEBUG) console.log("[DEBUG] sendFollowUp: no sandbox, falling back to generate");
        return generate(prompt);
      }

      setState((prev) => ({
        ...prev,
        status: "running",
        statusMessage: "Agent is working...",
        error: null,
      }));
      addLog("user", prompt);

      try {
        // If the agent process is still alive, send the prompt directly via stdin
        // instead of killing the session and trying to resume
        if (sessionRef.current && sessionAliveRef.current) {
          if (DEBUG) console.log("[DEBUG] sendFollowUp: session is alive, using sendPrompt");
          addLog("info", "Continuing conversation...");
          const turnPromise = waitForTurn();
          sessionRef.current.sendPrompt(prompt);

          if (DEBUG) console.log("[DEBUG] sendFollowUp: waiting for turnPromise...");
          await turnPromise;
          if (DEBUG) console.log("[DEBUG] sendFollowUp: turnPromise resolved, scanning files...");
          await scanFiles(sandbox);
          if (DEBUG) console.log("[DEBUG] sendFollowUp: scanFiles done, should be 'ready'");
          return;
        }

        // Agent process is dead — close old WebSocket and start a new session with resume
        if (sessionRef.current) {
          sessionRef.current.close();
          sessionRef.current = null;
        }
        // Small delay to let old WebSocket onclose fire before we set up new resolver
        await new Promise((r) => setTimeout(r, 100));

        const turnPromise = waitForTurn();

        const claudeSessionId = claudeSessionIdRef.current;
        if (claudeSessionId) {
          if (DEBUG) console.log("[DEBUG] sendFollowUp: resuming Claude session:", claudeSessionId);
          addLog("info", "Resuming conversation...");
        } else {
          if (DEBUG) console.log("[DEBUG] sendFollowUp: no Claude session to resume, starting fresh");
          addLog("info", "Starting new agent session...");
        }

        const session = await startAgentSession(sandbox, prompt, claudeSessionId || undefined);
        sessionRef.current = session;
        sessionAliveRef.current = true;

        if (DEBUG) console.log("[DEBUG] sendFollowUp: waiting for turnPromise...");
        await turnPromise;
        if (DEBUG) console.log("[DEBUG] sendFollowUp: turnPromise resolved, scanning files...");
        await scanFiles(sandbox);
        if (DEBUG) console.log("[DEBUG] sendFollowUp: scanFiles done, should be 'ready'");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (DEBUG) console.error("[DEBUG] sendFollowUp ERROR:", message, err);
        addLog("error", message);
        setState((prev) => ({
          ...prev,
          status: "idle",
          error: message,
        }));
      }
    },
    [generate, addLog, startAgentSession, waitForTurn, scanFiles]
  );

  return { state, generate, sendFollowUp };
}
