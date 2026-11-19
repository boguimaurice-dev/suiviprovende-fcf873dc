// pda-detect-consumption-gaps.ts
//
// Détection des écarts (PDA - outil "detect_consumption_gaps").
// Compare le stock réel compté (materials.stock) à la consommation théorique
// déduite du calendrier de production x mix des formules.
//
// Signal : ok | suspect | alert (alert quand |écart| >= alertPercent, ou
// écart négatif).
//
// Lecture seule : lecture uniquement des données de l'utilisateur.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PdaData, detectGaps, resolveMaterials } from "../logic/pda-core";

export const detectConsumptionGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowDays?: number; alertPercent?: number }) => {
    if (input?.alertPercent !== undefined && (input.alertPercent < 0 || input.alertPercent > 100)) {
      throw new Error("alertPercent doit être entre 0 et 100");
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
    const dataPda = payload ?? {};

    const entries = detectGaps(dataPda, data);

    const materials = resolveMaterials(dataPda);
    const alerts = entries.filter((e) => e.signal === "alert");

    return {
      entries: entries.map((e) => ({
        ...e,
        name: e.name,
        actualStock: materials.find((m) => m.id === e.materialId)?.stock ?? 0,
      })),
      alerts,
      summary: {
        windowDays: data.windowDays ?? 14,
        alertPercent: data.alertPercent ?? 5,
      },
    };
  });
