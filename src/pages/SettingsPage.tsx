import { useState, useRef, useEffect, useCallback } from "react";
import { Save, Key, Shield, FileText, Bell, Plus, Trash2, Copy, Check, Eye, EyeOff, Server, CheckCircle2, XCircle, Loader2, AlertTriangle, Info, Lock, Download, Upload, Database, LogIn, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useBridgeUrl, getBridgeHeaders } from "@/hooks/use-bridge-url";
import { saveOktaConfig, startOktaLogin } from "@/hooks/use-okta-session";
import { setLocalAdminEnabled as persistLocalAdminEnabled, hashPassword, setAdminPasswordHash, getAdminPasswordHash } from "@/hooks/use-local-admin";
import { User } from "@supabase/supabase-js";
import { Json } from "@/integrations/supabase/types";
import { getConfig, saveConfig, reloadConfig, type AppConfig } from "@/lib/settings-store";

interface EndpointResult {
  path: string;
  label: string;
  method: "GET" | "POST";
  status: "pending" | "checking" | "ok" | "fail";
  latency: number | null;
  httpCode: number | null;
  error: string | null;
}

const ENDPOINTS: Omit<EndpointResult, "status" | "latency" | "httpCode" | "error">[] = [
  { path: "/stats", label: "Stats", method: "GET" },
  { path: "/info",  label: "System Info", method: "GET" },
  { path: "/logs",  label: "Query Logs", method: "GET" },
  { path: "/ping",  label: "DNS Ping", method: "GET" },
  { path: "/cache/flush", label: "Cache Flush", method: "POST" },
  { path: "/rules", label: "Rules Sync", method: "POST" },
];

async function testEndpoint(baseUrl: string, ep: typeof ENDPOINTS[0]): Promise<EndpointResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}${ep.path}`, {
      method: ep.method === "POST" ? "POST" : "GET",
      headers: {
        ...getBridgeHeaders(),
        ...(ep.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: ep.method === "POST" ? JSON.stringify({}) : undefined,
      signal: AbortSignal.timeout(4000),
    });
    const latency = Date.now() - start;
    const ok = res.ok || res.status === 400;
    return { ...ep, status: ok ? "ok" : "fail", latency, httpCode: res.status, error: ok ? null : `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ...ep, status: "fail", latency: null, httpCode: null, error: e instanceof Error ? (e.name === "TimeoutError" ? "Timeout" : "Unreachable") : "Unreachable" };
  }
}

interface ApiToken {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  scopes: string[];
}

const SCOPES = ["dns:read", "dns:write", "rules:read", "rules:write", "logs:read", "monitoring:read", "config:read", "config:write"];

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "dng_";
  let result = "";
  for (let i = 0; i < 48; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return prefix + result;
}

// ── Settings shape ────────────────────────────────────────────────────────────
interface AppSettings {
  bridge_url?: string | null;
  bridge_api_key?: string | null;
  okta_domain?: string | null;
  okta_client_id?: string | null;
  okta_client_secret?: string | null;
  okta_enabled?: boolean;
  api_tokens?: Json | null;
  log_retention?: string;
  log_rotation?: string;
  log_max_size?: string;
  notify_blocked?: boolean;
  notify_service?: boolean;
}

// ── Settings helpers using global store ───────────────────────────────────────

function loadSettingsFromStore(): AppSettings {
  const cfg = getConfig();
  return {
    bridge_url: cfg.bridge_url,
    bridge_api_key: cfg.bridge_api_key,
    okta_domain: cfg.okta_domain,
    okta_client_id: cfg.okta_client_id,
    okta_client_secret: cfg.okta_client_secret,
    okta_enabled: cfg.okta_enabled,
    api_tokens: cfg.api_tokens as Json,
    log_retention: cfg.log_retention,
    log_rotation: cfg.log_rotation,
    log_max_size: cfg.log_max_size,
    notify_blocked: cfg.notify_blocked,
    notify_service: cfg.notify_service,
  };
}

