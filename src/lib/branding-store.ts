// Branding & theme preset store — DB-backed with localStorage cache

import { supabase } from "@/lib/supabase-client";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface BrandingConfig {
  brandName: string;
  logoUrl: string; // empty = use default Globe icon
  themePreset: string; // preset id
}

const STORAGE_KEY = "dnsguard-branding";

const defaults: BrandingConfig = {
  brandName: "DNSGuard",
  logoUrl: "",
  themePreset: "cyan-shield",
};

export function getBranding(): BrandingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

/** Load branding from DB and update localStorage cache */
export async function loadBrandingFromDB(): Promise<BrandingConfig> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("brand_name, logo_url, theme_preset")
      .eq("user_id", SYSTEM_USER_ID)
      .maybeSingle();

    if (error || !data) return getBranding();

    const config: BrandingConfig = {
      brandName: data.brand_name || defaults.brandName,
      logoUrl: data.logo_url || defaults.logoUrl,
      themePreset: data.theme_preset || defaults.themePreset,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("branding-changed", { detail: config }));
    return config;
  } catch {
    return getBranding();
  }
}

/** Save branding to both localStorage and DB */
export async function saveBranding(patch: Partial<BrandingConfig>): Promise<BrandingConfig> {
  const current = getBranding();
  const updated = { ...current, ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("branding-changed", { detail: updated }));

  // Update document title
  document.title = updated.brandName || defaults.brandName;

  // Persist to DB via upsert to handle missing rows
  const dbRow: Record<string, string> = { user_id: SYSTEM_USER_ID };
  if (patch.brandName !== undefined) dbRow.brand_name = patch.brandName;
  if (patch.logoUrl !== undefined) dbRow.logo_url = patch.logoUrl;
  if (patch.themePreset !== undefined) dbRow.theme_preset = patch.themePreset;

  if (Object.keys(dbRow).length > 1) {
    const { error } = await supabase
      .from("user_settings")
      .upsert(dbRow, { onConflict: "user_id" });
    if (error) console.error("Branding save error:", error);
  }

  return updated;
}

