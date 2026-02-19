import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Loader2, XCircle, Copy, Check, Info, Save, Eye, EyeOff, LogIn } from "lucide-react";
import { getOktaConfig, handleOktaCallback, saveOktaConfig, startOktaLogin, type OktaConfig } from "@/hooks/use-okta-session";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function getErrorGuidance(error: string): string | null {
  const e = error.toLowerCase();
  if (e.includes("client authentication failed") || e.includes("invalid_client")) {
    return "Your Okta app type is likely 'Web' (confidential). Enter the Client Secret below and retry. Or set 'Client authentication' to 'None (PKCE)' in Okta for a public SPA app.";
  }
  if (e.includes("redirect_uri") || e.includes("redirect uri")) {
    return "The Redirect URI is not registered in Okta. Copy it below and add it to your Okta app's Sign-in redirect URIs.";
  }
  if (e.includes("state mismatch") || e.includes("csrf")) {
    return "Security state mismatch — can happen in private browsing. Try again in a normal browser window.";
  }
  if (e.includes("expired") || e.includes("pkce")) {
    return "Login session expired (10-minute window). Try signing in again.";
  }
  if (e.includes("access_denied")) {
    return "Access denied by Okta. Check that your user is assigned to the application and that the sign-on policy allows access.";
  }
  return null;
}

export default function OktaCallback() {
  const navigate   = useNavigate();
  const [error, setError]   = useState<string | null>(null);
  const redirectUri = `${window.location.origin}/auth/callback`;
  const initialConfig = getOktaConfig();

  // Editable fields
  const [domain,       setDomain]       = useState(initialConfig?.domain       || "");
  const [clientId,     setClientId]     = useState(initialConfig?.clientId     || "");
  const [clientSecret, setClientSecret] = useState(initialConfig?.clientSecret || "");
  const [showSecret,   setShowSecret]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [retrying,     setRetrying]     = useState(false);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get("code");
    const state    = params.get("state");
    const errParam = params.get("error");
    const errDesc  = params.get("error_description");

    if (errParam) { setError(errDesc ? `${errDesc} (${errParam})` : errParam); return; }
    if (!code || !state) { setError("Invalid callback — missing code or state. Please try again."); return; }

    const cfg = getOktaConfig();
    if (!cfg) { setError("No Okta configuration found. Configure it below and retry."); return; }

    handleOktaCallback(code, state, cfg)
      .then(() => navigate("/", { replace: true }))
      .catch((e: Error) => setError(e.message));
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveAndRetry = async () => {
    if (!domain.trim() || !clientId.trim()) return;
    setSaving(true);
    const cfg: OktaConfig = {
      domain:       domain.trim().replace(/\/$/, ""),
      clientId:     clientId.trim(),
      clientSecret: clientSecret.trim() || undefined,
      enabled:      true,
    };
    saveOktaConfig(cfg);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);

    // Kick off a fresh login attempt
    setRetrying(true);
    try {
      await startOktaLogin(cfg);
    } catch {
      setRetrying(false);
    }
  };

  const guidance = error ? getErrorGuidance(error) : null;
  const inputCls = "w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-5 text-center max-w-md w-full">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          <div className="text-left">
            <span className="text-lg font-bold text-gradient-primary">DNSGuard</span>
            <span className="block text-[10px] text-muted-foreground font-mono -mt-1">ENTERPRISE</span>
          </div>
        </div>

        {error ? (
          <div className="bg-card border border-destructive/30 rounded-xl p-5 w-full text-left space-y-4 shadow-sm">

            {/* Error header */}
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">Sign-in failed</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-3 py-2 rounded border border-border break-all">{error}</p>

            {/* Guidance */}
            {guidance && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <Info className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">{guidance}</p>
              </div>
            )}

            {/* ─── Editable diagnostic panel ─── */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fix & Retry</p>

              {/* Redirect URI — read-only, copyable */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Redirect URI <span className="text-[10px]">(register this in Okta)</span></label>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg">
                  <span className="text-[11px] font-mono flex-1 break-all text-foreground">{redirectUri}</span>
                  <CopyButton value={redirectUri} />
                </div>
              </div>

              {/* Okta Domain */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Okta Domain</label>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="https://your-org.okta.com"
                  className={inputCls}
                />
              </div>

              {/* Client ID */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Client ID</label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="0oa1b2c3EXAMPLE"
                  className={inputCls}
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  Client Secret
                  <span className="ml-1.5 text-[10px] font-normal opacity-70">(Web/confidential apps only — leave blank for SPA)</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Leave blank for SPA / PKCE"
                    className={inputCls + " pr-8"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Save & Retry */}
              <button
                onClick={handleSaveAndRetry}
                disabled={saving || retrying || !domain.trim() || !clientId.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {retrying
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting to Okta…</>
                  : saved
                  ? <><Check className="h-3.5 w-3.5" /> Saved — redirecting…</>
                  : saving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : <><Save className="h-3.5 w-3.5" /><LogIn className="h-3.5 w-3.5" /> Save & Retry Login</>}
              </button>
            </div>

            {/* Nav buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/", { replace: true })}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-muted border border-border hover:bg-muted/80 transition-colors"
              >
                Back to login
              </button>
              <button
                onClick={() => navigate("/settings", { replace: true })}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
              >
                Full Settings
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Completing Okta sign-in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
