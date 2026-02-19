import { useState, useRef, useEffect, useCallback } from "react";
import { Save, Key, RotateCcw, Shield, FileText, Bell, Plus, Trash2, Copy, Check, Eye, EyeOff, Server, CheckCircle2, XCircle, Loader2, AlertTriangle, Info, Lock, Download, Upload, Database, HardDrive, Wifi, LogIn } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useBridgeUrl, getBridgeHeaders, setDbConfig } from "@/hooks/use-bridge-url";
import { saveOktaConfig } from "@/hooks/use-okta-session";
import { User } from "@supabase/supabase-js";
import { useUserSettings } from "@/hooks/use-user-settings";

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
    // 200-299 and 400 (bad body for POST) are all "reachable"
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

export default function SettingsPage({ user }: { user: User | null }) {
  const { settings, loading: settingsLoading, saving, saveSettings } = useUserSettings(user);
  const { url: bridgeUrl, setUrl: setBridgeUrlState, apiKey: bridgeApiKey, setApiKey: setBridgeApiKeyState } = useBridgeUrl();
  const [bridgeInput, setBridgeInput] = useState(bridgeUrl);
  const [apiKeyInput, setApiKeyInput] = useState(bridgeApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpointResults, setEndpointResults] = useState<EndpointResult[] | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Database config state
  const [dbType, setDbType] = useState("local");
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState("5432");
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Okta state
  const [oktaDomain, setOktaDomain] = useState("");
  const [oktaClientId, setOktaClientId] = useState("");
  const [oktaSecret, setOktaSecret] = useState("");
  const [oktaEnabled, setOktaEnabled] = useState(false);
  const [oktaTesting, setOktaTesting] = useState(false);
  const [oktaTestResult, setOktaTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Log + notification state
  const [logRetention, setLogRetention] = useState("30");
  const [logRotation, setLogRotation] = useState("daily");
  const [maxLogSize, setMaxLogSize] = useState("500");
  const [notifyBlocked, setNotifyBlocked] = useState(true);
  const [notifyService, setNotifyService] = useState(true);

  // Sync from DB once loaded
  useEffect(() => {
    if (!settingsLoading) {
      setOktaDomain(settings.okta_domain || "");
      setOktaClientId(settings.okta_client_id || "");
      setOktaSecret(settings.okta_client_secret || "");
      setOktaEnabled(settings.okta_enabled);
      // Sync Okta config to localStorage so OktaGate can use it
      saveOktaConfig({
        domain:   settings.okta_domain || "",
        clientId: settings.okta_client_id || "",
        enabled:  settings.okta_enabled,
      });
      setLogRetention(settings.log_retention);
      setLogRotation(settings.log_rotation);
      setMaxLogSize(settings.log_max_size);
      setNotifyBlocked(settings.notify_blocked);
      setNotifyService(settings.notify_service);
      const loadedDbType = settings.db_type || "local";
      const loadedDbHost = settings.db_host || "";
      const loadedDbPort = settings.db_port || "5432";
      const loadedDbName = settings.db_name || "";
      const loadedDbUser = settings.db_user || "";
      const loadedDbPassword = settings.db_password || "";
      setDbType(loadedDbType);
      setDbHost(loadedDbHost);
      setDbPort(loadedDbPort);
      setDbName(loadedDbName);
      setDbUser(loadedDbUser);
      setDbPassword(loadedDbPassword);
      // Sync db config to localStorage so bridge calls use the right database immediately
      setDbConfig({
        db_type: loadedDbType,
        db_host: loadedDbHost || null,
        db_port: loadedDbPort || null,
        db_name: loadedDbName || null,
        db_user: loadedDbUser || null,
        db_password: loadedDbPassword || null,
      });
      if (settings.bridge_url) { setBridgeUrlState(settings.bridge_url); setBridgeInput(settings.bridge_url); }
      if (settings.bridge_api_key) { setBridgeApiKeyState(settings.bridge_api_key); setApiKeyInput(settings.bridge_api_key); }
      if (settings.api_tokens) {
        try { setTokens(settings.api_tokens as unknown as ApiToken[]); } catch { /* ignore */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading]);

  const exportConfig = () => {
    const config: Record<string, unknown> = {
      _version: 2,
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
      db_type: dbType,
      db_host: dbHost,
      db_port: dbPort,
      db_name: dbName,
      db_user: dbUser,
      db_password: dbPassword,
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
        const newUrl = parsed.bridge_url || parsed.unbound_bridge_url || "";
        const newKey = parsed.bridge_api_key || parsed.unbound_bridge_api_key || "";
        if (newUrl) { setBridgeInput(newUrl); setBridgeUrlState(newUrl); }
        if (newKey) { setApiKeyInput(newKey); setBridgeApiKeyState(newKey); }
        if (parsed.okta_domain !== undefined) setOktaDomain(parsed.okta_domain);
        if (parsed.okta_client_id !== undefined) setOktaClientId(parsed.okta_client_id);
        if (parsed.okta_client_secret !== undefined) setOktaSecret(parsed.okta_client_secret);
        if (parsed.okta_enabled !== undefined) setOktaEnabled(parsed.okta_enabled);
        if (parsed.log_retention) setLogRetention(parsed.log_retention);
        if (parsed.log_rotation) setLogRotation(parsed.log_rotation);
        if (parsed.log_max_size) setMaxLogSize(parsed.log_max_size);
        if (parsed.notify_blocked !== undefined) setNotifyBlocked(parsed.notify_blocked);
        if (parsed.notify_service !== undefined) setNotifyService(parsed.notify_service);
        if (parsed.api_tokens) setTokens(parsed.api_tokens);
        if (parsed.db_type) setDbType(parsed.db_type);
        if (parsed.db_host !== undefined) setDbHost(parsed.db_host || "");
        if (parsed.db_port !== undefined) setDbPort(parsed.db_port || "5432");
        if (parsed.db_name !== undefined) setDbName(parsed.db_name || "");
        if (parsed.db_user !== undefined) setDbUser(parsed.db_user || "");
        if (parsed.db_password !== undefined) setDbPassword(parsed.db_password || "");
        await saveSettings({
          bridge_url: newUrl || null,
          bridge_api_key: newKey || null,
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
          db_type: parsed.db_type || "local",
          db_host: parsed.db_host || null,
          db_port: parsed.db_port || null,
          db_name: parsed.db_name || null,
          db_user: parsed.db_user || null,
          db_password: parsed.db_password || null,
        });
        toast({ title: "Config imported", description: "Settings restored and synced to cloud." });
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

  const saveBridgeUrl = async () => {
    setBridgeUrlState(bridgeInput);
    setBridgeApiKeyState(apiKeyInput);
    const ok = await saveSettings({ bridge_url: bridgeInput || null, bridge_api_key: apiKeyInput || null });
    if (ok) toast({ title: "Bridge settings saved", description: "Connection settings synced to cloud." });
    else if (!user) toast({ title: "Not signed in", description: "Sign in to sync settings across browsers.", variant: "destructive" });
  };

  const testOktaIntegration = async () => {
    const domain = oktaDomain.trim();
    if (!domain) {
      toast({ title: "Missing Okta Domain", description: "Enter your Okta domain before testing.", variant: "destructive" });
      return;
    }
    setOktaTesting(true);
    setOktaTestResult(null);
    try {
      const base = domain.replace(/\/$/, "");
      const res = await fetch(`${base}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const issuer = json.issuer ?? domain;
        setOktaTestResult({ ok: true, message: `Connected — issuer: ${issuer}` });
      } else {
        setOktaTestResult({ ok: false, message: `Okta responded with HTTP ${res.status}. Check your domain URL.` });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error && e.name === "TimeoutError" ? "Request timed out — domain unreachable." : "Could not reach Okta domain. Check the URL and network access.";
      setOktaTestResult({ ok: false, message: msg });
    } finally {
      setOktaTesting(false);
    }
  };

  // API Tokens — stored in DB as JSONB
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenExpiry, setNewTokenExpiry] = useState("90");
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>(["dns:read"]);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [justCreatedToken, setJustCreatedToken] = useState<string | null>(null);

  const toggleScope = (scope: string) => {
    setNewTokenScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const persistTokens = async (updated: ApiToken[]) => {
    setTokens(updated);
    await saveSettings({ api_tokens: updated as unknown as import("@/integrations/supabase/types").Json });
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
    toast({ title: "Token created", description: "API token saved to cloud." });
  };

  const revokeToken = async (id: string) => {
    await persistTokens(tokens.filter((t) => t.id !== id));
    toast({ title: "Token revoked", description: "API token removed from cloud." });
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
      {/* ── Not signed in warning ─────────────────────────────────────── */}
      {!user && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30 text-warning">
          <LogIn className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block mb-0.5">Not signed in — settings won't be saved to the cloud.</span>
            Bridge URL and API key are stored locally in this browser only. All other settings (database, Okta, logs, notifications) require you to{" "}
            <a href="/settings" className="underline font-medium" onClick={(e) => { e.preventDefault(); window.location.hash = ""; }}>sign in</a>{" "}
            so they persist across sessions and devices. Use the account icon in the top right to sign in.
          </div>
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Unbound Bridge Connection</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          URL of the HTTP bridge running alongside Unbound. If using nginx, set this to your server's{" "}
          <strong>public IP</strong> with the <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">/api</code> prefix
          (e.g. <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">http://1.2.3.4/api</code>). Use <em>localhost:8080</em> only when your browser is on the same machine as the bridge.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={bridgeInput}
            onChange={(e) => setBridgeInput(e.target.value)}
            placeholder="http://localhost:8080"
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
            onClick={saveBridgeUrl}
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
            Set the same key in <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">BRIDGE_API_KEY</code> env var on the server (see Setup Docs → Bridge Script).
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
                    Some endpoints are unreachable. Make sure nginx has all <code className="font-mono">/api/*</code> location blocks and that <code className="font-mono">unbound-bridge.js</code> is running. POST endpoints may return HTTP 400 with an empty body — that still counts as reachable.
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
              if (!oktaDomain.trim() || !oktaClientId.trim() || !oktaSecret.trim()) {
                toast({ title: "Missing fields", description: "Fill in all three Okta fields before saving.", variant: "destructive" });
                return;
              }
              setOktaEnabled(true);
              // Persist to localStorage immediately so OktaGate activates on next visit
              saveOktaConfig({ domain: oktaDomain.trim(), clientId: oktaClientId.trim(), enabled: true });
              const ok = await saveSettings({
                okta_domain: oktaDomain.trim(),
                okta_client_id: oktaClientId.trim(),
                okta_client_secret: oktaSecret.trim(),
                okta_enabled: true,
              });
              if (ok) toast({ title: "Okta SSO enabled", description: "SSO is now active. Users must sign in with Okta to access the platform." });
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Save & Enable
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Configure Okta Single Sign-On for platform user authentication. API access uses token-based authentication (see below).</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Okta Domain</label>
            <input value={oktaDomain} onChange={(e) => setOktaDomain(e.target.value)} placeholder="https://your-org.okta.com" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Client ID</label>
              <input value={oktaClientId} onChange={(e) => setOktaClientId(e.target.value)} placeholder="0oa1b2c3d4..." className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Client Secret</label>
              <input type="password" value={oktaSecret} onChange={(e) => setOktaSecret(e.target.value)} placeholder="••••••••" className={inputClass} />
            </div>
          </div>
          {/* Test button + result */}
          <div className="flex items-center gap-2">
            <button
              onClick={testOktaIntegration}
              disabled={oktaTesting}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {oktaTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {oktaTesting ? "Testing…" : "Test Okta Integration"}
            </button>
          </div>

          <AnimatePresence>
            {oktaTestResult && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
                  oktaTestResult.ok
                    ? "bg-success/5 border-success/20 text-success"
                    : "bg-destructive/5 border-destructive/20 text-destructive"
                }`}
              >
                {oktaTestResult.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                <span>{oktaTestResult.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {oktaEnabled ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <p className="text-xs text-success">Okta SSO is active — enterprise authentication enforced for platform users.</p>
              </div>
              <button
                onClick={async () => {
                  setOktaEnabled(false);
                  saveOktaConfig({ domain: oktaDomain, clientId: oktaClientId, enabled: false });
                  await saveSettings({ okta_enabled: false });
                  toast({ title: "Okta disabled", description: "SSO has been disabled. Users can now sign in with email/password." });
                }}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors ml-4 shrink-0"
              >
                Disable
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <Shield className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">Okta not configured — temporary admin access enabled. Configure SSO to enforce enterprise authentication for platform users.</p>
            </div>
          )}
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
        <p className="text-xs text-muted-foreground mb-4">Generate tokens for API authentication. Tokens are scoped to specific permissions.</p>

        {/* Create Token Form */}
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

        {/* Token List */}
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

              {/* Token value */}
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

              {/* Meta */}
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
                const ok = await saveSettings({ log_retention: logRetention, log_rotation: logRotation, log_max_size: maxLogSize });
                if (ok) toast({ title: "Log settings saved", description: "Query logging configuration synced to cloud." });
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
            { label: "High blocked query volume alerts", key: "notify_blocked", checked: notifyBlocked, onChange: async (v: boolean) => { setNotifyBlocked(v); await saveSettings({ notify_blocked: v }); } },
            { label: "Service status change alerts", key: "notify_service", checked: notifyService, onChange: async (v: boolean) => { setNotifyService(v); await saveSettings({ notify_service: v }); } },
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

      {/* Database Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Database Configuration</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] border ml-2 ${dbType === "remote" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}`}>
              {dbType === "remote" ? "Remote" : "Local"}
            </span>
          </div>
          <button
            onClick={async () => {
              const cfg = {
                db_type: dbType,
                db_host: dbType === "remote" ? dbHost || null : null,
                db_port: dbType === "remote" ? dbPort || null : null,
                db_name: dbType === "remote" ? dbName || null : null,
                db_user: dbType === "remote" ? dbUser || null : null,
                db_password: dbType === "remote" ? dbPassword || null : null,
              };
              // Always sync to localStorage so bridge calls use this immediately
              setDbConfig(cfg);
              const ok = await saveSettings(cfg);
              if (ok) toast({ title: "Database config saved", description: "Database configuration synced to cloud and applied to bridge." });
              else toast({ title: "Saved locally", description: "DB config applied to this session. Sign in to sync to cloud.", variant: "default" });
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Choose whether the application connects to a local embedded database or a remote PostgreSQL server.</p>

        <div className="flex gap-3 mb-5">
          <button
            onClick={() => { setDbType("local"); setDbTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors ${dbType === "local" ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border hover:text-foreground"}`}
          >
            <HardDrive className="h-3.5 w-3.5" /> Local Database
          </button>
          <button
            onClick={() => { setDbType("remote"); setDbTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors ${dbType === "remote" ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border hover:text-foreground"}`}
          >
            <Wifi className="h-3.5 w-3.5" /> Remote Database
          </button>
        </div>

        <AnimatePresence>
          {dbType === "local" && (
            <motion.div key="local" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">Using the local embedded SQLite database. No additional configuration required. Data is stored on the local machine running DNSGuard.</p>
                <button
                  onClick={async () => {
                    const base = bridgeInput.replace(/\/$/, "");
                    if (!base) {
                      toast({ title: "Bridge URL required", description: "Set the Unbound Bridge URL first — the test runs through the bridge.", variant: "destructive" });
                      return;
                    }
                    setDbTesting(true);
                    setDbTestResult(null);
                    const start = Date.now();
                    try {
                      const res = await fetch(`${base}/db/ping`, {
                        method: "POST",
                        headers: { ...getBridgeHeaders(), "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "local" }),
                        signal: AbortSignal.timeout(8000),
                      });
                      const latency = Date.now() - start;
                      if (res.ok) {
                        setDbTestResult({ ok: true, message: `Local SQLite reachable via bridge in ${latency}ms.` });
                      } else if (res.status === 404) {
                        setDbTestResult({ ok: false, message: "Bridge endpoint /db/ping not found. Update your bridge script to v1.2+ to enable live DB testing." });
                      } else {
                        const body = await res.json().catch(() => ({}));
                        setDbTestResult({ ok: false, message: body?.error ?? `Bridge returned HTTP ${res.status}.` });
                      }
                    } catch (e: unknown) {
                      const isTimeout = e instanceof Error && e.name === "TimeoutError";
                      setDbTestResult({ ok: false, message: isTimeout ? "Request timed out — bridge unreachable within 8s." : "Could not reach the bridge. Ensure the bridge URL is correct and the service is running." });
                    } finally {
                      setDbTesting(false);
                    }
                  }}
                  disabled={dbTesting}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
                >
                  {dbTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {dbTesting ? "Testing…" : "Test Database"}
                </button>
              </div>
              <AnimatePresence>
                {dbTestResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${dbTestResult.ok ? "bg-success/5 border-success/20 text-success" : "bg-destructive/5 border-destructive/20 text-destructive"}`}
                  >
                    {dbTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                    <span>{dbTestResult.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          {dbType === "remote" && (
            <motion.div key="remote" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Host</label>
                  <input value={dbHost} onChange={(e) => setDbHost(e.target.value)} placeholder="db.example.com or 192.168.1.10" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Port</label>
                  <input value={dbPort} onChange={(e) => setDbPort(e.target.value)} placeholder="5432" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Database Name</label>
                <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="dnsguard" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Username</label>
                  <input value={dbUser} onChange={(e) => setDbUser(e.target.value)} placeholder="postgres" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showDbPassword ? "text" : "password"} value={dbPassword} onChange={(e) => setDbPassword(e.target.value)} placeholder="••••••••" className={inputClass + " pr-8"} />
                    <button onClick={() => setShowDbPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showDbPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!dbHost.trim()) {
                      toast({ title: "Missing host", description: "Enter a database host before testing.", variant: "destructive" });
                      return;
                    }
                    const base = bridgeInput.replace(/\/$/, "");
                    if (!base) {
                      toast({ title: "Bridge URL required", description: "Set the Unbound Bridge URL first — the connection test runs through the bridge.", variant: "destructive" });
                      return;
                    }
                    setDbTesting(true);
                    setDbTestResult(null);
                    const start = Date.now();
                    try {
                      const res = await fetch(`${base}/db/ping`, {
                        method: "POST",
                        headers: { ...getBridgeHeaders(), "Content-Type": "application/json" },
                        body: JSON.stringify({ host: dbHost, port: dbPort || "5432", database: dbName, user: dbUser, password: dbPassword }),
                        signal: AbortSignal.timeout(8000),
                      });
                      const latency = Date.now() - start;
                      if (res.ok) {
                        setDbTestResult({ ok: true, message: `Connected successfully in ${latency}ms — PostgreSQL reachable at ${dbHost}:${dbPort || "5432"}.` });
                      } else if (res.status === 404) {
                        setDbTestResult({ ok: false, message: "Bridge endpoint /db/ping not found. Update your bridge script to v1.2+ to enable live DB testing." });
                      } else {
                        const body = await res.json().catch(() => ({}));
                        setDbTestResult({ ok: false, message: body?.error ?? `Bridge returned HTTP ${res.status}. Check host, port, credentials, and network access.` });
                      }
                    } catch (e: unknown) {
                      const isTimeout = e instanceof Error && e.name === "TimeoutError";
                      setDbTestResult({ ok: false, message: isTimeout ? "Request timed out — bridge or database unreachable within 8s." : "Could not reach the bridge. Ensure the bridge URL is correct and the service is running." });
                    } finally {
                      setDbTesting(false);
                    }
                  }}
                  disabled={dbTesting}
                  className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {dbTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {dbTesting ? "Testing…" : "Test Database"}
                </button>
              </div>
              <AnimatePresence>
                {dbTestResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${dbTestResult.ok ? "bg-success/5 border-success/20 text-success" : "bg-destructive/5 border-destructive/20 text-destructive"}`}
                  >
                    {dbTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                    <span>{dbTestResult.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Import / Export Config */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Backup &amp; Restore</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Export your bridge URL, API key, DNS rules, and setup progress as a JSON file. Import it on another device or browser to restore your configuration.
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

          {/* Hidden file input */}
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
          The exported file contains: bridge URL, API key, DNS rules, and setup progress.
          It does not include API tokens (those are session-only).
        </p>
      </motion.div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Save className="h-4 w-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}
