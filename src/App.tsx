import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase-client";
import { User } from "@supabase/supabase-js";
import { loadConfig, isLoaded } from "@/lib/settings-store";
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
import AuthPage from "@/pages/AuthPage";
import {
  getOktaSession,
  clearOktaSession,
  type OktaSession,
} from "@/hooks/use-okta-session";

const queryClient = new QueryClient();

// ─── Okta session context ────────────────────────────────────────────────────

interface OktaCtx {
  session: OktaSession | null;
  signOut: () => void;
}
const OktaContext = createContext<OktaCtx>({ session: null, signOut: () => {} });
export const useOktaContext = () => useContext(OktaContext);

// ─── Settings Loader ─────────────────────────────────────────────────────────

function SettingsLoader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(isLoaded());

  useEffect(() => {
    if (!ready) {
      loadConfig().then(() => setReady(true));
    }
  }, [ready]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">Loading configuration…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Okta Context Provider (no gate — just provides session to children) ────

function OktaProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<OktaSession | null>(() => getOktaSession());

  useEffect(() => {
    const t = setInterval(() => setSession(getOktaSession()), 60_000);
    return () => clearInterval(t);
  }, []);

  const signOut = () => {
    clearOktaSession();
    setSession(null);
  };

  return <OktaContext.Provider value={{ session, signOut }}>{children}</OktaContext.Provider>;
}

// ─── Supabase auth gate ───────────────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendDown, setBackendDown] = useState(false);
  const [oktaSession, setOktaSession] = useState<OktaSession | null>(() => getOktaSession());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.warn("Supabase auth unreachable:", err);
      setBackendDown(true);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-check okta session periodically
  useEffect(() => {
    const t = setInterval(() => setOktaSession(getOktaSession()), 60_000);
    return () => clearInterval(t);
  }, []);

  const isAuthenticated = !!user || !!oktaSession;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (backendDown) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive font-medium">⚠ Backend unreachable</p>
          <p className="text-xs text-muted-foreground">Check your connection and refresh.</p>
          <button onClick={() => window.location.reload()} className="text-xs text-primary underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <>{children}</>;
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
            <Route path="/auth/callback" element={<OktaCallback />} />

            <Route
              path="*"
              element={
                <AuthGate>
                  <SettingsLoader>
                    <OktaProvider>
                      <AppRoutes />
                    </OktaProvider>
                  </SettingsLoader>
                </AuthGate>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
      <Route path="/dns-rules" element={<AppLayout><DnsRules /></AppLayout>} />
      <Route path="/query-logs" element={<AppLayout><QueryLogs /></AppLayout>} />
      <Route path="/monitoring" element={<AppLayout><Monitoring /></AppLayout>} />
      <Route path="/unbound" element={<AppLayout><UnboundConfig /></AppLayout>} />
      <Route path="/setup" element={<AppLayout><SetupDocs /></AppLayout>} />
      <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
