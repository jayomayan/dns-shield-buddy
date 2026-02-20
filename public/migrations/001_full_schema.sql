-- DNSGuard Full Schema Migration
-- Apply to self-hosted Supabase PostgreSQL:
--   psql -h localhost -p 5432 -U postgres -d postgres -f 001_full_schema.sql

-- ═══════════════════════════════════════════════════════════════
-- 1. user_settings table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  bridge_url TEXT,
  bridge_api_key TEXT,
  okta_domain TEXT,
  okta_client_id TEXT,
  okta_client_secret TEXT,
  okta_enabled BOOLEAN NOT NULL DEFAULT false,
  api_tokens JSONB,
  log_retention TEXT NOT NULL DEFAULT '30',
  log_rotation TEXT NOT NULL DEFAULT 'daily',
  log_max_size TEXT NOT NULL DEFAULT '500',
  notify_blocked BOOLEAN NOT NULL DEFAULT true,
  notify_service BOOLEAN NOT NULL DEFAULT true,
  db_type TEXT NOT NULL DEFAULT 'local',
  db_host TEXT,
  db_port TEXT,
  db_name TEXT,
  db_user TEXT,
  db_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. Row-Level Security
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own settings' AND tablename = 'user_settings') THEN
    CREATE POLICY "Users can view own settings"
      ON public.user_settings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own settings' AND tablename = 'user_settings') THEN
    CREATE POLICY "Users can insert own settings"
      ON public.user_settings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own settings' AND tablename = 'user_settings') THEN
    CREATE POLICY "Users can update own settings"
      ON public.user_settings FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Auto-update timestamp trigger
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_settings_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Done! Verify with:  \dt public.*
-- ═══════════════════════════════════════════════════════════════
