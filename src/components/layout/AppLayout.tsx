import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Shield, FileText, Settings, Server, Zap, BookOpen,
  Activity, ChevronLeft, ChevronRight, Globe, LogOut, Sun, Moon, Monitor,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";
import { useOktaContext } from "@/App";
import { getOktaConfig } from "@/hooks/use-okta-session";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/dns-rules", icon: Shield, label: "DNS Rules" },
  { path: "/query-logs", icon: FileText, label: "Query Logs" },
  { path: "/monitoring", icon: Server, label: "Monitoring" },
  { path: "/unbound", icon: Zap, label: "Unbound DNS" },
  { path: "/setup", icon: BookOpen, label: "Setup & Docs" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { session: oktaSession, signOut: oktaSignOut } = useOktaContext();
  const oktaConfig = getOktaConfig();

  const handleSignOut = async () => {
    // Sign out of Supabase
    await supabase.auth.signOut();
    // Sign out of Okta if enabled
    if (oktaConfig?.enabled && oktaSession) {
      oktaSignOut();
      // Redirect to Okta logout if possible
      try {
        const domain = oktaConfig.domain.replace(/\/$/, "");
        const idToken = oktaSession.idToken;
        const logoutUrl = `${domain}/oauth2/v1/logout?id_token_hint=${encodeURIComponent(idToken)}&post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
        window.location.href = logoutUrl;
        return;
      } catch {
        // fall through to toast
      }
    }
    toast({ title: "Signed out" });
  };

  // Determine display user — prefer Okta session
  const displayName = oktaSession?.name || oktaSession?.email || user?.email || null;
  const displayInitial = (oktaSession?.name || oktaSession?.email || user?.email || "U").charAt(0).toUpperCase();
  const isOktaUser = !!oktaSession;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col border-r border-border bg-sidebar shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border">
          <Globe className="h-7 w-7 text-primary shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="ml-3 overflow-hidden whitespace-nowrap"
              >
                <span className="text-lg font-bold text-gradient-primary">DNSGuard</span>
                <span className="block text-[10px] text-muted-foreground font-mono -mt-1">ENTERPRISE</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group relative ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full"
                  />
                )}
                <item.icon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Service Status */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-success animate-pulse-glow" />
            {!collapsed && (
              <span className="text-xs text-muted-foreground">DNS Service Active</span>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </motion.aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              {navItems.find((n) => n.path === location.pathname)?.label || "DNSGuard"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <div className="relative">
              <button
                onClick={() => setThemeOpen(!themeOpen)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {theme === "light" ? <Sun className="h-4 w-4" /> : theme === "dark" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              </button>
              {themeOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setThemeOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-30 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                    {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Monitor, "System"]] as const).map(([value, Icon, label]) => (
                      <button
                        key={value}
                        onClick={() => { setTheme(value); setThemeOpen(false); }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${theme === value ? "text-primary bg-primary/10" : "text-popover-foreground hover:bg-muted"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-success/10 border border-success/20">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
              <span className="text-xs font-mono text-success">ONLINE</span>
            </div>

            {/* User info — show Okta user or Supabase user */}
            {(isOktaUser || user) && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="relative w-8 h-8">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      {displayInitial}
                    </div>
                    {isOktaUser && (
                      <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-primary text-primary-foreground rounded-full px-1 leading-tight font-bold">
                        SSO
                      </span>
                    )}
                  </div>
                  <span className="hidden md:inline text-xs truncate max-w-[140px]">{displayName}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
