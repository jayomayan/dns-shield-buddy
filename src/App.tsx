import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import DnsRules from "@/pages/DnsRules";
import QueryLogs from "@/pages/QueryLogs";
import Monitoring from "@/pages/Monitoring";
import UnboundConfig from "@/pages/UnboundConfig";
import SetupDocs from "@/pages/SetupDocs";
import SettingsPage from "@/pages/SettingsPage";
import OktaCallback from "@/pages/OktaCallback";
import NotFound from "./pages/NotFound";
import {
  getOktaConfig,
  getOktaSession,
  clearOktaSession,
  startOktaLogin,
  type OktaSession,
} from "@/hooks/use-okta-session";
import { Globe, Loader2, LogIn, Shield } from "lucide-react";

const queryClient = new QueryClient();

// ─── Okta session context ────────────────────────────────────────────────────

interface OktaCtx {
  session: OktaSession | null;
  signOut: () => void;
}
const OktaContext = createContext<OktaCtx>({ session: null, signOut: () => {} });
export const useOktaContext = () => useContext(OktaContext);

// ─── Okta Gate ───────────────────────────────────────────────────────────────

function OktaGate({ children }: { children: React.ReactNode }) {
  const config  = getOktaConfig();
  const [session, setSession] = useState<OktaSession | null>(() => getOktaSession());
  const [starting, setStarting] = useState(false);

  // Re-check session validity every minute
  useEffect(() => {
    const t = setInterval(() => setSession(getOktaSession()), 60_000);
    return () => clearInterval(t);
  }, []);

  const signOut = () => {
    clearOktaSession();
    setSession(null);
  };

  // Okta not configured / not enabled → bypass gate
  if (!config?.enabled) {
    return <OktaContext.Provider value={{ session: null, signOut }}>{children}</OktaContext.Provider>;
  }

  // Valid session → render app
  if (session) {
    return <OktaContext.Provider value={{ session, signOut }}>{children}</OktaContext.Provider>;
  }

  // No session → show Okta login wall
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center">
          <Globe className="h-8 w-8 text-primary" />
          <div>
            <span className="text-xl font-bold text-gradient-primary">DNSGuard</span>
            <span className="block text-[10px] text-muted-foreground font-mono -mt-1">ENTERPRISE</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">Enterprise Single Sign-On</h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This platform is protected by Okta SSO. Sign in with your organization account to continue.
          </p>

          <button
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              try { await startOktaLogin(config); } catch { setStarting(false); }
            }}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {starting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <LogIn className="h-4 w-4" />}
            {starting ? "Redirecting to Okta…" : "Sign in with Okta"}
          </button>

          <p className="text-[11px] text-muted-foreground text-center">
            Powered by{" "}
            <span className="font-medium text-foreground">{config.domain.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Supabase auth gate ───────────────────────────────────────────────────────

function AuthGate({ children }: { children: (user: User | null) => React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children(user)}</>;
}

// ─── App ─────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public: Okta callback must be outside the gate */}
            <Route path="/auth/callback" element={<OktaCallback />} />

            {/* Everything else is gated */}
            <Route
              path="*"
              element={
                <OktaGate>
                  <AuthGate>
                    {(user) => (
                      <Routes>
                        <Route path="/" element={<AppLayout user={user}><Dashboard /></AppLayout>} />
                        <Route path="/dns-rules" element={<AppLayout user={user}><DnsRules /></AppLayout>} />
                        <Route path="/query-logs" element={<AppLayout user={user}><QueryLogs /></AppLayout>} />
                        <Route path="/monitoring" element={<AppLayout user={user}><Monitoring /></AppLayout>} />
                        <Route path="/unbound" element={<AppLayout user={user}><UnboundConfig /></AppLayout>} />
                        <Route path="/setup" element={<AppLayout user={user}><SetupDocs /></AppLayout>} />
                        <Route path="/settings" element={<AppLayout user={user}><SettingsPage user={user} /></AppLayout>} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    )}
                  </AuthGate>
                </OktaGate>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
