import { createContext, useContext, useEffect, useState } from "react";

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
    const applyTheme = (t: Theme) => {
      const resolved = t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
    };
    applyTheme(theme);
    localStorage.setItem("dnsguard-theme", theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
