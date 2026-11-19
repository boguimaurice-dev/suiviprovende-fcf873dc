import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PdaData, proposeOrderSuggestion } from "../logic/pda-core";

export const draftOrderSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowDays?: number; thresholdDays?: number; minAutonomy?: number }) => {
    if (input?.thresholdDays !== undefined && input.thresholdDays < 1) {
      throw new Error("thresholdDays doit être >= 1");
    }
    if (input?.minAutonomy !== undefined && input.minAutonomy < 0) {
      throw new Error("minAutonomy doit être >= 0");
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
    const payload = typeof raw === "string" ? (JSON.parse(raw) as PdaData) : (raw as PdaData);
    const suggestions = proposeOrderSuggestion(payload ?? {}, data);

    return suggestions;
  });
