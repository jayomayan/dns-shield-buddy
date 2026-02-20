/**
 * Global settings store — single source of truth from Supabase.
 * 
 * All configuration (bridge URL, Okta config, local admin, etc.) is loaded from
 * the database on app start. Per-browser session tokens (Okta session, admin session)
 * remain in localStorage since they are ephemeral.
 */

import { getActiveClient } from "@/lib/supabase-client";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface AppConfig {
  bridge_url: string | null;
  bridge_api_key: string | null;
  okta_domain: string | null;
  okta_client_id: string | null;
  okta_client_secret: string | null;
  okta_enabled: boolean;
  api_tokens: unknown;
  log_retention: string;
  log_rotation: string;
  log_max_size: string;
  notify_blocked: boolean;
  notify_service: boolean;
  local_admin_enabled: boolean;
  admin_password_hash: string;
}

const DEFAULT_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

const DEFAULTS: AppConfig = {
  bridge_url: null,
  bridge_api_key: null,
  okta_domain: null,
  okta_client_id: null,
  okta_client_secret: null,
  okta_enabled: false,
  api_tokens: null,
  log_retention: "30",
  log_rotation: "daily",
  log_max_size: "500",
  notify_blocked: true,
  notify_service: true,
  local_admin_enabled: true,
  admin_password_hash: DEFAULT_PASSWORD_HASH,
};

// ── Module-level cache ────────────────────────────────────────────────────────

let _config: AppConfig = { ...DEFAULTS };
let _loaded = false;
let _loadPromise: Promise<AppConfig> | null = null;
const _listeners: Array<(cfg: AppConfig) => void> = [];

export function getConfig(): AppConfig {
  return _config;
}

export function isLoaded(): boolean {
  return _loaded;
}

export function subscribe(fn: (cfg: AppConfig) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

function notify() {
  _listeners.forEach((fn) => fn(_config));
}

// ── Load from Supabase ────────────────────────────────────────────────────────

export async function loadConfig(): Promise<AppConfig> {
  if (_loadPromise) return _loadPromise;
  _loadPromise = _doLoad();
  return _loadPromise;
}

async function _doLoad(): Promise<AppConfig> {
  try {
    const { data, error } = await getActiveClient()
      .from("user_settings")
      .select("*")
      .eq("user_id", SYSTEM_USER_ID)
      .maybeSingle();

    if (error) {
      console.error("Settings load error:", error);
      _loaded = true;
      return _config;
    }

    if (!data) {
      // Create default row
      await getActiveClient().from("user_settings").insert([{ user_id: SYSTEM_USER_ID }]);
      _loaded = true;
      notify();
      return _config;
    }

    _config = {
      bridge_url: data.bridge_url,
      bridge_api_key: data.bridge_api_key,
      okta_domain: data.okta_domain,
      okta_client_id: data.okta_client_id,
      okta_client_secret: data.okta_client_secret,
      okta_enabled: data.okta_enabled,
      api_tokens: data.api_tokens,
      log_retention: data.log_retention,
      log_rotation: data.log_rotation,
      log_max_size: data.log_max_size,
      notify_blocked: data.notify_blocked,
      notify_service: data.notify_service,
      local_admin_enabled: (data as Record<string, unknown>).local_admin_enabled as boolean ?? true,
      admin_password_hash: (data as Record<string, unknown>).admin_password_hash as string ?? DEFAULT_PASSWORD_HASH,
    };
    _loaded = true;
    notify();
    return _config;
  } catch (e) {
    console.error("Settings load failed:", e);
    _loaded = true;
    return _config;
  }
}

// ── Save partial updates ──────────────────────────────────────────────────────

export async function saveConfig(patch: Partial<AppConfig>): Promise<boolean> {
  try {
    const { error } = await getActiveClient()
      .from("user_settings")
      .update(patch as Record<string, unknown>)
      .eq("user_id", SYSTEM_USER_ID);

    if (error) {
      console.error("Settings save error:", error);
      return false;
    }

    _config = { ..._config, ...patch };
    notify();
    return true;
  } catch (e) {
    console.error("Settings save failed:", e);
    return false;
  }
}

// ── Force reload ──────────────────────────────────────────────────────────────

export async function reloadConfig(): Promise<AppConfig> {
  _loadPromise = null;
  _loaded = false;
  return loadConfig();
}
