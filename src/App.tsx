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
import {
  isLocalAdminEnabled,
  getLocalAdminSession,
  clearLocalAdminSession,
  storeLocalAdminSession,
  verifyLocalAdminCredentials,
  type LocalAdminSession,
} from "@/hooks/use-local-admin";

import { Globe, Loader2, LogIn, Shield, Eye, EyeOff, Lock } from "lucide-react";


const queryClient = new QueryClient();

// ─── Okta session context ────────────────────────────────────────────────────

interface OktaCtx {
  session: OktaSession | null;
  signOut: () => void;
}
const OktaContext = createContext<OktaCtx>({ session: null, signOut: () => {} });
export const useOktaContext = () => useContext(OktaContext);

// ─── Local admin context ──────────────────────────────────────────────────────

interface LocalAdminCtx {
  session: LocalAdminSession | null;
  signOut: () => void;
}
const LocalAdminContext = createContext<LocalAdminCtx>({ session: null, signOut: () => {} });
export const useLocalAdminContext = () => useContext(LocalAdminContext);

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

// ─── Local Admin Gate ─────────────────────────────────────────────────────────

function LocalAdminGate({ children }: { children: React.ReactNode }) {
  const oktaConfig = getOktaConfig();
  const [session, setSession]   = useState<LocalAdminSession | null>(() => getLocalAdminSession());
  const [enabled]               = useState(() => isLocalAdminEnabled());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const signOut = () => { clearLocalAdminSession(); setSession(null); };

  // If Okta is enabled, skip this gate entirely — Okta handles auth
  if (oktaConfig?.enabled) {
    return <LocalAdminContext.Provider value={{ session: null, signOut }}>{children}</LocalAdminContext.Provider>;
  }

  // Local admin disabled — bypass gate
  if (!enabled) {
    return <LocalAdminContext.Provider value={{ session: null, signOut }}>{children}</LocalAdminContext.Provider>;
  }

  // Valid session — let through
  if (session) {
    return <LocalAdminContext.Provider value={{ session, signOut }}>{children}</LocalAdminContext.Provider>;
  }

  // Show local admin login wall
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoggingIn(true);
    try {
      const valid = await verifyLocalAdminCredentials(username, password);
      if (valid) {
        storeLocalAdminSession();
        setSession(getLocalAdminSession());
      } else {
        setError("Invalid username or password.");
      }
    } finally {
      setLoggingIn(false);
    }
  };

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

        <form onSubmit={handleLogin} className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">Local Admin Login</h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sign in with your local admin credentials. This fallback can be disabled once Okta SSO is configured.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Username</label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-9 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {loggingIn ? "Verifying…" : "Sign in"}
          </button>

          <p className="text-[10px] text-muted-foreground text-center">
            Default credentials: <code className="font-mono bg-muted px-1 rounded">admin / admin</code>
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Supabase auth gate ───────────────────────────────────────────────────────

function AuthGate({ children }: { children: (user: User | null) => React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.warn("Supabase auth unreachable, continuing without auth:", err);
      setBackendDown(true);
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

  return (
    <>
      {backendDown && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground text-xs text-center py-2 px-4 font-medium shadow-md">
          ⚠ Backend unreachable — check your local Supabase instance is running and VITE_SUPABASE_URL is correct.
          <button onClick={() => setBackendDown(false)} className="ml-3 underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}
      {children(user)}
    </>
  );
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
                  <LocalAdminGate>
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
                  </LocalAdminGate>
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

