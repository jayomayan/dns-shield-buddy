
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow delete settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow insert settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow read settings" ON public.user_settings;
DROP POLICY IF EXISTS "Allow update settings" ON public.user_settings;

-- Recreate as permissive policies (default)
CREATE POLICY "Allow read settings"
  ON public.user_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow insert settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update settings"
  ON public.user_settings FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete settings"
  ON public.user_settings FOR DELETE
  USING (true);
