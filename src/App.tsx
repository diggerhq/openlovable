import { useState } from "react";
import { useSettings } from "./hooks/useSettings";
import { useSandboxAgent } from "./hooks/useSandboxAgent";
import LandingPage from "./components/LandingPage";
import Workspace from "./components/Workspace";
import SettingsModal from "./components/SettingsModal";

type View = "landing" | "workspace";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [showSettings, setShowSettings] = useState(false);
  const { settings, setSettings, isConfigured } = useSettings();
  const { state, generate, sendFollowUp } = useSandboxAgent(settings);

  const handleGenerate = async (prompt: string) => {
    if (!isConfigured) {
      setShowSettings(true);
      return;
    }
    setView("workspace");
    await generate(prompt);
  };

  const handleFollowUp = async (prompt: string) => {
    await sendFollowUp(prompt);
  };

  return (
    <>
      {view === "workspace" ? (
        <Workspace
          state={state}
          onGenerate={handleFollowUp}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : (
        <LandingPage
          onGenerate={handleGenerate}
          onOpenSettings={() => setShowSettings(true)}
          isConfigured={isConfigured}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
