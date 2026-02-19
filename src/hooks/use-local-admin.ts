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

export function verifyLocalAdminCredentials(username: string, password: string): boolean {
  return username === "admin" && password === "admin";
}
