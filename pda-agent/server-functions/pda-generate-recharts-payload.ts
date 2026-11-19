import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PdaData, buildChartPayload } from "../logic/pda-core";

export const generateRechartsPayload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; grouping: string }) => {
    if (!input?.from || !input?.to) throw new Error("from/to requis");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("app_data")
      .select("data")
      .eq("user_id", context.userId)
      .maybeSingle();

    const raw = typeof row?.data === "string" ? (JSON.parse(row.data as string) as PdaData) : (row?.data as PdaData);
    const payload = buildChartPayload(raw ?? {}, data.from, data.to, data.grouping);

    return payload;
  });
