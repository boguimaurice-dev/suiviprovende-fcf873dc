import { createFileRoute } from "@tanstack/react-router";

async function hmacSha512Hex(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/paystack-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        const sig = request.headers.get("x-paystack-signature") ?? "";
        if (!safeEqual(await hmacSha512Hex(secret, raw), sig)) {
          return new Response("invalid signature", { status: 401 });
        }
        let event: any;
        try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
        if (event?.event !== "charge.success") return Response.json({ ok: true });

        const reference = String(event.data?.reference ?? "");
        if (!reference) return new Response("no reference", { status: 400 });

        // Re-verify with Paystack so the amount/status can't be forged.
        const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${secret}` },
        });
        const v = (await vr.json()) as any;
        if (!vr.ok || v?.data?.status !== "success") return new Response("not verified", { status: 400 });
        const userId = String(v.data.metadata?.user_id ?? "");
        const months = Number(v.data.metadata?.months);
        const amount = Number(v.data.amount);
        if (!/^[0-9a-f-]{36}$/i.test(userId) || ![1, 12].includes(months)) {
          return new Response("bad metadata", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: dupErr } = await supabaseAdmin
          .from("paystack_payments")
          .insert({ reference, user_id: userId, months, amount });
        if (dupErr) return Response.json({ ok: true, duplicate: true }); // already processed

        const { data: existing } = await supabaseAdmin
          .from("subscriptions")
          .select("paid_until")
          .eq("user_id", userId)
          .maybeSingle();
        const base =
          existing?.paid_until && new Date(existing.paid_until) > new Date()
            ? new Date(existing.paid_until)
            : new Date();
        base.setMonth(base.getMonth() + months);
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert({ user_id: userId, paid_until: base.toISOString() }, { onConflict: "user_id" });
        if (error) {
          await supabaseAdmin.from("paystack_payments").delete().eq("reference", reference);
          return new Response("db error", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
