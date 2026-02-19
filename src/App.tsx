import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";
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
import AuthPage from "@/pages/AuthPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: (user: User | null) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthGate>
            {(user) => (
              <Routes>
                <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
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
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
