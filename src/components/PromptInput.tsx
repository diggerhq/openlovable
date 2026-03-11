import { useState } from "react";
import { SendHorizonal } from "lucide-react";

interface Props {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
}

export default function PromptInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="h-14 flex items-center gap-3 px-4 border-t border-border shrink-0 bg-surface"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask for changes..."
        disabled={disabled}
        className="flex-1 bg-surface-light border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-[#555570] focus:outline-none focus:border-brand-500/50 disabled:opacity-50 transition-colors"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
      >
        <SendHorizonal className="w-4 h-4" />
      </button>
    </form>
  );
}
