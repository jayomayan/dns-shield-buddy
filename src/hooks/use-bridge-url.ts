// Persistent bridge URL — stored in localStorage so it survives page reloads.
import { useState, useCallback } from "react";

const STORAGE_KEY = "unbound_bridge_url";
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

export function useBridgeUrl() {
  const [url, setUrlState] = useState<string>(getBridgeUrl);

  const setUrl = useCallback((next: string) => {
    const clean = next.replace(/\/$/, "");
    setBridgeUrl(clean);
    setUrlState(clean);
  }, []);

  return { url, setUrl, defaultUrl: DEFAULT_URL };
}
