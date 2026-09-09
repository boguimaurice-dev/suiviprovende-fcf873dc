import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Mon espace — Provende" },
      {
        name: "description",
        content:
          "Gérez votre inventaire de matières premières, vos formules et votre production dans votre espace privé Provende.",
      },
      { property: "og:title", content: "Mon espace — Provende" },
      {
        property: "og:description",
        content: "Inventaire, formules et production : vos données, votre compte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppPage,
});

type AppData = Record<string, unknown>;

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.company_name || data?.full_name || user.email || "");
      });
  }, [user.id, user.email]);

  const sendToFrame = useCallback((data: AppData | null) => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "provende:init", data },
      window.location.origin,
    );
    setStatus("ready");
  }, []);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as { type?: string; data?: AppData; local?: AppData | null };
      if (msg?.type === "provende:ready") {
        const { data: row } = await supabase
          .from("app_data")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();
        const stored = (row?.data ?? null) as AppData | null;
        const hasStored = stored && Object.keys(stored).length > 0;
        if (hasStored) {
          sendToFrame(stored);
          return;
        }
        if (msg.local && Object.keys(msg.local).length > 0) {
          await supabase
            .from("app_data")
            .upsert({ user_id: user.id, data: msg.local as never }, { onConflict: "user_id" });
          toast.success("Vos données déjà saisies ont été reprises dans votre compte");
          sendToFrame(msg.local);
          return;
        }
        sendToFrame(null);
      }
      if (msg?.type === "provende:save" && msg.data) {
        const { error } = await supabase
          .from("app_data")
          .upsert({ user_id: user.id, data: msg.data as never }, { onConflict: "user_id" });
        if (error) toast.error("Enregistrement impossible pour le moment");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [user.id, sendToFrame]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
        <span className="font-display text-lg text-foreground">Provende</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{profileName}</span>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-border px-3 py-1.5 font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Se déconnecter
          </button>
        </div>
      </header>
      {status === "loading" && (
        <p className="px-5 py-2 text-xs text-muted-foreground">Chargement de vos données…</p>
      )}
      <iframe
        ref={frameRef}
        src="/provende.html"
        title="Provende — Inventaire & Production"
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
