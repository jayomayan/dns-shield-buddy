import { createContext, useContext, useEffect, useState } from "react";
import { getBranding, applyThemePreset } from "@/lib/branding-store";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: "system", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("dnsguard-theme") as Theme) || "system");

  useEffect(() => {
    const root = document.documentElement;
    const resolve = (t: Theme) =>
      t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;

    const applyAll = () => {
      const resolved = resolve(theme);
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      // Apply theme preset CSS vars
      const branding = getBranding();
      applyThemePreset(branding.themePreset, resolved === "dark");
    };

    applyAll();
    localStorage.setItem("dnsguard-theme", theme);

    // Listen for branding changes (theme preset switch)
    const onBrandingChanged = () => applyAll();
    window.addEventListener("branding-changed", onBrandingChanged);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyAll();
      mq.addEventListener("change", handler);
      return () => {
        mq.removeEventListener("change", handler);
        window.removeEventListener("branding-changed", onBrandingChanged);
      };
    }

    return () => window.removeEventListener("branding-changed", onBrandingChanged);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