// ── Theme Presets ─────────────────────────────────────────────────────────────

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: { primary: string; accent: string; bg: string }; // for swatch display
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const themePresets: ThemePreset[] = [
  {
    id: "cyan-shield",
    name: "Cyan Shield",
    description: "Default — electric cyan cybersecurity aesthetic",
    preview: { primary: "hsl(190, 95%, 40%)", accent: "hsl(190, 80%, 35%)", bg: "hsl(220, 20%, 7%)" },
    light: {},
    dark: {},
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Fresh green with nature-inspired tones",
    preview: { primary: "hsl(155, 80%, 38%)", accent: "hsl(160, 70%, 30%)", bg: "hsl(160, 15%, 8%)" },
    light: {
      "--primary": "155 80% 38%", "--primary-foreground": "0 0% 100%",
      "--accent": "160 70% 30%", "--accent-foreground": "0 0% 100%",
      "--ring": "155 80% 38%", "--sidebar-primary": "155 80% 38%",
      "--sidebar-primary-foreground": "0 0% 100%", "--sidebar-ring": "155 80% 38%",
      "--chart-forwarded": "155 80% 38%",
    },
    dark: {
      "--primary": "155 80% 48%", "--primary-foreground": "160 20% 7%",
      "--accent": "160 70% 40%", "--accent-foreground": "210 20% 95%",
      "--ring": "155 80% 48%", "--sidebar-primary": "155 80% 48%",
      "--sidebar-primary-foreground": "160 20% 7%", "--sidebar-ring": "155 80% 48%",
      "--chart-forwarded": "155 80% 48%",
    },
  },
  {
    id: "amber",
    name: "Amber",
    description: "Warm golden tones for a bold look",
    preview: { primary: "hsl(38, 92%, 50%)", accent: "hsl(30, 85%, 45%)", bg: "hsl(30, 15%, 8%)" },
    light: {
      "--primary": "38 92% 50%", "--primary-foreground": "30 20% 10%",
      "--accent": "30 85% 45%", "--accent-foreground": "0 0% 100%",
      "--ring": "38 92% 50%", "--sidebar-primary": "38 92% 50%",
      "--sidebar-primary-foreground": "30 20% 10%", "--sidebar-ring": "38 92% 50%",
      "--chart-forwarded": "38 92% 50%",
    },
    dark: {
      "--primary": "38 92% 55%", "--primary-foreground": "30 20% 7%",
      "--accent": "30 85% 50%", "--accent-foreground": "210 20% 95%",
      "--ring": "38 92% 55%", "--sidebar-primary": "38 92% 55%",
      "--sidebar-primary-foreground": "30 20% 7%", "--sidebar-ring": "38 92% 55%",
      "--chart-forwarded": "38 92% 55%",
    },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Deep purple with modern elegance",
    preview: { primary: "hsl(270, 70%, 55%)", accent: "hsl(280, 60%, 45%)", bg: "hsl(270, 20%, 8%)" },
    light: {
      "--primary": "270 70% 55%", "--primary-foreground": "0 0% 100%",
      "--accent": "280 60% 45%", "--accent-foreground": "0 0% 100%",
      "--ring": "270 70% 55%", "--sidebar-primary": "270 70% 55%",
      "--sidebar-primary-foreground": "0 0% 100%", "--sidebar-ring": "270 70% 55%",
      "--chart-forwarded": "270 70% 55%",
    },
    dark: {
      "--primary": "270 70% 62%", "--primary-foreground": "270 20% 7%",
      "--accent": "280 60% 55%", "--accent-foreground": "210 20% 95%",
      "--ring": "270 70% 62%", "--sidebar-primary": "270 70% 62%",
      "--sidebar-primary-foreground": "270 20% 7%", "--sidebar-ring": "270 70% 62%",
      "--chart-forwarded": "270 70% 62%",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Soft pink for a friendly, approachable feel",
    preview: { primary: "hsl(345, 75%, 55%)", accent: "hsl(340, 65%, 45%)", bg: "hsl(340, 15%, 8%)" },
    light: {
      "--primary": "345 75% 55%", "--primary-foreground": "0 0% 100%",
      "--accent": "340 65% 45%", "--accent-foreground": "0 0% 100%",
      "--ring": "345 75% 55%", "--sidebar-primary": "345 75% 55%",
      "--sidebar-primary-foreground": "0 0% 100%", "--sidebar-ring": "345 75% 55%",
      "--chart-forwarded": "345 75% 55%",
    },
    dark: {
      "--primary": "345 75% 60%", "--primary-foreground": "340 20% 7%",
      "--accent": "340 65% 55%", "--accent-foreground": "210 20% 95%",
      "--ring": "345 75% 60%", "--sidebar-primary": "345 75% 60%",
      "--sidebar-primary-foreground": "340 20% 7%", "--sidebar-ring": "345 75% 60%",
      "--chart-forwarded": "345 75% 60%",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Minimal neutral monochrome",
    preview: { primary: "hsl(215, 20%, 45%)", accent: "hsl(215, 15%, 40%)", bg: "hsl(215, 20%, 8%)" },
    light: {
      "--primary": "215 20% 45%", "--primary-foreground": "0 0% 100%",
      "--accent": "215 15% 40%", "--accent-foreground": "0 0% 100%",
      "--ring": "215 20% 45%", "--sidebar-primary": "215 20% 45%",
      "--sidebar-primary-foreground": "0 0% 100%", "--sidebar-ring": "215 20% 45%",
      "--chart-forwarded": "215 20% 45%",
    },
    dark: {
      "--primary": "215 20% 55%", "--primary-foreground": "215 20% 7%",
      "--accent": "215 15% 50%", "--accent-foreground": "210 20% 95%",
      "--ring": "215 20% 55%", "--sidebar-primary": "215 20% 55%",
      "--sidebar-primary-foreground": "215 20% 7%", "--sidebar-ring": "215 20% 55%",
      "--chart-forwarded": "215 20% 55%",
    },
  },
  {
    id: "frontier-towers",
    name: "Frontier Towers",
    description: "Warm red-orange inspired by Frontier Towers Philippines",
    preview: { primary: "hsl(5, 70%, 45%)", accent: "hsl(25, 90%, 50%)", bg: "hsl(5, 15%, 8%)" },
    light: {
      "--primary": "5 70% 45%", "--primary-foreground": "0 0% 100%",
      "--accent": "25 90% 50%", "--accent-foreground": "0 0% 100%",
      "--ring": "5 70% 45%", "--sidebar-primary": "5 70% 45%",
      "--sidebar-primary-foreground": "0 0% 100%", "--sidebar-ring": "5 70% 45%",
      "--chart-forwarded": "5 70% 45%",
    },
    dark: {
      "--primary": "5 70% 52%", "--primary-foreground": "5 20% 7%",
      "--accent": "25 90% 55%", "--accent-foreground": "210 20% 95%",
      "--ring": "5 70% 52%", "--sidebar-primary": "5 70% 52%",
      "--sidebar-primary-foreground": "5 20% 7%", "--sidebar-ring": "5 70% 52%",
      "--chart-forwarded": "5 70% 52%",
    },
  },
];

export function getPresetById(id: string): ThemePreset {
  return themePresets.find((p) => p.id === id) || themePresets[0];
}

/** Apply a preset's CSS vars to :root */
export function applyThemePreset(presetId: string, isDark: boolean) {
  const preset = getPresetById(presetId);
  const vars = isDark ? preset.dark : preset.light;
  const root = document.documentElement;

  // First remove all preset-applied vars (reset to CSS defaults)
  const allKeys = new Set<string>();
  themePresets.forEach((p) => {
    Object.keys(p.light).forEach((k) => allKeys.add(k));
    Object.keys(p.dark).forEach((k) => allKeys.add(k));
  });
  allKeys.forEach((key) => root.style.removeProperty(key));

  // Apply current preset vars
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
