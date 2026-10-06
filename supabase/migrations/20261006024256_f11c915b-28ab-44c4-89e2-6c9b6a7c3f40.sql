CREATE OR REPLACE FUNCTION public.import_member_entries()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE owner uuid := auth.uid(); doc jsonb; entry record; p jsonb; ref text; quantity numeric; old_quantity numeric; idx integer; imported integer := 0;
BEGIN
 IF owner IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 INSERT INTO public.app_data(user_id, data) VALUES (owner, '{}'::jsonb) ON CONFLICT (user_id) DO NOTHING;
 SELECT data INTO doc FROM public.app_data WHERE user_id = owner FOR UPDATE;
 doc := COALESCE(doc, '{}'::jsonb);
 IF NOT (doc ? 'days') THEN doc := jsonb_set(doc, '{days}', '{}'::jsonb); END IF;
 IF NOT (doc ? 'receipts') THEN doc := jsonb_set(doc, '{receipts}', '[]'::jsonb); END IF;
 FOR entry IN SELECT * FROM public.member_entries WHERE owner_id = owner AND imported_at IS NULL ORDER BY created_at FOR UPDATE LOOP
  p := entry.payload;
  IF entry.kind = 'production' THEN
   ref := p->>'formulaId'; quantity := (p->>'tonnes')::numeric;
   IF quantity IS NULL OR quantity <= 0 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(doc->'formulas', '[]'::jsonb)) f WHERE f->>'id' = ref) THEN CONTINUE; END IF;
   IF NOT ((doc->'days') ? entry.entry_date::text) THEN doc := jsonb_set(doc, ARRAY['days',entry.entry_date::text], '{"formulas":{},"faciKg":0,"note":""}'::jsonb); END IF;
   IF NOT ((doc #> ARRAY['days',entry.entry_date::text]) ? 'formulas') THEN doc := jsonb_set(doc, ARRAY['days',entry.entry_date::text,'formulas'], '{}'::jsonb); END IF;
   old_quantity := COALESCE((doc #>> ARRAY['days',entry.entry_date::text,'formulas',ref])::numeric,0);
   doc := jsonb_set(doc, ARRAY['days',entry.entry_date::text,'formulas',ref], to_jsonb(old_quantity + quantity));
   doc := jsonb_set(doc, ARRAY['days',entry.entry_date::text,'note'], to_jsonb(concat_ws(' · ', NULLIF(doc #>> ARRAY['days',entry.entry_date::text,'note'], ''), entry.member_label || CASE WHEN COALESCE(p->>'note','') <> '' THEN ': ' || (p->>'note') ELSE '' END)));
  ELSIF entry.kind = 'receipt' THEN
   ref := p->>'materialId'; quantity := (p->>'qty')::numeric;
   SELECT (ordinality - 1)::integer INTO idx FROM jsonb_array_elements(COALESCE(doc->'materials', '[]'::jsonb)) WITH ORDINALITY AS m(value, ordinality) WHERE value->>'id' = ref LIMIT 1;
   IF idx IS NULL OR quantity IS NULL OR quantity <= 0 THEN CONTINUE; END IF;
   doc := jsonb_set(doc, ARRAY['materials',idx::text,'stock'], to_jsonb(COALESCE((doc #>> ARRAY['materials',idx::text,'stock'])::numeric,0) + quantity));
   doc := jsonb_set(doc, '{receipts}', (doc->'receipts') || jsonb_build_array(jsonb_build_object('id',entry.id,'date',entry.entry_date,'materialId',ref,'qty',quantity,'note',concat_ws(' · ',entry.member_label,NULLIF(p->>'note','')),'memberEntryId',entry.id)));
  ELSE CONTINUE;
  END IF;
  UPDATE public.member_entries SET imported_at = now() WHERE id = entry.id AND owner_id = owner;
  imported := imported + 1;
 END LOOP;
 IF imported > 0 THEN UPDATE public.app_data SET data = doc, updated_at = now() WHERE user_id = owner; END IF;
 RETURN jsonb_build_object('data',doc,'count',imported);
END;
$$;
REVOKE ALL ON FUNCTION public.import_member_entries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_member_entries() TO authenticated;
