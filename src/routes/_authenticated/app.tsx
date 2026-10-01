import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { scanDocument } from "@/lib/scan.functions";
import { chatWithApp } from "@/lib/chat.functions";
import { checkIsAdmin } from "@/lib/admin.functions";


export const Route = createFileRoute("/_authenticated/app")({
  staticData: { sitemap: false },
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

const DATA_KEYS = [
  "materials",
  "finished",
  "formulas",
  "suppliers",
  "receipts",
  "movements",
  "production",
  "sales",
  "arrangements",
  "orders",
] as const;

function isEmptyPayload(data: AppData) {
  return DATA_KEYS.every((key) => {
    const value = (data as Record<string, unknown>)[key];
    return !Array.isArray(value) || value.length === 0;
  });
}

function AppPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hadDataRef = useRef(false);
  const frameReadyRef = useRef(false);
  const importingRef = useRef(new Set<string>());
  const [profileName, setProfileName] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const scan = useServerFn(scanDocument);
  const chat = useServerFn(chatWithApp);
  const fetchIsAdmin = useServerFn(checkIsAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["me", "isAdmin", user.id],
    retry: false,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return { isAdmin: false };
      try {
        return await fetchIsAdmin();
      } catch {
        return { isAdmin: false };
      }
    },
  });


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

  const postToFrame = useCallback((message: unknown) => {
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  const pullMemberEntries = useCallback(async () => {
    if (!frameReadyRef.current) return;
    const { data } = await supabase
      .from("member_entries")
      .select("id, kind, entry_date, payload, member_label")
      .eq("owner_id", user.id)
      .is("imported_at", null)
      .order("created_at");
    const fresh = (data ?? []).filter((e) => !importingRef.current.has(e.id));
    if (!fresh.length) return;
    fresh.forEach((e) => importingRef.current.add(e.id));
    postToFrame({ type: "provende:member-entries", entries: fresh });
  }, [user.id, postToFrame]);

  useEffect(() => {
    const onFocus = () => void pullMemberEntries();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(onFocus, 60000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(t);
    };
  }, [pullMemberEntries]);

  const sendToFrame = useCallback(
    (data: AppData | null) => {
      postToFrame({ type: "provende:init", data });
      setStatus("ready");
      frameReadyRef.current = true;
      window.setTimeout(() => void pullMemberEntries(), 800);
    },
    [postToFrame, pullMemberEntries],
  );

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const msg = event.data as {
        type?: string;
        data?: AppData;
        local?: AppData | null;
        file?: { name: string; mime: string; dataUrl: string };
        context?: {
          materials?: { id: string; name: string }[];
          formulas?: { id: string; name: string }[];
          finished?: { id: string; name: string }[];
        };
        question?: string;
        ids?: string[];
        snapshot?: string;
        history?: { role: "user" | "assistant"; content: string }[];
      };
      if (msg?.type === "provende:ready") {
        const { data: row } = await supabase
          .from("app_data")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();
        const stored = (row?.data ?? null) as AppData | null;
        const hasStored = stored && Object.keys(stored).length > 0;
        if (hasStored) {
          hadDataRef.current = !isEmptyPayload(stored);
          sendToFrame(stored);
          return;
        }
        hadDataRef.current = false;
        sendToFrame(null);
      }
      if ((msg?.type === "provende:save" || msg?.type === "provende:reset") && msg.data) {
        const isReset = msg.type === "provende:reset";
        if (!isReset && isEmptyPayload(msg.data) && hadDataRef.current) {
          toast.error(
            "Enregistrement bloqué : cet onglet est vide alors que votre compte contient des données. Rechargez la page.",
          );
          return;
        }
        const { error } = await supabase
          .from("app_data")
          .upsert({ user_id: user.id, data: msg.data as never }, { onConflict: "user_id" });
        if (error) {
          toast.error("Enregistrement impossible pour le moment");
          return;
        }
        hadDataRef.current = !isEmptyPayload(msg.data);
      }
      if (msg?.type === "provende:member-applied" && Array.isArray(msg.ids) && msg.ids.length) {
        const { error } = await supabase
          .from("member_entries")
          .update({ imported_at: new Date().toISOString() })
          .in("id", msg.ids);
        if (!error) toast.success(`${msg.ids.length} saisie(s) de membres intégrée(s)`);
        msg.ids.forEach((id) => importingRef.current.delete(id));
      }
      if (msg?.type === "provende:scan" && msg.file) {
        try {
          const result = await scan({
            data: {
              mimeType: msg.file.mime,
              fileName: msg.file.name,
              dataUrl: msg.file.dataUrl,
              today: new Date().toISOString().slice(0, 10),
              materials: msg.context?.materials ?? [],
              formulas: msg.context?.formulas ?? [],
              finished: msg.context?.finished ?? [],
            },
          });
          postToFrame({ type: "provende:scan-result", rows: result.rows });
        } catch (error) {
          postToFrame({
            type: "provende:scan-error",
            message:
              error instanceof Error ? error.message : "La lecture du document a échoué.",
          });
        }
      }
      if (msg?.type === "provende:chat" && msg.question) {
        try {
          const result = await chat({
            data: {
              question: msg.question,
              today: new Date().toISOString().slice(0, 10),
              history: msg.history ?? [],
              snapshot: (msg.snapshot ?? "").slice(0, 30000),
            },
          });
          postToFrame({
            type: "provende:chat-reply",
            answer: result.answer,
            rows: result.rows,
          });
        } catch (error) {
          postToFrame({
            type: "provende:chat-error",
            message: error instanceof Error ? error.message : "Réponse impossible pour le moment.",
          });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [user.id, sendToFrame, postToFrame, scan, chat]);


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
          <Link
            to="/membres"
            className="rounded-lg border border-border px-3 py-1.5 font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Membres
          </Link>
          {adminData?.isAdmin && (
            <Link
              to="/superadmin"
              className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Superadmin
            </Link>
          )}
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
