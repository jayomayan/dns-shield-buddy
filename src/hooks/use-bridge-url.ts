// Persistent bridge URL & API key — stored in localStorage so they survive page reloads.
import { useState, useCallback } from "react";

const STORAGE_KEY = "unbound_bridge_url";
const API_KEY_STORAGE_KEY = "unbound_bridge_api_key";
const DEFAULT_URL = "http://localhost:8080";

export function getBridgeUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function setBridgeUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, "")); // strip trailing slash
  } catch {}
}

export function getBridgeApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setBridgeApiKey(key: string): void {
  try {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {}
}

/** Returns fetch headers including Authorization if an API key is configured. */
export function getBridgeHeaders(): HeadersInit {
  const key = getBridgeApiKey();
  return key ? { "Authorization": `Bearer ${key}` } : {};
}

export function useBridgeUrl() {
  const [url, setUrlState] = useState<string>(getBridgeUrl);
  const [apiKey, setApiKeyState] = useState<string>(getBridgeApiKey);

  const setUrl = useCallback((next: string) => {
    const clean = next.replace(/\/$/, "");
    setBridgeUrl(clean);
    setUrlState(clean);
  }, []);

  const setApiKey = useCallback((next: string) => {
    setBridgeApiKey(next);
    setApiKeyState(next);
  }, []);

  return { url, setUrl, apiKey, setApiKey, defaultUrl: DEFAULT_URL };
}
