CREATE TABLE public.order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  order_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  supplier_note text,
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.order_links TO authenticated;
GRANT ALL ON public.order_links TO service_role;
ALTER TABLE public.order_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own order links" ON public.order_links FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners create own order links" ON public.order_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete own order links" ON public.order_links FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX order_links_owner_idx ON public.order_links(owner_id, order_id);