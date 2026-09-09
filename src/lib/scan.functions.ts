import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const refSchema = z.object({ id: z.string(), name: z.string() });

const inputSchema = z.object({
  mimeType: z.string(),
  fileName: z.string().default("fiche"),
  dataUrl: z.string().min(20),
  today: z.string(),
  materials: z.array(refSchema).default([]),
  formulas: z.array(refSchema).default([]),
  finished: z.array(refSchema).default([]),
});

export type ScanRow = {
  type: "entree" | "sortie" | "production" | "vente";
  date: string;
  materialId: string | null;
  formulaId: string | null;
  finishedId: string | null;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number | null;
  client: string | null;
  note: string;
};

function buildPrompt(input: z.infer<typeof inputSchema>) {
  const list = (rows: { id: string; name: string }[]) =>
    rows.map((r) => `${r.id} = ${r.name}`).join(" | ") || "(aucun)";
  return `Tu lis une fiche manuscrite ou imprimée d'une usine d'aliments pour volaille (Côte d'Ivoire, français).
Extrait UNIQUEMENT les lignes de trafic du jour réellement écrites sur le document.

Date du jour si aucune date n'est écrite : ${input.today}

Matières premières existantes : ${list(input.materials)}
Formules existantes : ${list(input.formulas)}
Aliments finis existants : ${list(input.finished)}

Types de lignes :
- "entree" : réception / achat d'une matière première (matérielId obligatoire)
- "sortie" : matière première consommée, cassée, perdue ou sortie du magasin
- "production" : fabrication d'une formule (formulaId obligatoire)
- "vente" : vente ou livraison d'aliment fini (finishedId si reconnu)

Réponds en JSON strict, sans texte autour :
{"rows":[{"type":"entree","date":"YYYY-MM-DD","materialId":"mp6 ou null","formulaId":null,"finishedId":null,"label":"libellé lu sur la feuille","qty":0,"unit":"kg|t|sac|unite","unitPrice":null,"client":null,"note":""}]}

Règles : identifiants pris dans les listes ci-dessus quand le libellé correspond (même approximativement), sinon null et garde le libellé lu. qty est un nombre (point décimal). N'invente aucune ligne. Si le document est illisible, renvoie {"rows":[]}.`;
}

function parseRows(content: string): ScanRow[] {
  const cleaned = content.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  const rows = (parsed as { rows?: unknown[] })?.rows;
  if (!Array.isArray(rows)) return [];
  const allowed = new Set(["entree", "sortie", "production", "vente"]);
  return rows
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const type = String(r["type"] ?? "");
      if (!allowed.has(type)) return null;
      const qty = Number(String(r["qty"] ?? 0).replace(",", "."));
      const price = r["unitPrice"] == null ? null : Number(String(r["unitPrice"]).replace(",", "."));
      const str = (v: unknown) => (v == null || v === "" ? null : String(v));
      return {
        type: type as ScanRow["type"],
        date: String(r["date"] ?? "").slice(0, 10),
        materialId: str(r["materialId"]),
        formulaId: str(r["formulaId"]),
        finishedId: str(r["finishedId"]),
        label: String(r["label"] ?? ""),
        qty: Number.isFinite(qty) ? qty : 0,
        unit: String(r["unit"] ?? "kg"),
        unitPrice: price != null && Number.isFinite(price) ? price : null,
        client: str(r["client"]),
        note: String(r["note"] ?? ""),
      } satisfies ScanRow;
    })
    .filter((r): r is ScanRow => r !== null);
}

export const scanDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Lecture automatique indisponible (clé IA manquante).");

    const isPdf = data.mimeType.includes("pdf");
    const contentBlock = isPdf
      ? {
          type: "file",
          file: { filename: data.fileName || "fiche.pdf", file_data: data.dataUrl },
        }
      : { type: "image_url", image_url: { url: data.dataUrl } };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: buildPrompt(data) }, contentBlock],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[scan] gateway error", res.status, body);
      if (res.status === 429) throw new Error("Trop de lectures d'un coup, réessayez dans une minute.");
      if (res.status === 402 || res.status === 403)
        throw new Error("La lecture automatique est momentanément bloquée sur votre compte.");
      throw new Error("La lecture du document a échoué. Réessayez avec une photo plus nette.");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { rows: parseRows(content) };
  });
