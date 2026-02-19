import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Loader2, XCircle, Copy, Check, Info } from "lucide-react";
import { getOktaConfig, handleOktaCallback } from "@/hooks/use-okta-session";

function DiagnosticRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 w-28">{label}</span>
      <span className={`text-[11px] flex-1 break-all ${mono ? "font-mono" : ""}`}>{value}</span>
      <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function getErrorGuidance(error: string): string | null {
  const e = error.toLowerCase();
  if (e.includes("client authentication failed") || e.includes("invalid_client")) {
    return "Your Okta app type is likely set to 'Web' (confidential). Go to Settings → Okta SSO and enter the Client Secret. Alternatively, change the Okta app's 'Client authentication' to 'None (PKCE)' for a public SPA app.";
  }
  if (e.includes("redirect_uri") || e.includes("redirect uri")) {
    return "The Redirect URI sent by this app is not registered in Okta. Copy the exact Redirect URI below and add it under your Okta app's Sign-in redirect URIs.";
  }
  if (e.includes("state mismatch") || e.includes("csrf")) {
    return "Security state mismatch — this can happen when the browser clears storage mid-flow (e.g. private browsing or extensions). Try again in a normal browser window.";
  }
  if (e.includes("expired") || e.includes("pkce")) {
    return "The login session expired (10-minute PKCE window). Please try signing in again.";
  }
  if (e.includes("access_denied")) {
    return "Access was denied by Okta. Check that your user is assigned to the application in Okta, and that the app's sign-on policy allows access.";
  }
  return null;
}

export default function OktaCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const redirectUri = `${window.location.origin}/auth/callback`;
  const config = getOktaConfig();

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get("code");
    const state    = params.get("state");
    const errParam = params.get("error");
    const errDesc  = params.get("error_description");

    if (errParam) {
      setError(errDesc ? `${errDesc} (${errParam})` : errParam);
      return;
    }

    if (!code || !state) {
      setError("Invalid callback — missing code or state. Please try again.");
      return;
    }

    if (!config) {
      setError("No Okta configuration found. Contact your administrator.");
      return;
    }

    handleOktaCallback(code, state, config)
      .then(() => navigate("/", { replace: true }))
      .catch((e: Error) => setError(e.message));
  }, [navigate]);  // eslint-disable-line react-hooks/exhaustive-deps

  const guidance = error ? getErrorGuidance(error) : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-5 text-center max-w-md w-full">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          <div className="text-left">
            <span className="text-lg font-bold text-gradient-primary">DNSGuard</span>
            <span className="block text-[10px] text-muted-foreground font-mono -mt-1">ENTERPRISE</span>
          </div>
        </div>

        {error ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-5 w-full text-left space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">Sign-in failed</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-mono bg-muted/60 px-3 py-2 rounded border border-border">{error}</p>

            {/* Actionable guidance */}
            {guidance && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <Info className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">{guidance}</p>
              </div>
            )}

            {/* Diagnostic info */}
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diagnostic info</p>
              <DiagnosticRow label="Redirect URI" value={redirectUri} />
              {config?.domain && <DiagnosticRow label="Okta Domain" value={config.domain} />}
              {config?.clientId && <DiagnosticRow label="Client ID" value={config.clientId} />}
              <DiagnosticRow label="Client Secret" value={config?.clientSecret ? "✓ provided" : "✗ not set"} mono={false} />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Most common fixes:</span>{" "}
              (1) Register the exact Redirect URI above in your Okta app's "Sign-in redirect URIs".{" "}
              (2) If your app type is "Web", add the Client Secret in Settings → Okta SSO.{" "}
              (3) If your app type is "SPA", set Client authentication to <code className="font-mono text-[10px] bg-muted px-1 rounded">None (PKCE)</code> in Okta.
            </p>

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
                Open Settings
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

