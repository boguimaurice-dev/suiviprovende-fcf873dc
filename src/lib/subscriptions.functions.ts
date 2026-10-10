import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROMO_MONTHS, promoRemaining } from "./subscription";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès réservé à l'administrateur");
}

// Public: only returns the number of remaining promo slots.
export const getPromoSlots = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id", { count: "exact", head: true })
    .eq("promo", true);
  return { remaining: promoRemaining(count ?? 0) };
});

export const adminListSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: subs }, { data: surveys }] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("user_id, paid_until, promo, promo_until"),
      supabaseAdmin
        .from("survey_responses")
        .select("id, user_id, rating, liked, issues, suggestions, price_opinion, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const promoCount = (subs ?? []).filter((s) => s.promo).length;
    return { subs: subs ?? [], surveys: surveys ?? [], promoRemaining: promoRemaining(promoCount) };
  });

export const adminRecordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; months: number; promo: boolean }) => {
    if (typeof input?.userId !== "string" || !input.userId) throw new Error("Compte invalide");
    const months = Math.round(Number(input.months));
    if (!(months >= 0 && months <= 24)) throw new Error("Durée invalide");
    return { userId: input.userId, months, promo: !!input.promo };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("paid_until, promo, promo_until")
      .eq("user_id", data.userId)
      .maybeSingle();
    let promo = existing?.promo ?? false;
    let promoUntil = existing?.promo_until ?? null;
    if (data.promo && !promo) {
      const { count } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id", { count: "exact", head: true })
        .eq("promo", true);
      if (promoRemaining(count ?? 0) <= 0) throw new Error("Les 10 places promo sont déjà prises");
      promo = true;
      const d = new Date();
      d.setMonth(d.getMonth() + PROMO_MONTHS);
      promoUntil = d.toISOString();
    }
    let paidUntil: string | null = null;
    if (data.months > 0) {
      const base =
        existing?.paid_until && new Date(existing.paid_until) > new Date()
          ? new Date(existing.paid_until)
          : new Date();
      base.setMonth(base.getMonth() + data.months);
      paidUntil = base.toISOString();
    }
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      { user_id: data.userId, paid_until: paidUntil, promo, promo_until: promoUntil },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("Enregistrement impossible");
    return { ok: true };
  });
