// Simple Okta OIDC — Authorization Code flow with Client Secret (no PKCE)

const OKTA_CONFIG_KEY  = "okta_config";
const OKTA_SESSION_KEY = "okta_session";
const OKTA_STATE_KEY   = "okta_state";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface OktaConfig {
  domain:        string;  // e.g. https://dev-xxx.okta.com
  clientId:      string;
  clientSecret?: string;
  enabled:       boolean;
}

export function getOktaConfig(): OktaConfig | null {
  try {
    const raw = localStorage.getItem(OKTA_CONFIG_KEY);
    return raw ? JSON.parse(raw) as OktaConfig : null;
  } catch { return null; }
}

export function saveOktaConfig(cfg: OktaConfig): void {
  try { localStorage.setItem(OKTA_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
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
  expiresAt:   number;
}

export function getOktaSession(): OktaSession | null {
  try {
    const raw = localStorage.getItem(OKTA_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OktaSession;
    if (Date.now() > s.expiresAt) { localStorage.removeItem(OKTA_SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

export function storeOktaSession(session: OktaSession): void {
  try { localStorage.setItem(OKTA_SESSION_KEY, JSON.stringify(session)); } catch {}
}

export function clearOktaSession(): void {
  try { localStorage.removeItem(OKTA_SESSION_KEY); } catch {}
}

// ─── Login ────────────────────────────────────────────────────────────────────

export function startOktaLogin(config: OktaConfig): void {
  // Generate a random state value for CSRF protection
  const stateBytes = new Uint8Array(16);
  window.crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  localStorage.setItem(OKTA_STATE_KEY, state);

  const domain      = config.domain.replace(/\/$/, "");
  const redirectUri = `${window.location.origin}/auth/callback`;

  const params = new URLSearchParams({
    client_id:     config.clientId,
    response_type: "code",
    scope:         "openid profile email",
    redirect_uri:  redirectUri,
    state,
    nonce:         state,
  });

  window.location.href = `${domain}/oauth2/v1/authorize?${params}`;
}

// ─── Callback / token exchange ────────────────────────────────────────────────

export async function handleOktaCallback(
  code:   string,
  state:  string,
  config: OktaConfig,
): Promise<OktaSession> {
  const savedState = localStorage.getItem(OKTA_STATE_KEY);
  localStorage.removeItem(OKTA_STATE_KEY);

  if (savedState && state !== savedState) {
    throw new Error("State mismatch — possible CSRF attack. Please try again.");
  }

  const domain      = config.domain.replace(/\/$/, "");
  const redirectUri = `${window.location.origin}/auth/callback`;

  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    redirect_uri:  redirectUri,
    client_id:     config.clientId,
    ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
  });

  const res = await fetch(`${domain}/oauth2/v1/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error_description || `Token exchange failed (HTTP ${res.status})`);
  }

  const tokens = await res.json() as {
    access_token: string;
    id_token:     string;
    expires_in:   number;
  };

  // Decode JWT payload (no signature verification needed client-side)
  const [, payloadB64] = tokens.id_token.split(".");
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, string>;

  const session: OktaSession = {
    accessToken: tokens.access_token,
    idToken:     tokens.id_token,
    email:       payload.email || payload.sub || "unknown",
    name:        payload.name  || payload.email || "Unknown",
    expiresAt:   Date.now() + (tokens.expires_in ?? 3600) * 1000,
  };

  storeOktaSession(session);
  return session;
}
