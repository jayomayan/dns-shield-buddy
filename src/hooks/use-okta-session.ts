// Okta OIDC / PKCE authentication helpers
// Uses the Authorization Code + PKCE flow (no client_secret needed for public SPA clients).

const OKTA_CONFIG_KEY  = "okta_config";
const OKTA_SESSION_KEY = "okta_session";
const OKTA_PKCE_KEY    = "okta_pkce";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface OktaConfig {
  domain:   string;  // e.g. https://dev-xxx.okta.com
  clientId: string;
  enabled:  boolean;
}

export function getOktaConfig(): OktaConfig | null {
  try {
    const raw = localStorage.getItem(OKTA_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OktaConfig;
  } catch { return null; }
}

export function saveOktaConfig(cfg: OktaConfig): void {
  try {
    localStorage.setItem(OKTA_CONFIG_KEY, JSON.stringify(cfg));
  } catch {}
}

export function clearOktaConfig(): void {
  try { localStorage.removeItem(OKTA_CONFIG_KEY); } catch {}
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface OktaSession {
  accessToken: string;
  idToken:     string;
  email:       string;
  name:        string;
  expiresAt:   number; // unix ms
}

export function getOktaSession(): OktaSession | null {
  try {
    const raw = sessionStorage.getItem(OKTA_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OktaSession;
    if (Date.now() > s.expiresAt) {
      sessionStorage.removeItem(OKTA_SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

export function storeOktaSession(session: OktaSession): void {
  try { sessionStorage.setItem(OKTA_SESSION_KEY, JSON.stringify(session)); } catch {}
}

export function clearOktaSession(): void {
  try { sessionStorage.removeItem(OKTA_SESSION_KEY); } catch {}
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32);
  window.crypto.getRandomValues(arr);
  return base64urlEncode(arr.buffer);
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function startOktaLogin(config: OktaConfig): Promise<void> {
  const codeVerifier   = generateCodeVerifier();
  const codeChallenge  = base64urlEncode(await sha256(codeVerifier));
  const stateArr       = new Uint8Array(16);
  window.crypto.getRandomValues(stateArr);
  const state          = base64urlEncode(stateArr.buffer);

  sessionStorage.setItem(OKTA_PKCE_KEY, JSON.stringify({ codeVerifier, state }));

  const domain      = config.domain.replace(/\/$/, "");
  const redirectUri = `${window.location.origin}/auth/callback`;

  const params = new URLSearchParams({
    client_id:             config.clientId,
    response_type:         "code",
    scope:                 "openid profile email",
    redirect_uri:          redirectUri,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: "S256",
    nonce:                 state,
  });

  window.location.href = `${domain}/oauth2/v1/authorize?${params}`;
}

// ─── Callback / token exchange ────────────────────────────────────────────────

export async function handleOktaCallback(
  code:   string,
  state:  string,
  config: OktaConfig,
): Promise<OktaSession> {
  const pkceRaw = sessionStorage.getItem(OKTA_PKCE_KEY);
  if (!pkceRaw) throw new Error("No PKCE data found — please try signing in again.");
  const { codeVerifier, state: savedState } = JSON.parse(pkceRaw) as { codeVerifier: string; state: string };
  sessionStorage.removeItem(OKTA_PKCE_KEY);

  if (state !== savedState) throw new Error("State mismatch — possible CSRF attack. Please try again.");

  const domain      = config.domain.replace(/\/$/, "");
  const redirectUri = `${window.location.origin}/auth/callback`;

  const tokenRes = await fetch(`${domain}/oauth2/v1/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     config.clientId,
      code,
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error_description || `Token exchange failed (HTTP ${tokenRes.status})`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    id_token:     string;
    expires_in:   number;
  };

  // Decode id_token payload (JWT – no signature verification needed client-side)
  const [, payloadB64] = tokens.id_token.split(".");
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, string>;

  const session: OktaSession = {
    accessToken: tokens.access_token,
    idToken:     tokens.id_token,
    email:       payload.email  || payload.sub || "unknown",
    name:        payload.name   || payload.email || "Unknown",
    expiresAt:   Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };

  storeOktaSession(session);
  return session;
}
