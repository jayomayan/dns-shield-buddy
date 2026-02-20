import { useState, useEffect, useCallback } from "react";
import { getActiveClient } from "@/lib/supabase-client";
import { User } from "@supabase/supabase-js";
import { Json } from "@/integrations/supabase/types";

export interface UserSettings {
  bridge_url: string | null;
  bridge_api_key: string | null;
  okta_domain: string | null;
  okta_client_id: string | null;
  okta_client_secret: string | null;
  okta_enabled: boolean;
  api_tokens: Json | null;
  log_retention: string;
  log_rotation: string;
  log_max_size: string;
  notify_blocked: boolean;
  notify_service: boolean;
}

export const SETTINGS_DEFAULTS: UserSettings = {
  bridge_url: null,
  bridge_api_key: null,
  okta_domain: null,
  okta_client_id: null,
  okta_client_secret: null,
  okta_enabled: false,
  api_tokens: null,
  log_retention: "30",
  log_rotation: "daily",
  log_max_size: "500",
  notify_blocked: true,
  notify_service: true,
};

export function useUserSettings(user: User | null) {
  const [settings, setSettings] = useState<UserSettings>(SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(SETTINGS_DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await getActiveClient()
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch settings:", error);
    } else if (data) {
      setSettings({
        bridge_url: data.bridge_url,
        bridge_api_key: data.bridge_api_key,
        okta_domain: data.okta_domain,
        okta_client_id: data.okta_client_id,
        okta_client_secret: data.okta_client_secret,
        okta_enabled: data.okta_enabled,
        api_tokens: data.api_tokens,
        log_retention: data.log_retention,
        log_rotation: data.log_rotation,
        log_max_size: data.log_max_size,
        notify_blocked: data.notify_blocked,
        notify_service: data.notify_service,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async (updates: Partial<UserSettings>): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    const merged = { ...settings, ...updates };

    const { error } = await getActiveClient()
      .from("user_settings")
      .upsert(
        [{ user_id: user.id, ...merged }],
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Failed to save settings:", error);
      setSaving(false);
      return false;
    }

    setSettings(merged);
    setSaving(false);
    return true;
  }, [user, settings]);

  return { settings, loading, saving, saveSettings, refetch: fetchSettings };
}
