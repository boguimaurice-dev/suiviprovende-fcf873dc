CREATE OR REPLACE FUNCTION public.protect_profile_created_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.created_at := OLD.created_at; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS protect_profiles_created_at ON public.profiles;
CREATE TRIGGER protect_profiles_created_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_created_at();

DROP POLICY IF EXISTS "Users manage own app data" ON public.app_data;
CREATE POLICY "Users read own app data" ON public.app_data FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users with access write own app data" ON public.app_data FOR ALL TO authenticated
USING (auth.uid() = user_id AND (
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  OR EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = auth.uid() AND s.paid_until > now())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.created_at > now() - interval '17 days')))
WITH CHECK (auth.uid() = user_id AND (
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  OR EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = auth.uid() AND s.paid_until > now())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.created_at > now() - interval '17 days')));