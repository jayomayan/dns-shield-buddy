// Persistent bridge URL & API key — stored in localStorage so they survive page reloads.
import { useState, useCallback } from "react";

const STORAGE_KEY = "unbound_bridge_url";
const API_KEY_STORAGE_KEY = "unbound_bridge_api_key";
const DB_CONFIG_KEY = "unbound_db_config";
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
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {}
}

export interface DbConfig {
  db_type: string;
  db_host?: string | null;
  db_port?: string | null;
  db_name?: string | null;
  db_user?: string | null;
  db_password?: string | null;
}

export function getDbConfig(): DbConfig {
  try {
    const raw = localStorage.getItem(DB_CONFIG_KEY);
    if (raw) return JSON.parse(raw) as DbConfig;
  } catch {}
  return { db_type: "local" };
}

export function setDbConfig(cfg: DbConfig): void {
  try {
    localStorage.setItem(DB_CONFIG_KEY, JSON.stringify(cfg));
  } catch {}
}

/** Returns fetch headers including Authorization and X-DB-Config if configured. */
export function getBridgeHeaders(): HeadersInit {
  const key = getBridgeApiKey();
  const db = getDbConfig();
  const headers: Record<string, string> = {};
  if (key) headers["Authorization"] = `Bearer ${key}`;
  // Always send db config so bridge routes to the right database
  headers["X-DB-Type"] = db.db_type || "local";
  if (db.db_type === "remote") {
    if (db.db_host)     headers["X-DB-Host"]     = db.db_host;
    if (db.db_port)     headers["X-DB-Port"]     = db.db_port;
    if (db.db_name)     headers["X-DB-Name"]     = db.db_name;
    if (db.db_user)     headers["X-DB-User"]     = db.db_user;
    if (db.db_password) headers["X-DB-Password"] = db.db_password;
  }
  return headers;
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
