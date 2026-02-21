import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Loader2, XCircle, AlertCircle } from "lucide-react";
import { getOktaConfig, handleOktaCallback } from "@/hooks/use-okta-session";
import { loadConfig, isLoaded } from "@/lib/settings-store";

export default function OktaCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // Ensure settings are loaded from DB before reading Okta config
      if (!isLoaded()) {
        await loadConfig();
      }

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

      const cfg = getOktaConfig();
      if (!cfg) {
        setError("No Okta configuration found. Please configure Okta in Settings first.");
        return;
      }

      try {
        await handleOktaCallback(code, state, cfg);
        navigate("/", { replace: true });
      } catch (e: any) {
        setError(e.message);
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">

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
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">Sign-in failed</span>
            </div>

            <p className="text-xs text-muted-foreground font-mono bg-muted/60 px-3 py-2 rounded border border-border break-all">
              {error}
            </p>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Make sure your Okta app has the correct <strong>Sign-in redirect URI</strong>:{" "}
                <span className="font-mono break-all">{window.location.origin}/auth/callback</span>
              </p>
            </div>

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
                Settings
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
