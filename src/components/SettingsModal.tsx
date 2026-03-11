import { useState } from "react";
import { X } from "lucide-react";
import type { Settings } from "../types";

interface Props {
  settings: Settings;
  onSave: (update: Partial<Settings>) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(
    settings.anthropicApiKey
  );

  const handleSave = () => {
    onSave({ apiUrl, apiKey, anthropicApiKey });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-lighter text-[#8888a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8888a0] mb-1.5">
              OpenComputer API URL
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://app.opencomputer.dev"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#555570] focus:outline-none focus:border-brand-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8888a0] mb-1.5">
              OpenComputer API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your OpenComputer API key"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#555570] focus:outline-none focus:border-brand-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8888a0] mb-1.5">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#555570] focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            <p className="text-xs text-[#555570] mt-1.5">
              Passed to the sandbox VM for Claude Code. Stored locally in your
              browser.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-[#8888a0] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
