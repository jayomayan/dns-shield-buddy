// Bridge URL & API key — reads from DB-backed settings store.
// localStorage is no longer used for configuration.

import { useState, useCallback, useEffect } from "react";
import { getConfig, subscribe } from "@/lib/settings-store";

const DEFAULT_URL = "http://localhost:8080";

export function getBridgeUrl(): string {
  return getConfig().bridge_url || DEFAULT_URL;
}

export function getBridgeApiKey(): string {
  return getConfig().bridge_api_key || "";
}

// These are kept for compatibility but now just update the in-memory store
// The actual persistence happens via saveConfig() in SettingsPage
export function setBridgeUrl(_url: string): void {
  // No-op: persistence is handled by settings store
}

export function setBridgeApiKey(_key: string): void {
  // No-op: persistence is handled by settings store
}

/** Returns fetch headers including Authorization if configured. */
export function getBridgeHeaders(): HeadersInit {
  const key = getBridgeApiKey();
  const headers: Record<string, string> = {};
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

export function useBridgeUrl() {
  const [url, setUrlState] = useState<string>(getBridgeUrl);
  const [apiKey, setApiKeyState] = useState<string>(getBridgeApiKey);

  useEffect(() => {
    return subscribe(() => {
      setUrlState(getBridgeUrl());
      setApiKeyState(getBridgeApiKey());
    });
  }, []);

  const setUrl = useCallback((next: string) => {
    setUrlState(next.replace(/\/$/, ""));
  }, []);

  const setApiKey = useCallback((next: string) => {
    setApiKeyState(next);
  }, []);

  return { url, setUrl, apiKey, setApiKey, defaultUrl: DEFAULT_URL };
}
