ALTER TABLE public.user_settings DROP COLUMN IF EXISTS local_admin_enabled;
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS admin_password_hash;