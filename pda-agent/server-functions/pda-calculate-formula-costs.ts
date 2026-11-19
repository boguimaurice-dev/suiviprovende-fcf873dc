// pda-calculate-formula-costs.ts
//
// Pondération de coût (PDA - outil "calculate_formula_costs").
// Renvoie le coût unitaire par kg, sac de 50 kg et tonne ainsi que les
// ingrédients qui composent la formule, d'après les derniers prix d'achat.
//
// Lecture seule : aucune modification des données de l'utilisateur.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PdaData,
  calculateFormulaCost,
  resolveFormulas,
  resolveMaterials,
} from "../logic/pda-core";

export const calculateFormulaCosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { formulaId: string; batchQtyKg?: number }) => {
    if (!input?.formulaId) throw new Error("formulaId requis");
    if (input?.batchQtyKg !== undefined && input.batchQtyKg <= 0) {
      throw new Error("batchQtyKg doit être > 0");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("app_data")
      .select("data")
      .eq("user_id", context.userId)
      .maybeSingle();

    const raw = row?.data ?? null;
    const payload =
      typeof raw === "string" ? (JSON.parse(raw) as PdaData) : (raw as PdaData);
    const data = payload ?? {};

    const formula = resolveFormulas(data).find((f) => f.id === data.formulaId);
    if (!formula) throw new Error(`Formulation inconnue : ${data.formulaId}`);

    const result = calculateFormulaCost(
      formula,
      resolveMaterials(data),
      data.batchQtyKg ?? 1000,
    );

    return result;
  });
