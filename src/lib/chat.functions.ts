import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const inputSchema = z.object({
  question: z.string().min(1).max(2000),
  today: z.string(),
  history: z.array(messageSchema).max(12).default([]),
  snapshot: z.string().max(30000),
});

export type ChatRow = {
  type: "entree" | "sortie" | "production" | "vente" | "ajustement";
  date: string;
  targetId: string | null;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number | null;
  note: string;
};

function parsePayload(content: string): { answer: string; rows: ChatRow[] } {
  const cleaned = content.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return { answer: cleaned, rows: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { answer: cleaned, rows: [] };
  }
  const obj = parsed as { answer?: unknown; rows?: unknown[] };
  const allowed = new Set(["entree", "sortie", "production", "vente", "ajustement"]);
  const rows = Array.isArray(obj.rows)
    ? obj.rows
        .map((raw) => {
          const r = raw as Record<string, unknown>;
          const type = String(r["type"] ?? "");
          if (!allowed.has(type)) return null;
          const qty = Number(String(r["qty"] ?? 0).replace(",", "."));
          const price = r["unitPrice"] == null ? null : Number(String(r["unitPrice"]).replace(",", "."));
          const str = (v: unknown) => (v == null || v === "" ? null : String(v));
          return {
            type: type as ChatRow["type"],
            date: String(r["date"] ?? "").slice(0, 10),
            targetId: str(r["targetId"]),
            label: String(r["label"] ?? ""),
            qty: Number.isFinite(qty) ? qty : 0,
            unit: String(r["unit"] ?? "kg"),
            unitPrice: price != null && Number.isFinite(price) ? price : null,
            note: String(r["note"] ?? ""),
          } satisfies ChatRow;
        })
        .filter((r): r is ChatRow => r !== null)
    : [];
  return { answer: String(obj.answer ?? "").trim() || "D'accord.", rows };
}

export const chatWithApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Le dialogue est indisponible (clé IA manquante).");

    const system = `Tu es l'assistant de Provende, une application de gestion d'usine d'aliments pour volaille en Côte d'Ivoire. Tu parles français, simplement et brièvement.

Date du jour : ${data.today}

Tu disposes de l'état actuel des données de l'utilisateur ci-dessous (stocks, formules, aliments finis, derniers mouvements). Réponds aux questions en t'appuyant UNIQUEMENT sur ces données ; si l'information manque, dis-le.

Quand l'utilisateur demande d'ENREGISTRER quelque chose (réception, sortie, production, vente, mise à niveau de stock), ne l'enregistre pas toi-même : propose des lignes dans "rows" qu'il validera.

Types de lignes : "entree" (réception de matière), "sortie" (consommation/casse/perte), "production" (fabrication d'une formule), "vente" (aliment fini vendu), "ajustement" (mise à niveau du stock réel compté).
targetId = identifiant exact pris dans les données (matière, formule ou aliment) sinon null.

Réponds TOUJOURS en JSON strict, sans texte autour :
{"answer":"ta réponse en français","rows":[{"type":"entree","date":"YYYY-MM-DD","targetId":"mp1","label":"Maïs","qty":2000,"unit":"kg","unitPrice":null,"note":""}]}
Si aucune écriture n'est demandée, rows vaut [].

ÉTAT DES DONNÉES :
${data.snapshot}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: system },
          ...data.history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: data.question },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[chat] gateway error", res.status, body);
      if (res.status === 429) throw new Error("Trop de questions d'un coup, réessayez dans une minute.");
      if (res.status === 402 || res.status === 403)
        throw new Error("Le dialogue est momentanément bloqué sur votre compte.");
      throw new Error("La réponse n'a pas pu être obtenue. Réessayez.");
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parsePayload(json.choices?.[0]?.message?.content ?? "");
  });
