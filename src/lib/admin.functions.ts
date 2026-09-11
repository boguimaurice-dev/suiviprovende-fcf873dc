import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Accès réservé à l'administrateur");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export type AccountRow = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  hasData: boolean;
  materials: number;
  formulas: number;
};

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ accounts: AccountRow[] }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error("Impossible de charger les comptes");

    const [{ data: profiles }, { data: roles }, { data: rows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, company_name"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("app_data").select("user_id, data"),
    ]);

    const accounts = usersData.users.map((u) => {
      const profile = profiles?.find((p) => p.id === u.id);
      const row = rows?.find((r) => r.user_id === u.id);
      const data = (row?.data ?? {}) as {
        materials?: unknown[];
        formulas?: unknown[];
      };
      return {
        id: u.id,
        email: u.email ?? "",
        fullName: profile?.full_name ?? null,
        companyName: profile?.company_name ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: !!roles?.some((r) => r.user_id === u.id && r.role === "admin"),
        hasData: !!row,
        materials: Array.isArray(data.materials) ? data.materials.length : 0,
        formulas: Array.isArray(data.formulas) ? data.formulas.length : 0,
      };
    });

    accounts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { accounts };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; makeAdmin: boolean }) => {
    if (typeof input?.userId !== "string" || !input.userId) throw new Error("Compte invalide");
    return { userId: input.userId, makeAdmin: !!input.makeAdmin };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("Vous ne pouvez pas retirer votre propre accès administrateur");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error("Modification impossible");
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error("Modification impossible");
    }
    return { ok: true };
  });

export const resetAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (typeof input?.userId !== "string" || !input.userId) throw new Error("Compte invalide");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_data").delete().eq("user_id", data.userId);
    if (error) throw new Error("Réinitialisation impossible");
    return { ok: true };
  });
