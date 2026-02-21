-- Migration for self-hosted Supabase: create user_settings table
-- Run this on your self-hosted Supabase at dnsguard.frontiertowersphilippines.com

CREATE TABLE IF NOT EXISTS public.user_settings (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL UNIQUE,
  bridge_url      text,
  bridge_api_key  text,
  okta_domain     text,
  okta_client_id  text,
  okta_client_secret text,
  okta_enabled    boolean     NOT NULL DEFAULT false,
  api_tokens      jsonb,
  log_retention   text        NOT NULL DEFAULT '30',
  log_rotation    text        NOT NULL DEFAULT 'daily',
  log_max_size    text        NOT NULL DEFAULT '500',
  notify_blocked  boolean     NOT NULL DEFAULT true,
  notify_service  boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Permissive policies (needed because app uses a system user, not Supabase Auth)
CREATE POLICY "Allow read settings"   ON public.user_settings FOR SELECT USING (true);
CREATE POLICY "Allow insert settings" ON public.user_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update settings" ON public.user_settings FOR UPDATE USING (true);
CREATE POLICY "Allow delete settings" ON public.user_settings FOR DELETE USING (true);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_settings_updated_at();

-- Seed the system row so the app can read/write immediately
INSERT INTO public.user_settings (user_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
