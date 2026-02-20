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

export interface DbConfig {
  db_type: string;
  db_host?: string | null;
  db_port?: string | null;
  db_name?: string | null;
  db_user?: string | null;
  db_password?: string | null;
}

export function getDbConfig(): DbConfig {
  const cfg = getConfig();
  return {
    db_type: cfg.db_type || "local",
    db_host: cfg.db_host,
    db_port: cfg.db_port,
    db_name: cfg.db_name,
    db_user: cfg.db_user,
    db_password: cfg.db_password,
  };
}

export function setDbConfig(_cfg: DbConfig): void {
  // No-op: persistence is handled by settings store
}

/** Returns fetch headers including Authorization and X-DB-Config if configured. */
export function getBridgeHeaders(): HeadersInit {
  const key = getBridgeApiKey();
  const db = getDbConfig();
  const headers: Record<string, string> = {};
  if (key) headers["Authorization"] = `Bearer ${key}`;
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