async function saveSettingsToStore(patch: AppSettings): Promise<boolean> {
  return saveConfig(patch as Partial<AppConfig>);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SettingsPage({ user }: { user: User | null }) {
  // Bridge connection (URL + key stored in localStorage only for bootstrapping)
  const { url: bridgeUrl, setUrl: setBridgeUrlState, apiKey: bridgeApiKey, setApiKey: setBridgeApiKeyState } = useBridgeUrl();
  const [bridgeInput, setBridgeInput] = useState(bridgeUrl);
  const [apiKeyInput, setApiKeyInput] = useState(bridgeApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpointResults, setEndpointResults] = useState<EndpointResult[] | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Okta state
  const [oktaDomain, setOktaDomain] = useState("");
  const [oktaClientId, setOktaClientId] = useState("");
  const [oktaSecret, setOktaSecret] = useState("");
  const [oktaEnabled, setOktaEnabled] = useState(false);
  const [oktaTesting, setOktaTesting] = useState(false);
  const [oktaTestResult, setOktaTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Local admin state
  const [localAdminEnabled, setLocalAdminEnabled] = useState(() => {
    try {
      const v = localStorage.getItem("local_admin_enabled");
      return v === null ? true : v === "true";
    } catch { return true; }
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [hasCustomPassword, setHasCustomPassword] = useState(() => {
    const DEFAULT_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
    return getAdminPasswordHash() !== DEFAULT_HASH;
  });

  const changeAdminPassword = async () => {
    if (!newAdminPassword) return;
    if (newAdminPassword !== confirmAdminPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must be identical.", variant: "destructive" });
      return;
    }
    if (newAdminPassword.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const hash = await hashPassword(newAdminPassword);
      setAdminPasswordHash(hash);
      setHasCustomPassword(true);
      setNewAdminPassword("");
      setConfirmAdminPassword("");
      setShowChangePassword(false);
      toast({ title: "Password updated", description: "Local admin password has been changed. Use it on next login." });
    } finally {
      setChangingPassword(false);
    }
  };

  // Log + notification state
  const [logRetention, setLogRetention] = useState("30");
  const [logRotation, setLogRotation] = useState("daily");
  const [maxLogSize, setMaxLogSize] = useState("500");
  const [notifyBlocked, setNotifyBlocked] = useState(true);
  const [notifyService, setNotifyService] = useState(true);

  // API Tokens
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenExpiry, setNewTokenExpiry] = useState("90");
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>(["dns:read"]);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [justCreatedToken, setJustCreatedToken] = useState<string | null>(null);

  // ── Load all settings from Supabase on mount ─────────────────────────────
  const applySettings = useCallback((s: AppSettings) => {
    if (s.okta_domain)        setOktaDomain(s.okta_domain);
    if (s.okta_client_id)     setOktaClientId(s.okta_client_id);
    if (s.okta_client_secret) setOktaSecret(s.okta_client_secret);
    if (s.okta_enabled !== undefined) setOktaEnabled(!!s.okta_enabled);
    if (s.okta_domain && s.okta_client_id) {
      saveOktaConfig({
        domain:       s.okta_domain,
        clientId:     s.okta_client_id,
        clientSecret: s.okta_client_secret || undefined,
        enabled:      !!s.okta_enabled,
      });
    }
    if (s.log_retention) setLogRetention(s.log_retention);
    if (s.log_rotation)  setLogRotation(s.log_rotation);
    if (s.log_max_size)  setMaxLogSize(s.log_max_size);
    if (s.notify_blocked !== undefined) setNotifyBlocked(!!s.notify_blocked);
    if (s.notify_service !== undefined) setNotifyService(!!s.notify_service);

    // Bridge URL/key come from settings
    if (s.bridge_url)     { setBridgeUrlState(s.bridge_url);    setBridgeInput(s.bridge_url); }
    if (s.bridge_api_key) { setBridgeApiKeyState(s.bridge_api_key); setApiKeyInput(s.bridge_api_key); }
    if (s.api_tokens) {
      try { setTokens(s.api_tokens as unknown as ApiToken[]); } catch { /* ignore */ }
    }
  }, [setBridgeUrlState, setBridgeApiKeyState]);

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    setLoadError(null);
    try {
      await reloadConfig();
      const s = loadSettingsFromStore();
      applySettings(s);
    } catch {
      setLoadError("Could not load settings. Check your database instance is running.");
    }
    setLoadingSettings(false);
  }, [applySettings]);

  useEffect(() => {
    // Settings already loaded by SettingsLoader — just apply them
    const s = loadSettingsFromStore();
    applySettings(s);
    setLoadingSettings(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to DB ───────────────────────────────────────────────────────
  const saveToSupabase = useCallback(async (patch: AppSettings): Promise<boolean> => {
    const ok = await saveSettingsToStore(patch);
    if (!ok) toast({ title: "Save failed", description: "Could not save settings. Check your database instance.", variant: "destructive" });
    return ok;
  }, []);

  const exportConfig = () => {
    const config: Record<string, unknown> = {
      _version: 3,
      _exportedAt: new Date().toISOString(),
      bridge_url: bridgeInput,
      bridge_api_key: apiKeyInput,
      okta_domain: oktaDomain,
      okta_client_id: oktaClientId,
      okta_client_secret: oktaSecret,
      okta_enabled: oktaEnabled,
      api_tokens: tokens,
      log_retention: logRetention,
      log_rotation: logRotation,
      log_max_size: maxLogSize,
      notify_blocked: notifyBlocked,
      notify_service: notifyService,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dns-shield-config-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Config exported", description: "Your configuration has been saved as a JSON file." });
  };

  const importConfig = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid format");
        const payload: AppSettings = {
          bridge_url: parsed.bridge_url || null,
          bridge_api_key: parsed.bridge_api_key || null,
          okta_domain: parsed.okta_domain || null,
          okta_client_id: parsed.okta_client_id || null,
          okta_client_secret: parsed.okta_client_secret || null,
          okta_enabled: parsed.okta_enabled ?? false,
          api_tokens: parsed.api_tokens ?? null,
          log_retention: parsed.log_retention || "30",
          log_rotation: parsed.log_rotation || "daily",
          log_max_size: parsed.log_max_size || "500",
          notify_blocked: parsed.notify_blocked ?? true,
          notify_service: parsed.notify_service ?? true,
        };
        applySettings(payload);
        const ok = await saveToSupabase(payload);
        if (ok) toast({ title: "Config imported", description: "Settings restored and saved to Supabase." });
      } catch {
        setImportError("Invalid config file — make sure you're using a file exported from DNS Shield.");
      }
    };
    reader.readAsText(file);
  };

  const runEndpointTests = async () => {
    setIsTesting(true);
    const base = bridgeInput.replace(/\/$/, "");
    setEndpointResults(ENDPOINTS.map((ep) => ({ ...ep, status: "checking", latency: null, httpCode: null, error: null })));
    const results = await Promise.all(ENDPOINTS.map((ep) => testEndpoint(base, ep)));
    setEndpointResults(results);
    setIsTesting(false);
  };

  const saveBridgeConnection = async () => {
    // 1. Update localStorage so subsequent bridge calls use the new URL/key immediately
    setBridgeUrlState(bridgeInput);
    setBridgeApiKeyState(apiKeyInput);
    // 2. Persist to Supabase
    const ok = await saveToSupabase({ bridge_url: bridgeInput || null, bridge_api_key: apiKeyInput || null });
    if (ok) {
      toast({ title: "Bridge settings saved", description: "Connection settings saved to Supabase." });
    }
  };

  interface OktaCheckStep {
    label: string;
    status: "pending" | "checking" | "ok" | "fail" | "warn";
    detail: string | null;
  }

  const [oktaCheckSteps, setOktaCheckSteps] = useState<OktaCheckStep[] | null>(null);

  const updateStep = (steps: OktaCheckStep[], idx: number, patch: Partial<OktaCheckStep>) => {
    const next = [...steps];
    next[idx] = { ...next[idx], ...patch };
    setOktaCheckSteps([...next]);
    return next;
  };

  const testOktaIntegration = async () => {
    const domain    = oktaDomain.trim().replace(/\/$/, "");
    const clientId  = oktaClientId.trim();

    if (!domain) {
      toast({ title: "Missing Okta Domain", description: "Enter your Okta domain before testing.", variant: "destructive" });
      return;
    }

    const steps: OktaCheckStep[] = [
      { label: "Domain format",        status: "pending", detail: null },
      { label: "Client ID format",     status: "pending", detail: null },
      { label: "OIDC discovery",       status: "pending", detail: null },
      { label: "Authorization endpoint", status: "pending", detail: null },
      { label: "Token endpoint",       status: "pending", detail: null },
    ];
    setOktaCheckSteps([...steps]);
    setOktaTesting(true);
    setOktaTestResult(null);

    let s = updateStep(steps, 0, { status: "checking" });
    const domainRe = /^https:\/\/[a-zA-Z0-9-]+\.(okta\.com|okta\.eu|oktapreview\.com|okta-emea\.com)(\/oauth2\/[\w-]+)?$/;
    if (domainRe.test(domain)) {
      s = updateStep(s, 0, { status: "ok", detail: domain });
    } else if (domain.startsWith("http://")) {
      s = updateStep(s, 0, { status: "fail", detail: "Must use https://" });
    } else {
      s = updateStep(s, 0, { status: "warn", detail: "Unusual domain — custom auth server?" });
    }

    s = updateStep(s, 1, { status: "checking" });
    const clientIdRe = /^[a-zA-Z0-9]{20}$/;
    if (!clientId) {
      s = updateStep(s, 1, { status: "warn", detail: "Client ID is empty — needed for login" });
    } else if (clientIdRe.test(clientId)) {
      s = updateStep(s, 1, { status: "ok", detail: clientId.slice(0, 6) + "••••••••••••••" });
    } else {
      s = updateStep(s, 1, { status: "warn", detail: "Unexpected format — Okta Client IDs are 20 alphanumeric chars" });
    }

    s = updateStep(s, 2, { status: "checking" });
    let oidcMeta: Record<string, string> = {};
    try {
      const res = await fetch(`${domain}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        oidcMeta = await res.json();
        s = updateStep(s, 2, { status: "ok", detail: `issuer: ${oidcMeta.issuer ?? domain}` });
      } else {
        s = updateStep(s, 2, { status: "fail", detail: `HTTP ${res.status} — check domain or auth server path` });
        s = updateStep(s, 3, { status: "fail", detail: "Skipped — discovery failed" });
        s = updateStep(s, 4, { status: "fail", detail: "Skipped — discovery failed" });
        setOktaTestResult({ ok: false, message: "OIDC discovery failed. Check your domain URL." });
        setOktaTesting(false);
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error && e.name === "TimeoutError" ? "Timeout — domain unreachable" : "Unreachable — check domain or CORS";
      s = updateStep(s, 2, { status: "fail", detail: msg });
      s = updateStep(s, 3, { status: "fail", detail: "Skipped" });
      s = updateStep(s, 4, { status: "fail", detail: "Skipped" });
      setOktaTestResult({ ok: false, message: msg });
      setOktaTesting(false);
      return;
    }

    s = updateStep(s, 3, { status: "checking" });
    if (oidcMeta.authorization_endpoint) {
      s = updateStep(s, 3, { status: "ok", detail: oidcMeta.authorization_endpoint });
    } else {
      s = updateStep(s, 3, { status: "fail", detail: "authorization_endpoint missing from metadata" });
    }

    s = updateStep(s, 4, { status: "checking" });
    if (oidcMeta.token_endpoint) {
      s = updateStep(s, 4, { status: "ok", detail: oidcMeta.token_endpoint });
    } else {
      s = updateStep(s, 4, { status: "fail", detail: "token_endpoint missing from metadata" });
    }

    const allOk = s.every((st) => st.status === "ok" || st.status === "warn");
    setOktaTestResult({
      ok: allOk,
      message: allOk
        ? "Okta domain is reachable and OIDC is configured correctly."
        : "Some checks failed — review the details above.",
    });
    setOktaTesting(false);
  };

  const testOktaLogin = async () => {
    const domain   = oktaDomain.trim();
    const clientId = oktaClientId.trim();
    if (!domain || !clientId) {
      toast({ title: "Missing fields", description: "Enter Okta Domain and Client ID before testing login.", variant: "destructive" });
      return;
    }
    saveOktaConfig({ domain, clientId, clientSecret: oktaSecret.trim() || undefined, enabled: false });
    try {
      await startOktaLogin({ domain, clientId, clientSecret: oktaSecret.trim() || undefined, enabled: false });
    } catch (e: unknown) {
      toast({ title: "Login test failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const toggleScope = (scope: string) => {
    setNewTokenScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const persistTokens = async (updated: ApiToken[]) => {
    setTokens(updated);
    await saveToSupabase({ api_tokens: updated as unknown as AppSettings["api_tokens"] });
  };

  const createToken = async () => {
    if (!newTokenName.trim()) return;
    const token: ApiToken = {
      id: `tok-${Date.now()}`,
      name: newTokenName.trim(),
      token: generateToken(),
      createdAt: new Date().toISOString().split("T")[0],
      lastUsed: null,
      expiresAt: newTokenExpiry === "never" ? null : new Date(Date.now() + +newTokenExpiry * 86400000).toISOString().split("T")[0],
      scopes: [...newTokenScopes],
    };
    const updated = [token, ...tokens];
    await persistTokens(updated);
    setJustCreatedToken(token.id);
    setRevealedTokens((prev) => new Set(prev).add(token.id));
    setNewTokenName("");
    setNewTokenScopes(["dns:read"]);
    setNewTokenExpiry("90");
    setShowCreateToken(false);
    setTimeout(() => setJustCreatedToken(null), 10000);
    toast({ title: "Token created", description: "API token saved to Supabase." });
  };

  const revokeToken = async (id: string) => {
    await persistTokens(tokens.filter((t) => t.id !== id));
    toast({ title: "Token revoked", description: "API token removed." });
  };

  const copyToken = (id: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const inputClass = "w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Settings source banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">
          All settings are stored in your local Supabase instance.
        </span>
        {loadingSettings ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <button onClick={fetchSettings} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
        )}
      </div>

      {loadError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-warning/5 border border-warning/20 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{loadError} Settings shown are defaults until Supabase is reachable.</span>
        </div>
      )}

      {/* Bridge Connection */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Unbound Bridge Connection</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          URL of the HTTP bridge running on your GCP VM alongside Unbound. Used for operational tasks (stats, logs, rules).
          Use your VM's public IP (e.g.{" "}
          <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">http://1.2.3.4/api</code>) or{" "}
          <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">http://localhost:8080</code> if the browser runs on the same machine.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={bridgeInput}
            onChange={(e) => setBridgeInput(e.target.value)}
            placeholder="http://your-vm-ip:8080"
            className={inputClass + " flex-1"}
          />
          <button
            onClick={runEndpointTests}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isTesting ? "Testing…" : "Test Connection"}
          </button>
          <button
            onClick={saveBridgeConnection}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>

        {/* Bridge API Key */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <label className="text-xs font-medium text-muted-foreground">Bridge API Key</label>
            {bridgeApiKey && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-success/10 text-success border border-success/20">Active</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Leave blank for no authentication"
              className={inputClass + " flex-1 font-mono"}
            />
            <button onClick={() => setShowApiKey((v) => !v)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Sent as <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> on every bridge request.
            Set the same key in <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">BRIDGE_API_KEY</code> env var on the server.
          </p>
        </div>

        <AnimatePresence>
          {endpointResults && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border border-border rounded-lg divide-y divide-border">
                {endpointResults.map((ep) => (
                  <div key={ep.path} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      {ep.status === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {ep.status === "ok"       && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                      {ep.status === "fail"     && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      <span className="font-medium">{ep.label}</span>
                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {ep.method} {ep.path}
                      </code>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {ep.httpCode !== null && (
                        <span className={ep.status === "ok" ? "text-success" : "text-destructive"}>
                          HTTP {ep.httpCode}
                        </span>
                      )}
                      {ep.latency !== null && <span>{ep.latency}ms</span>}
                      {ep.error && ep.status !== "checking" && (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {ep.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {endpointResults.some((r) => r.status === "fail") && !isTesting && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <Info className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                  <p className="text-[11px] text-warning leading-relaxed">
                    Some endpoints are unreachable. Make sure the bridge service is running on your VM and the URL/port are correct.
                  </p>
                </div>
              )}
              {endpointResults.every((r) => r.status === "ok") && !isTesting && (
                <p className="mt-3 text-[11px] text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All endpoints reachable — dashboard will switch to live data.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Okta SSO */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Okta SSO Configuration</h3>
            <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20 ml-2">Platform Users</span>
            {oktaEnabled && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-success/10 text-success border border-success/20">Enabled</span>
            )}
          </div>
          <button
            onClick={async () => {
              if (!oktaDomain.trim() || !oktaClientId.trim()) {
                toast({ title: "Missing fields", description: "Fill in Okta Domain and Client ID before saving.", variant: "destructive" });
                return;
              }
              const cfg = { domain: oktaDomain.trim(), clientId: oktaClientId.trim(), clientSecret: oktaSecret.trim() || undefined, enabled: true };
              setOktaEnabled(true);
              saveOktaConfig(cfg);
              const ok = await saveToSupabase({
                okta_domain: oktaDomain.trim(),
                okta_client_id: oktaClientId.trim(),
                okta_client_secret: oktaSecret.trim() || null,
                okta_enabled: true,
              });
              if (ok) toast({ title: "Okta SSO saved", description: "Saved to Supabase. SSO is now active." });
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Save & Enable
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Configure Okta Single Sign-On for platform user authentication.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Okta Domain</label>
            <input value={oktaDomain} onChange={(e) => setOktaDomain(e.target.value)} placeholder="https://your-org.okta.com" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Client ID</label>
              <input value={oktaClientId} onChange={(e) => setOktaClientId(e.target.value)} placeholder="0oa1b2c3d4EXAMPLE" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Client Secret
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">(Web / confidential apps only)</span>
              </label>
              <input type="password" value={oktaSecret} onChange={(e) => setOktaSecret(e.target.value)} placeholder="Leave blank for SPA / PKCE public clients" className={inputClass} />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
            <div>
              <span className="font-medium text-foreground">Which client type are you using?</span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li><span className="font-medium">SPA (Single-Page App)</span> — leave Client Secret blank. Set "Client authentication" to <code className="bg-muted px-1 rounded">None (PKCE)</code> in Okta.</li>
                <li><span className="font-medium">Web App (confidential)</span> — paste the Client Secret. Set "Client authentication" to <code className="bg-muted px-1 rounded">Client secret</code> in Okta.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={testOktaIntegration}
              disabled={oktaTesting}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {oktaTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {oktaTesting ? "Checking…" : "Verify Connection"}
            </button>
            <button
              onClick={testOktaLogin}
              disabled={oktaTesting}
              className="flex items-center gap-1.5 px-3 py-2 border border-primary/30 bg-primary/5 text-primary rounded-lg text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <LogIn className="h-3.5 w-3.5" />
              Test Login
            </button>
            <span className="text-[11px] text-muted-foreground">
              "Test Login" will redirect you to Okta and back — save your settings first.
            </span>
          </div>

          <AnimatePresence>
            {oktaCheckSteps && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-border rounded-lg divide-y divide-border">
                  {oktaCheckSteps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        {step.status === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                        {step.status === "ok"       && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                        {step.status === "warn"     && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                        {step.status === "fail"     && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        {step.status === "pending"  && <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />}
                        <span className="font-medium">{step.label}</span>
                      </div>
                      {step.detail && (
                        <span className={`font-mono text-[10px] truncate max-w-[280px] ${
                          step.status === "ok"   ? "text-success" :
                          step.status === "warn" ? "text-warning" :
                          step.status === "fail" ? "text-destructive" :
                          "text-muted-foreground"
                        }`}>
                          {step.detail}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {oktaTestResult && !oktaTesting && (
                  <div className={`flex items-center gap-2 mt-3 p-3 rounded-lg border text-xs ${
                    oktaTestResult.ok
                      ? "bg-success/5 border-success/20 text-success"
                      : "bg-destructive/5 border-destructive/20 text-destructive"
                  }`}>
                    {oktaTestResult.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                    <span>{oktaTestResult.message}</span>
                    {oktaTestResult.ok && (
                      <a
                        href={`${oktaDomain.trim()}/.well-known/openid-configuration`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" /> OIDC metadata
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {oktaEnabled ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <p className="text-xs text-success">Okta SSO is active — enterprise authentication enforced.</p>
              </div>
              <button
                onClick={async () => {
                  setOktaEnabled(false);
                  saveOktaConfig({ domain: oktaDomain, clientId: oktaClientId, clientSecret: oktaSecret || undefined, enabled: false });
                  await saveToSupabase({ okta_enabled: false });
                  toast({ title: "Okta disabled", description: "SSO has been disabled." });
                }}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors ml-4 shrink-0"
              >
                Disable
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <Shield className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">Okta not configured — temporary admin access enabled.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Local Admin */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Local Admin Login</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] border ml-2 ${localAdminEnabled ? "bg-warning/10 text-warning border-warning/20" : "bg-muted text-muted-foreground border-border"}`}>
              {localAdminEnabled ? "Enabled" : "Disabled"}
            </span>
            {hasCustomPassword && (
              <span className="px-2 py-0.5 rounded text-[10px] bg-success/10 text-success border border-success/20">Custom password set</span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Fallback login (username: <code className="font-mono bg-muted px-1 rounded text-[11px]">admin</code>) used when Okta SSO is not active.
          Default password is <code className="font-mono bg-muted px-1 rounded text-[11px]">admin</code> — change it below.
        </p>

        <div className="space-y-3">
          {localAdminEnabled ? (
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-warning">Local admin is active</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {hasCustomPassword
                      ? "Custom password is set. Disable after Okta is confirmed working."
                      : "Using default password (admin). Set a custom password below for better security."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setLocalAdminEnabled(false);
                  persistLocalAdminEnabled(false);
                  toast({ title: "Local admin disabled", description: "Okta SSO is now the only login method." });
                }}
                className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                Disable
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <p className="text-xs text-success">Local admin login is disabled — SSO enforced.</p>
              </div>
              <button
                onClick={() => {
                  setLocalAdminEnabled(true);
                  persistLocalAdminEnabled(true);
                  toast({ title: "Local admin re-enabled", description: "Fallback admin login is active again." });
                }}
                className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Re-enable
              </button>
            </div>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowChangePassword((v) => !v)}
              className="flex items-center justify-between w-full px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5" />
                {hasCustomPassword ? "Change Admin Password" : "Set Admin Password"}
              </span>
              <span className="text-[10px] text-muted-foreground">{showChangePassword ? "▲" : "▼"}</span>
            </button>

            <AnimatePresence>
              {showChangePassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                      Password is hashed with SHA-256 and stored locally in this browser. Minimum 8 characters.
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className={inputClass + " pr-9"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmAdminPassword}
                          onChange={(e) => setConfirmAdminPassword(e.target.value)}
                          placeholder="Repeat password"
                          className={inputClass + " pr-9"}
                          onKeyDown={(e) => { if (e.key === "Enter") changeAdminPassword(); }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={changeAdminPassword}
                        disabled={changingPassword || !newAdminPassword || !confirmAdminPassword}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {changingPassword ? "Saving…" : "Update Password"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Password hash is stored in this browser's local storage. Disabling requires a page reload to take effect for existing sessions.</span>
          </div>
        </div>
      </motion.div>

      {/* API Tokens */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">API Tokens</h3>
            <span className="px-2 py-0.5 rounded text-[10px] bg-accent/10 text-accent border border-accent/20 ml-2">API Access</span>
          </div>
          <button onClick={() => setShowCreateToken(!showCreateToken)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Create Token
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Generate tokens for API authentication. Tokens are persisted to Supabase.</p>

        <AnimatePresence>
          {showCreateToken && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border border-primary/20 rounded-lg p-4 mb-4 bg-primary/5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Token Name</label>
                    <input value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} placeholder="e.g. CI/CD Pipeline" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Expires In</label>
                    <select value={newTokenExpiry} onChange={(e) => setNewTokenExpiry(e.target.value)} className={inputClass + " font-sans"}>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="180">180 days</option>
                      <option value="365">1 year</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">Scopes</label>
                  <div className="flex flex-wrap gap-2">
                    {SCOPES.map((scope) => (
                      <button
                        key={scope}
                        onClick={() => toggleScope(scope)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                          newTokenScopes.includes(scope)
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCreateToken(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button onClick={createToken} disabled={!newTokenName.trim() || newTokenScopes.length === 0} className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Key className="h-3.5 w-3.5" /> Generate Token
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className={`border rounded-lg p-4 transition-colors ${justCreatedToken === token.id ? "border-success/40 bg-success/5" : "border-border"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{token.name}</span>
                  {justCreatedToken === token.id && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-success/10 text-success border border-success/20 animate-pulse">NEW — copy now</span>
                  )}
                </div>
                <button onClick={() => revokeToken(token.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                  <Trash2 className="h-3 w-3" /> Revoke
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 text-xs font-mono bg-muted px-3 py-1.5 rounded border border-border truncate">
                  {revealedTokens.has(token.id) ? token.token : "dng_" + "•".repeat(40)}
                </code>
                <button onClick={() => toggleReveal(token.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  {revealedTokens.has(token.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => copyToken(token.id, token.token)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  {copiedToken === token.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>Created: {token.createdAt}</span>
                <span>Last used: {token.lastUsed || "Never"}</span>
                <span>Expires: {token.expiresAt || "Never"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {token.scopes.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">{s}</span>
                ))}
              </div>
            </div>
          ))}
          {tokens.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">No API tokens created. Click "Create Token" to generate one.</div>
          )}
        </div>
      </motion.div>

      {/* Log Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Query Logging</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Configure DNS query log retention and rotation policies.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Retention (days)</label>
              <input type="number" value={logRetention} onChange={(e) => setLogRetention(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Rotation</label>
              <select value={logRotation} onChange={(e) => setLogRotation(e.target.value)} className={inputClass + " font-sans"}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Max Size (MB)</label>
              <input type="number" value={maxLogSize} onChange={(e) => setMaxLogSize(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={async () => {
                const ok = await saveToSupabase({ log_retention: logRetention, log_rotation: logRotation, log_max_size: maxLogSize });
                if (ok) toast({ title: "Log settings saved", description: "Saved to Supabase." });
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Alert preferences for DNS events.</p>
        <div className="space-y-3">
          {[
            { label: "High blocked query volume alerts", key: "notify_blocked", checked: notifyBlocked, onChange: async (v: boolean) => { setNotifyBlocked(v); await saveToSupabase({ notify_blocked: v }); } },
            { label: "Service status change alerts", key: "notify_service", checked: notifyService, onChange: async (v: boolean) => { setNotifyService(v); await saveToSupabase({ notify_service: v }); } },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
              <button onClick={() => item.onChange(!item.checked)} className={`relative w-10 h-5 rounded-full transition-colors ${item.checked ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-all ${item.checked ? "left-5" : "left-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </motion.div>

      {/* Import / Export Config */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Backup &amp; Restore</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Export your configuration as JSON. Import it to restore all settings — they will be saved to Supabase.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={exportConfig}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <Download className="h-4 w-4" /> Export Config
          </button>

          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="h-4 w-4" /> Import Config
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importConfig(file);
              e.target.value = "";
            }}
          />
        </div>

        {importError && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {importError}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          Exported file contains: bridge URL, API key, Okta config, log settings, and notification preferences. API tokens are included when exported.
        </p>
      </motion.div>
    </div>
  );
}
