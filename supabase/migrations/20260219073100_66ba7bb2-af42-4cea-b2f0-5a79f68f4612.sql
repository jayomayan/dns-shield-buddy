ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS db_type text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS db_host text,
  ADD COLUMN IF NOT EXISTS db_port text,
  ADD COLUMN IF NOT EXISTS db_name text,
  ADD COLUMN IF NOT EXISTS db_user text,
  ADD COLUMN IF NOT EXISTS db_password text;