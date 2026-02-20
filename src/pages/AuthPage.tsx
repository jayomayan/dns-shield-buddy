import { useState } from "react";
import { getActiveClient } from "@/lib/supabase-client";
import { Globe, Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Mode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup") {
      const { error } = await getActiveClient().auth.signUp({ email, password });
      if (error) {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "A confirmation link has been sent to your inbox." });
      }
    } else {
      const { error } = await getActiveClient().auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
    }

    setLoading(false);
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Globe className="h-8 w-8 text-primary" />
          <div>
            <span className="text-xl font-bold text-gradient-primary">DNSGuard</span>
            <span className="block text-[10px] text-muted-foreground font-mono -mt-1">ENTERPRISE</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">
              {mode === "login" ? "Sign in to your account" : "Create an account"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            {mode === "login"
              ? "Your settings are stored in the cloud and sync across all browsers."
              : "Settings you save will sync across all your browsers and devices."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={inputClass + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
