import { useState, useRef, useEffect, useCallback } from "react";
import { Save, Key, Shield, FileText, Bell, Plus, Trash2, Copy, Check, Eye, EyeOff, Server, CheckCircle2, XCircle, Loader2, AlertTriangle, Info, Lock, Download, Upload, Database, HardDrive, Wifi, LogIn, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useBridgeUrl, getBridgeHeaders, setDbConfig, getBridgeUrl } from "@/hooks/use-bridge-url";
import { saveOktaConfig, startOktaLogin } from "@/hooks/use-okta-session";
import { setLocalAdminEnabled as persistLocalAdminEnabled } from "@/hooks/use-local-admin";
import { User } from "@supabase/supabase-js";
import { fetchBridgeSettings, saveBridgeSettings, type AppSettings } from "@/lib/unbound-bridge";

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
  const { url: bridgeUrl, setUrl: setBridgeUrlState, apiKey: bridgeApiKey, setApiKey: setBridgeApiKeyState } = useBridgeUrl();
  const [bridgeInput, setBridgeInput] = useState(bridgeUrl);
  const [apiKeyInput, setApiKeyInput] = useState(bridgeApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpointResults, setEndpointResults] = useState<EndpointResult[] | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

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

  // Local admin state
  const [localAdminEnabled, setLocalAdminEnabled] = useState(() => {
    try {
      const v = localStorage.getItem("local_admin_enabled");
      return v === null ? true : v === "true";
    } catch { return true; }
  });

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

  /** Save a partial settings object to the bridge's configured DB. */
  const saveSettings = useCallback(async (updates: Partial<AppSettings>): Promise<boolean> => {
    try {
      await saveBridgeSettings(updates);
      return true;
    } catch (e) {
      console.error("Failed to save settings via bridge:", e);
      toast({ title: "Save failed", description: "Could not reach the bridge. Check the bridge URL and try again.", variant: "destructive" });
      return false;
    }
  }, []);

  /** Load all settings from the bridge's configured DB on mount. */
  const loadSettings = useCallback(async () => {
    const url = getBridgeUrl();
    if (!url) return;
    setSettingsLoading(true);
    try {
      const data = await fetchBridgeSettings();
      if (data.okta_domain !== undefined) setOktaDomain(data.okta_domain || "");
      if (data.okta_client_id !== undefined) setOktaClientId(data.okta_client_id || "");
      if (data.okta_client_secret !== undefined) setOktaSecret(data.okta_client_secret || "");
      if (data.okta_enabled !== undefined) {
        setOktaEnabled(data.okta_enabled);
        saveOktaConfig({
          domain:       data.okta_domain || "",
          clientId:     data.okta_client_id || "",
          clientSecret: data.okta_client_secret || undefined,
          enabled:      data.okta_enabled,
        });
      }
      if (data.log_retention) setLogRetention(data.log_retention);
      if (data.log_rotation) setLogRotation(data.log_rotation);
      if (data.log_max_size) setMaxLogSize(data.log_max_size);
      if (data.notify_blocked !== undefined) setNotifyBlocked(data.notify_blocked);
      if (data.notify_service !== undefined) setNotifyService(data.notify_service);
      const loadedDbType = data.db_type || "local";
      const loadedDbHost = data.db_host || "";
      const loadedDbPort = data.db_port || "5432";
      const loadedDbName = data.db_name || "";
      const loadedDbUser = data.db_user || "";
      const loadedDbPassword = data.db_password || "";
      setDbType(loadedDbType);
      setDbHost(loadedDbHost);
      setDbPort(loadedDbPort);
      setDbName(loadedDbName);
      setDbUser(loadedDbUser);
      setDbPassword(loadedDbPassword);
      setDbConfig({ db_type: loadedDbType, db_host: loadedDbHost || null, db_port: loadedDbPort || null, db_name: loadedDbName || null, db_user: loadedDbUser || null, db_password: loadedDbPassword || null });
      if (data.bridge_url) { setBridgeUrlState(data.bridge_url); setBridgeInput(data.bridge_url); }
      if (data.bridge_api_key) { setBridgeApiKeyState(data.bridge_api_key); setApiKeyInput(data.bridge_api_key); }
      if (data.api_tokens) {
        try { setTokens(data.api_tokens as ApiToken[]); } catch { /* ignore */ }
      }
    } catch {
      // Bridge not reachable yet — settings remain at defaults from localStorage
    } finally {
      setSettingsLoading(false);
    }
  }, [setBridgeUrlState, setBridgeApiKeyState]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

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
        toast({ title: "Config imported", description: "Settings restored and saved to configured database." });
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
    if (ok) toast({ title: "Bridge settings saved", description: "Connection settings saved to configured database." });
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

    // Step 0 — Domain format
    let s = updateStep(steps, 0, { status: "checking" });
    const domainRe = /^https:\/\/[a-zA-Z0-9-]+\.(okta\.com|okta\.eu|oktapreview\.com|okta-emea\.com)(\/oauth2\/[\w-]+)?$/;
    if (domainRe.test(domain)) {
      s = updateStep(s, 0, { status: "ok", detail: domain });
    } else if (domain.startsWith("http://")) {
      s = updateStep(s, 0, { status: "fail", detail: "Must use https://" });
    } else {
      s = updateStep(s, 0, { status: "warn", detail: "Unusual domain — custom auth server?" });
    }

    // Step 1 — Client ID format
    s = updateStep(s, 1, { status: "checking" });
    const clientIdRe = /^[a-zA-Z0-9]{20}$/;
    if (!clientId) {
      s = updateStep(s, 1, { status: "warn", detail: "Client ID is empty — needed for login" });
    } else if (clientIdRe.test(clientId)) {
      s = updateStep(s, 1, { status: "ok", detail: clientId.slice(0, 6) + "••••••••••••••" });
    } else {
      s = updateStep(s, 1, { status: "warn", detail: "Unexpected format — Okta Client IDs are 20 alphanumeric chars" });
    }

    // Step 2 — OIDC discovery
    s = updateStep(s, 2, { status: "checking" });
    let oidcMeta: Record<string, string> = {};
    try {
      const res = await fetch(`${domain}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        oidcMeta = await res.json();
        s = updateStep(s, 2, { status: "ok", detail: `issuer: ${oidcMeta.issuer ?? domain}` });
      } else {
        s = updateStep(s, 2, { status: "fail", detail: `HTTP ${res.status} — check domain or auth server path` });
        // remaining checks can't run
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

    // Step 3 — Authorization endpoint present
    s = updateStep(s, 3, { status: "checking" });
    if (oidcMeta.authorization_endpoint) {
      s = updateStep(s, 3, { status: "ok", detail: oidcMeta.authorization_endpoint });
    } else {
      s = updateStep(s, 3, { status: "fail", detail: "authorization_endpoint missing from metadata" });
    }

    // Step 4 — Token endpoint present
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
    // Temporarily persist config (including secret) so startOktaLogin can read it
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
    await saveSettings({ api_tokens: updated });
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
    toast({ title: "Token created", description: "API token saved to configured database." });
  };

  const revokeToken = async (id: string) => {
    await persistTokens(tokens.filter((t) => t.id !== id));
    toast({ title: "Token revoked", description: "API token removed from configured database." });
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
              if (!oktaDomain.trim() || !oktaClientId.trim()) {
                toast({ title: "Missing fields", description: "Fill in Okta Domain and Client ID before saving.", variant: "destructive" });
                return;
              }
              setOktaEnabled(true);
              saveOktaConfig({ domain: oktaDomain.trim(), clientId: oktaClientId.trim(), clientSecret: oktaSecret.trim() || undefined, enabled: true });
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

          {/* Client type hint */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
            <div>
              <span className="font-medium text-foreground">Which client type are you using?</span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li><span className="font-medium">SPA (Single-Page App)</span> — leave Client Secret blank. Set "Client authentication" to <code className="bg-muted px-1 rounded">None (PKCE)</code> in Okta.</li>
                <li><span className="font-medium">Web App (confidential)</span> — paste the Client Secret. Set "Client authentication" to <code className="bg-muted px-1 rounded">Client secret</code> in Okta.</li>
              </ul>
              <p className="mt-1">The error <em>"Client authentication failed"</em> usually means a Web App secret is required — paste it above.</p>
            </div>
          </div>
          {/* Test buttons + results */}
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

          {/* Step-by-step check results */}
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
                <p className="text-xs text-success">Okta SSO is active — enterprise authentication enforced for platform users.</p>
              </div>
              <button
                onClick={async () => {
                  setOktaEnabled(false);
                  saveOktaConfig({ domain: oktaDomain, clientId: oktaClientId, clientSecret: oktaSecret || undefined, enabled: false });
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

      {/* Local Admin */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Local Admin Login</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] border ml-2 ${localAdminEnabled ? "bg-warning/10 text-warning border-warning/20" : "bg-muted text-muted-foreground border-border"}`}>
              {localAdminEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Hardcoded fallback login (<code className="font-mono bg-muted px-1 rounded text-[11px]">admin / admin</code>) used when Okta SSO is not active.
          Disable this once Okta is verified working to enforce SSO-only access.
        </p>

        <div className="space-y-3">
          {/* Status */}
          {localAdminEnabled ? (
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-warning">Local admin is active</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Anyone with the default credentials can access the platform. Disable after Okta is confirmed working.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setLocalAdminEnabled(false);
                  persistLocalAdminEnabled(false);
                  toast({ title: "Local admin disabled", description: "Okta SSO or configured auth is now the only login method." });
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
                  toast({ title: "Local admin re-enabled", description: "Fallback admin/admin login is active again." });
                }}
                className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Re-enable
              </button>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Disabling requires a page reload to take effect for existing sessions. The setting is stored locally in this browser.</span>
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
                if (ok) toast({ title: "Log settings saved", description: "Query logging configuration saved to configured database." });
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
              if (ok) toast({ title: "Database config saved", description: "Database configuration saved and applied to bridge." });
              else toast({ title: "Save failed", description: "Could not reach the bridge to save DB config.", variant: "destructive" });
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
    </div>
  );
}
