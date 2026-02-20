/**
 * Switchable Supabase client — supports both Lovable Cloud and self-hosted instances.
 *
 * Mode and self-hosted credentials are stored in localStorage because they determine
 * which database to connect to (chicken-and-egg: can't read the DB to decide which DB).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabase as cloudClient } from "@/integrations/supabase/client";

export type BackendMode = "cloud" | "self-hosted";

const LS_MODE = "backend_mode";
const LS_SH_URL = "selfhosted_supabase_url";
const LS_SH_KEY = "selfhosted_supabase_anon_key";

let _selfHostedClient: SupabaseClient | null = null;
let _cachedUrl = "";
let _cachedKey = "";

// ── Getters / Setters ────────────────────────────────────────────────────────

export function getBackendMode(): BackendMode {
  try {
    const v = localStorage.getItem(LS_MODE);
    return v === "self-hosted" ? "self-hosted" : "cloud";
  } catch {
    return "cloud";
  }
}

export function setBackendMode(mode: BackendMode): void {
  localStorage.setItem(LS_MODE, mode);
  // Reset cached self-hosted client when switching modes
  _selfHostedClient = null;
}

export function getSelfHostedConfig(): { url: string; anonKey: string } {
  return {
    url: localStorage.getItem(LS_SH_URL) || "",
    anonKey: localStorage.getItem(LS_SH_KEY) || "",
  };
}

export function setSelfHostedConfig(url: string, anonKey: string): void {
  localStorage.setItem(LS_SH_URL, url);
  localStorage.setItem(LS_SH_KEY, anonKey);
  // Invalidate cached client so next call creates a new one
  _selfHostedClient = null;
  _cachedUrl = "";
  _cachedKey = "";
}

// ── Active client ────────────────────────────────────────────────────────────

function getSelfHostedClient(): SupabaseClient {
  const { url, anonKey } = getSelfHostedConfig();

  if (_selfHostedClient && url === _cachedUrl && anonKey === _cachedKey) {
    return _selfHostedClient;
  }

  if (!url || !anonKey) {
    console.warn("Self-hosted Supabase not configured, falling back to Cloud");
    return cloudClient;
  }

  _selfHostedClient = createClient(url, anonKey, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  _cachedUrl = url;
  _cachedKey = anonKey;
  return _selfHostedClient;
}

/**
 * Returns the currently active Supabase client based on the selected mode.
 */
export function getActiveClient(): SupabaseClient {
  return getBackendMode() === "self-hosted" ? getSelfHostedClient() : cloudClient;
}

/**
 * Convenience export — use this everywhere instead of the raw cloud client.
 * Note: This is a function call, not a static reference, because the client
 * can change at runtime when the user switches modes.
 */
export { cloudClient };
