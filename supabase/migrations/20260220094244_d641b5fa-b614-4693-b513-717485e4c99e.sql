
-- Drop existing restrictive policies (they require auth.uid() which doesn't work with Okta/Local Admin auth)
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;

-- Add permissive policies - security is handled at the application layer via Okta SSO / Local Admin
CREATE POLICY "Allow read settings" ON public.user_settings FOR SELECT USING (true);
CREATE POLICY "Allow insert settings" ON public.user_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update settings" ON public.user_settings FOR UPDATE USING (true);
CREATE POLICY "Allow delete settings" ON public.user_settings FOR DELETE USING (true);
