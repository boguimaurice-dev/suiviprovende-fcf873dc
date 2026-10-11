import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRO_MONTHLY = 15000;
export const PRO_YEARLY = 150000;

// Paystack XOF amounts are expressed in the smallest unit (x100).
export const startPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: "month" | "year" }) => {
    if (input?.plan !== "month" && input?.plan !== "year") throw new Error("Formule invalide");
    return { plan: input.plan };
  })
  .handler(async ({ data, context }) => {
    const key = process.env["PAYSTACK_SECRET_KEY"];
    if (!key) throw new Error("Paiement en ligne indisponible pour le moment");
    const { supabase, userId, claims } = context as any;
    const email = claims?.email as string | undefined;
    if (!email) throw new Error("Adresse e-mail introuvable");
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("promo, promo_until")
      .eq("user_id", userId)
      .maybeSingle();
    const promoActive = !!sub?.promo && !!sub.promo_until && new Date(sub.promo_until) > new Date();
    const months = data.plan === "year" ? 12 : 1;
    const price = data.plan === "year" ? PRO_YEARLY : promoActive ? 5000 : PRO_MONTHLY;
    const origin = new URL(
      (await import("@tanstack/react-start/server")).getRequestUrl().toString(),
    ).origin;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: price * 100,
        currency: "XOF",
        callback_url: `${origin}/paiement/retour`,
        metadata: { user_id: userId, months },
      }),
    });
    const json = (await res.json()) as { status?: boolean; data?: { authorization_url?: string } };
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      throw new Error("Impossible de démarrer le paiement");
    }
    return { url: json.data.authorization_url };
  });
