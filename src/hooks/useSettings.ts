import { useState, useCallback } from "react";
import type { Settings } from "../types";

const STORAGE_KEY = "opensandbox-studio-settings";

const defaultSettings: Settings = {
  apiUrl: "https://app.opencomputer.dev",
  apiKey: "",
  anthropicApiKey: "",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultSettings;
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  const setSettings = useCallback((update: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...update };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isConfigured = Boolean(settings.apiKey && settings.anthropicApiKey);

  return { settings, setSettings, isConfigured };
}
