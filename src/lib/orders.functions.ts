import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Line = { name: string; qty: number; unitPrice: number };
type Snapshot = {
  company: string;
  supplier: string;
  date: string;
  expected: string;
  note: string;
  lines: Line[];
};

const s = (v: unknown, n: number) => String(v ?? "").slice(0, n);

// Owner: create a secure confirmation link for one order
export const createOrderLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; snapshot: Snapshot }) => {
    const orderId = s(input?.orderId, 80);
    if (!orderId) throw new Error("Commande invalide");
    const raw = input?.snapshot ?? ({} as Snapshot);
    const lines = (Array.isArray(raw.lines) ? raw.lines : []).slice(0, 100).map((l) => ({
      name: s(l?.name, 120),
      qty: Number(l?.qty) || 0,
      unitPrice: Number(l?.unitPrice) || 0,
    }));
    if (!lines.length) throw new Error("Commande vide");
    return {
      orderId,
      snapshot: {
        company: s(raw.company, 120),
        supplier: s(raw.supplier, 120),
        date: s(raw.date, 10),
        expected: s(raw.expected, 10),
        note: s(raw.note, 500),
        lines,
      },
    };
  })
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.from("order_links").insert({
      owner_id: context.userId,
      order_id: data.orderId,
      token_hash: await sha256(token),
      snapshot: data.snapshot as never,
    });
    if (error) throw new Error("Création du lien impossible");
    return { token };
  });

// Owner: list supplier responses
export const listOrderResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("order_links")
      .select("order_id, status, supplier_note, responded_at")
      .eq("owner_id", context.userId)
      .neq("status", "pending")
      .order("responded_at", { ascending: true });
    return { responses: data ?? [] };
  });

// Supplier (public, protected by the secret token)
async function findLink(token: string) {
  const clean = String(token || "").replace(/[^a-f0-9]/g, "");
  if (clean.length !== 48) throw new Error("Lien invalide ou expiré");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("order_links")
    .select("id, snapshot, status, supplier_note, responded_at, expires_at")
    .eq("token_hash", await sha256(clean))
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) throw new Error("Lien invalide ou expiré");
  return { link: data, supabaseAdmin };
}

export const getOrderForSupplier = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: s(input?.token, 100) }))
  .handler(async ({ data }) => {
    const { link } = await findLink(data.token);
    return {
      snapshot: link.snapshot as unknown as Snapshot,
      status: link.status,
      note: link.supplier_note ?? "",
      respondedAt: link.responded_at,
    };
  });

export const respondToOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; status: string; note?: string }) => {
    if (input?.status !== "confirmed" && input?.status !== "declined") throw new Error("Réponse invalide");
    return { token: s(input.token, 100), status: input.status, note: s(input.note, 500).trim() };
  })
  .handler(async ({ data }) => {
    const { link, supabaseAdmin } = await findLink(data.token);
    if (link.status !== "pending") throw new Error("Cette commande a déjà reçu une réponse");
    const { error } = await supabaseAdmin
      .from("order_links")
      .update({ status: data.status, supplier_note: data.note || null, responded_at: new Date().toISOString() })
      .eq("id", link.id)
      .eq("status", "pending");
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });
