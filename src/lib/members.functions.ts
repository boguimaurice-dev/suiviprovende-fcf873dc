import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeCode(code: string) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function endOfToday() {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

// ---------- Owner side ----------

export const createMemberCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { label: string }) => {
    const label = String(input?.label ?? "").trim().slice(0, 60);
    if (!label) throw new Error("Indiquez le nom du membre");
    return { label };
  })
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    const expiresAt = endOfToday();
    const { error } = await context.supabase.from("member_codes").insert({
      owner_id: context.userId,
      label: data.label,
      code_hash: await sha256(code),
      expires_at: expiresAt,
    });
    if (error) throw new Error("Création du code impossible");
    return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt };
  });

// ---------- Member side (public, protected by the code) ----------

async function resolveCode(code: string) {
  const clean = normalizeCode(code);
  if (clean.length !== 8) throw new Error("Code invalide ou expiré");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_codes")
    .select("id, owner_id, label, expires_at, revoked_at")
    .eq("code_hash", await sha256(clean))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at) < new Date()) {
    throw new Error("Code invalide ou expiré");
  }
  return { access: data, supabaseAdmin };
}

export const memberSession = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({ code: String(input?.code ?? "") }))
  .handler(async ({ data }) => {
    const { access, supabaseAdmin } = await resolveCode(data.code);
    const [{ data: row }, { data: entries }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("app_data").select("data").eq("user_id", access.owner_id).maybeSingle(),
      supabaseAdmin
        .from("member_entries")
        .select("id, kind, entry_date, payload, imported_at, created_at")
        .eq("code_id", access.id)
        .eq("entry_date", today())
        .order("created_at"),
      supabaseAdmin.from("profiles").select("company_name").eq("id", access.owner_id).maybeSingle(),
    ]);
    const db = (row?.data ?? {}) as {
      materials?: { id: string; name: string; stock?: number }[];
      formulas?: { id: string; name: string }[];
    };
    return {
      label: access.label,
      company: profile?.company_name ?? "",
      expiresAt: access.expires_at,
      today: today(),
      materials: (db.materials ?? []).map((m) => ({
        id: String(m.id),
        name: String(m.name ?? ""),
        stock: Number(m.stock) || 0,
      })),
      formulas: (db.formulas ?? []).map((f) => ({ id: String(f.id), name: String(f.name ?? "") })),
      entries: (entries ?? []).map((e) => ({
        id: e.id,
        kind: e.kind as "production" | "receipt",
        payload: e.payload as { formulaId?: string; materialId?: string; tonnes?: number; qty?: number; note?: string },
        imported: !!e.imported_at,
      })),
    };
  });

type EntryInput = {
  code: string;
  id?: string | undefined;
  kind: "production" | "receipt";
  refId: string;
  qty: number;
  note?: string | undefined;
};

export const memberSaveEntry = createServerFn({ method: "POST" })
  .inputValidator((input: EntryInput) => {
    if (input?.kind !== "production" && input?.kind !== "receipt") throw new Error("Type invalide");
    const qty = Number(input.qty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1e7) throw new Error("Quantité invalide");
    const refId = String(input.refId ?? "").slice(0, 100);
    if (!refId) throw new Error("Choisissez un élément");
    return {
      code: String(input.code ?? ""),
      id: input.id ? String(input.id) : undefined,
      kind: input.kind,
      refId,
      qty,
      note: String(input.note ?? "").slice(0, 200),
    };
  })
  .handler(async ({ data }) => {
    const { access, supabaseAdmin } = await resolveCode(data.code);
    const payload =
      data.kind === "production"
        ? { formulaId: data.refId, tonnes: data.qty, note: data.note }
        : { materialId: data.refId, qty: data.qty, note: data.note };
    if (data.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("member_entries")
        .update({ payload, kind: data.kind })
        .eq("id", data.id)
        .eq("code_id", access.id)
        .eq("entry_date", today())
        .is("imported_at", null)
        .select("id");
      if (error || !updated?.length)
        throw new Error("Cette saisie a déjà été intégrée par le responsable et ne peut plus être modifiée");
    } else {
      const { error } = await supabaseAdmin.from("member_entries").insert({
        owner_id: access.owner_id,
        code_id: access.id,
        member_label: access.label,
        kind: data.kind,
        entry_date: today(),
        payload,
      });
      if (error) throw new Error("Enregistrement impossible");
    }
    return { ok: true };
  });

export const memberDeleteEntry = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; id: string }) => ({
    code: String(input?.code ?? ""),
    id: String(input?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { access, supabaseAdmin } = await resolveCode(data.code);
    const { data: deleted } = await supabaseAdmin
      .from("member_entries")
      .delete()
      .eq("id", data.id)
      .eq("code_id", access.id)
      .eq("entry_date", today())
      .is("imported_at", null)
      .select("id");
    if (!deleted?.length)
      throw new Error("Cette saisie a déjà été intégrée par le responsable et ne peut plus être supprimée");
    return { ok: true };
  });
