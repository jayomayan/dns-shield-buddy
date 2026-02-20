// Local admin session helpers
// Config (enabled flag, password hash) comes from DB-backed settings store.
// Session tokens remain in localStorage (ephemeral, per-browser).

import { getConfig, saveConfig } from "@/lib/settings-store";

const LOCAL_ADMIN_SESSION_KEY = "local_admin_session";
const SESSION_TTL_MS          = 8 * 60 * 60 * 1000; // 8 hours

/** SHA-256 hash (hex) of the default password "admin" */
const DEFAULT_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

// ─── Enabled flag (from DB) ───────────────────────────────────────────────────

export function isLocalAdminEnabled(): boolean {
  return getConfig().local_admin_enabled;
}

export function setLocalAdminEnabled(enabled: boolean): void {
  saveConfig({ local_admin_enabled: enabled });
}

// ─── Session (localStorage — per-browser) ─────────────────────────────────────

export interface LocalAdminSession {
  username:  string;
  loggedInAt: number;
  expiresAt:  number;
}

export function getLocalAdminSession(): LocalAdminSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LocalAdminSession;
    if (Date.now() > s.expiresAt) {
      localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

export function storeLocalAdminSession(): void {
  const now = Date.now();
  const session: LocalAdminSession = {
    username:   "admin",
    loggedInAt: now,
    expiresAt:  now + SESSION_TTL_MS,
  };
  try { localStorage.setItem(LOCAL_ADMIN_SESSION_KEY, JSON.stringify(session)); } catch {}
}

export function clearLocalAdminSession(): void {
  try { localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY); } catch {}
}

// ─── Credentials (from DB) ────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getAdminPasswordHash(): string {
  return getConfig().admin_password_hash || DEFAULT_PASSWORD_HASH;
}

export function setAdminPasswordHash(hash: string): void {
  saveConfig({ admin_password_hash: hash });
}

export async function verifyLocalAdminCredentials(username: string, password: string): Promise<boolean> {
  if (username !== "admin") return false;
  const hash = await hashPassword(password);
  return hash === getAdminPasswordHash();
}
