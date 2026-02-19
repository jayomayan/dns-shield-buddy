// Local admin session helpers
// Provides a hardcoded admin/admin fallback login used when Okta SSO is not enabled.
// Can be disabled from Settings once Okta is verified working.

const LOCAL_ADMIN_SESSION_KEY = "local_admin_session";
const LOCAL_ADMIN_ENABLED_KEY = "local_admin_enabled";
const SESSION_TTL_MS          = 8 * 60 * 60 * 1000; // 8 hours

// ─── Enabled flag ──────────────────────────────────────────────────────────────

export function isLocalAdminEnabled(): boolean {
  try {
    const val = localStorage.getItem(LOCAL_ADMIN_ENABLED_KEY);
    // Default to enabled if never set
    return val === null ? true : val === "true";
  } catch { return true; }
}

export function setLocalAdminEnabled(enabled: boolean): void {
  try { localStorage.setItem(LOCAL_ADMIN_ENABLED_KEY, String(enabled)); } catch {}
}

// ─── Session ──────────────────────────────────────────────────────────────────

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

// ─── Credentials ──────────────────────────────────────────────────────────────

const ADMIN_PASSWORD_HASH_KEY = "local_admin_password_hash";

/** SHA-256 hash (hex) of the default password "admin" */
const DEFAULT_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";

/** Hash a plaintext password using SHA-256 via Web Crypto API */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Return the stored hash, or the default "admin" hash if never set */
export function getAdminPasswordHash(): string {
  try {
    return localStorage.getItem(ADMIN_PASSWORD_HASH_KEY) || DEFAULT_PASSWORD_HASH;
  } catch {
    return DEFAULT_PASSWORD_HASH;
  }
}

/** Persist a new password hash */
export function setAdminPasswordHash(hash: string): void {
  try {
    localStorage.setItem(ADMIN_PASSWORD_HASH_KEY, hash);
  } catch {}
}

/** Verify credentials asynchronously against the stored hash */
export async function verifyLocalAdminCredentials(username: string, password: string): Promise<boolean> {
  if (username !== "admin") return false;
  const hash = await hashPassword(password);
  return hash === getAdminPasswordHash();
}

