// pda-calculate-stock-runway.ts
//
// Autonomie des stocks (PDA - outil "calculate_stock_runway").
// Pour chaque matière : stock actuel, consommation journalière récente,
// jours d'autonomie restants, seuil d'alerte et statut.
//
// Lecture seule : lecture uniquement des données de l'utilisateur.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PdaData,
  computeRunway,
  resolveMaterials,
} from "../logic/pda-core";

export const calculateStockRunway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowDays?: number; thresholdDays?: number }) => {
    if (input?.windowDays !== undefined && input.windowDays < 1) {
      throw new Error("windowDays doit être >= 1");
    }
    if (input?.thresholdDays !== undefined && input.thresholdDays < 1) {
      throw new Error("thresholdDays doit être >= 1");
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

    const entries = computeRunway(dataPda, data);
    const materials = resolveMaterials(dataPda);

    return {
      materials: entries.map((e) => ({
        ...e,
        name: e.name,
        stock: materials.find((m) => m.id === e.materialId)?.stock ?? 0,
      })),
      summary: {
        windowDays: data.windowDays ?? 14,
        thresholdDays: data.thresholdDays ?? 7,
      },
    };
  });
