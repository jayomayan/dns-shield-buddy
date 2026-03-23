-- Migration: add branding columns to user_settings on self-hosted Supabase
-- Run this on your self-hosted Supabase at dnsguard.frontiertowersphilippines.com

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS brand_name  text NOT NULL DEFAULT 'DNSGuard',
  ADD COLUMN IF NOT EXISTS logo_url    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'cyan-shield';
