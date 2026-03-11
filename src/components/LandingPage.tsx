import { useState } from "react";
import { Sparkles, ArrowRight, Github, Settings } from "lucide-react";

const EXAMPLE_PROMPTS = [
  "A task management app with drag-and-drop",
  "A weather dashboard with charts",
  "A pomodoro timer with sound effects",
  "A markdown note-taking app",
];

interface Props {
  onGenerate: (prompt: string) => void;
  onOpenSettings: () => void;
  isConfigured: boolean;
}

export default function LandingPage({
  onGenerate,
  onOpenSettings,
  isConfigured,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) onGenerate(prompt.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-brand-600/8 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-brand-500/5 blur-[100px]" />
      </div>

      {/* Settings button */}
      <button
        onClick={onOpenSettings}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-lighter text-[#8888a0] hover:text-white transition-colors z-10"
      >
        <Settings className="w-5 h-5" />
      </button>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
        {/* Logo / Branding */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight">
            OpenComputer Studio
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-3 tracking-tight text-white">
          What do you want to build?
        </h1>
        <p className="text-[#8888a0] text-center mb-10 text-lg">
          Describe your app and Claude Code will build it in a sandbox.
        </p>

        {/* API key warning */}
        {!isConfigured && (
          <button
            onClick={onOpenSettings}
            className="mb-4 px-4 py-2 rounded-xl bg-yellow-600/20 border border-yellow-500/30 text-yellow-300 text-sm hover:bg-yellow-600/30 transition-colors"
          >
            Configure your API keys to get started
          </button>
        )}

        {/* Prompt Form */}
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className={`relative rounded-2xl border transition-all duration-300 ${
              isHovered || prompt
                ? "border-brand-500/50 shadow-[0_0_30px_rgba(91,91,247,0.1)]"
                : "border-border"
            } bg-surface-light`}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Build me a..."
              rows={4}
              className="w-full bg-transparent resize-none px-5 pt-5 pb-16 text-[15px] text-white placeholder:text-[#555570] focus:outline-none"
            />
            <div className="absolute bottom-3 right-3">
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                Generate
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Example Prompts */}
        <div className="flex flex-wrap gap-2 mt-6 justify-center">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              onClick={() => setPrompt(example)}
              className="px-4 py-2 rounded-full text-xs font-medium bg-surface-lighter/60 text-[#9999b0] hover:text-white hover:bg-surface-lighter border border-border/60 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 mt-10 text-sm text-[#8888a0]">
          <a
            href="https://github.com/diggerhq/opencomputer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <span className="text-border">|</span>
          <span className="text-xs text-[#555570]">
            Powered by Claude Code + OpenComputer
          </span>
        </div>
      </div>
    </div>
  );
}
