CREATE TABLE public.member_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_codes TO authenticated;
GRANT ALL ON public.member_codes TO service_role;
ALTER TABLE public.member_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own member codes" ON public.member_codes FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.member_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_id uuid NOT NULL REFERENCES public.member_codes(id) ON DELETE CASCADE,
  member_label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('production','receipt')),
  entry_date date NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_entries_owner_pending ON public.member_entries(owner_id) WHERE imported_at IS NULL;
GRANT SELECT, UPDATE, DELETE ON public.member_entries TO authenticated;
GRANT ALL ON public.member_entries TO service_role;
ALTER TABLE public.member_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own member entries" ON public.member_entries FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners update own member entries" ON public.member_entries FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete own member entries" ON public.member_entries FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_member_entries_updated_at BEFORE UPDATE ON public.member_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();