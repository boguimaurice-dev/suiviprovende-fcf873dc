import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const logAgentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    tool: string;
    sessionId?: string;
    params: unknown;
    result: unknown;
    success: boolean;
    durationMs?: number;
  }) => {
    if (!input?.tool) throw new Error("tool requis");
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
    const payload = typeof raw === "string"
      ? (JSON.parse(raw) as Record<string, unknown>)
      : (raw as Record<string, unknown>);

    const logs = Array.isArray(payload?.agent_logs) ? payload.agent_logs : [];
    const entry = {
      id: crypto.randomUUID(),
      tool: data.tool,
      sessionId: data.sessionId ?? null,
      success: data.success,
      durationMs: data.durationMs ?? 0,
      timestamp: new Date().toISOString(),
      params: data.params ?? {},
      result: data.result ?? null,
    };
    logs.unshift(entry);
    if (logs.length > 500) logs.length = 500;

    payload.agent_logs = logs;

    const { error } = await supabase.from("app_data").upsert(
      { user_id: context.userId, data: payload },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("[pda-agent] impossible d'enregistrer la trace:", error.message);
    }

    return { ok: true, count: logs.length, entry };
  });
