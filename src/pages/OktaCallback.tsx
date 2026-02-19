import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Loader2, XCircle } from "lucide-react";
import { getOktaConfig, handleOktaCallback } from "@/hooks/use-okta-session";

export default function OktaCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const code      = params.get("code");
    const state     = params.get("state");
    const errParam  = params.get("error");
    const errDesc   = params.get("error_description");

    if (errParam) {
      setError(errDesc || errParam);
      return;
    }

    if (!code || !state) {
      setError("Invalid callback — missing code or state. Please try again.");
      return;
    }

    const config = getOktaConfig();
    if (!config) {
      setError("No Okta configuration found. Contact your administrator.");
      return;
    }

    handleOktaCallback(code, state, config)
      .then(() => navigate("/", { replace: true }))
      .catch((e: Error) => setError(e.message));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-5 text-center max-w-sm">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          <div className="text-left">
            <span className="text-lg font-bold text-gradient-primary">DNSGuard</span>
            <span className="block text-[10px] text-muted-foreground font-mono -mt-1">ENTERPRISE</span>
          </div>
        </div>

        {error ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-5 w-full text-left space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">Sign-in failed</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="w-full px-3 py-2 text-xs font-medium rounded-md bg-muted border border-border hover:bg-muted/80 transition-colors"
            >
              Back to login
            </button>
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
