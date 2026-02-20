// Okta OIDC — Authorization Code flow with Client Secret (no PKCE)
// Config (domain, clientId, clientSecret, enabled) comes from DB-backed settings store.
// Session tokens and CSRF state remain in localStorage (ephemeral, per-browser).

import { getConfig, saveConfig } from "@/lib/settings-store";

const OKTA_SESSION_KEY = "okta_session";
const OKTA_STATE_KEY   = "okta_state";

// ─── Config (from DB) ─────────────────────────────────────────────────────────

export interface OktaConfig {
  domain:        string;
  clientId:      string;
  clientSecret?: string;
  enabled:       boolean;
}

export function getOktaConfig(): OktaConfig | null {
  const cfg = getConfig();
  if (!cfg.okta_domain && !cfg.okta_client_id) return null;
  return {
    domain:       cfg.okta_domain || "",
    clientId:     cfg.okta_client_id || "",
    clientSecret: cfg.okta_client_secret || undefined,
    enabled:      cfg.okta_enabled,
  };
}

export function saveOktaConfig(cfg: OktaConfig): void {
  saveConfig({
    okta_domain:        cfg.domain,
    okta_client_id:     cfg.clientId,
    okta_client_secret: cfg.clientSecret || null,
    okta_enabled:       cfg.enabled,
  });
}

export function clearOktaConfig(): void {
  saveConfig({
    okta_domain: null,
    okta_client_id: null,
    okta_client_secret: null,
    okta_enabled: false,
  });
}

// ─── Session (localStorage — per-browser) ─────────────────────────────────────

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

  const redirectUri  = `${window.location.origin}/auth/callback`;

  const proxyUrl = import.meta.env.VITE_OKTA_PROXY_URL as string | undefined;
  const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey  = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const fetchUrl = proxyUrl
    ? `${proxyUrl.replace(/\/$/, "")}/okta-token`
    : `${supabaseUrl}/functions/v1/okta-token`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!proxyUrl) {
    headers["apikey"] = supabaseKey;
    headers["Authorization"] = `Bearer ${supabaseKey}`;
  }

  const res = await fetch(fetchUrl, {
    method:  "POST",
    headers,
    body: JSON.stringify({
      code,
      redirectUri,
      domain:       config.domain,
      clientId:     config.clientId,
      clientSecret: config.clientSecret || "",
    }),
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
