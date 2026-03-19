ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS brand_name text NOT NULL DEFAULT 'DNSGuard';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'cyan-shield';