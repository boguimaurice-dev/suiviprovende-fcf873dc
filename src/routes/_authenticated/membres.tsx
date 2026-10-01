import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createMemberCode } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/membres")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Membres autorisés — Provende" },
      {
        name: "description",
        content: "Donnez un accès temporaire à vos équipes pour saisir la production et les entrées du jour.",
      },
      { property: "og:title", content: "Membres autorisés — Provende" },
      { property: "og:description", content: "Codes d'accès temporaires pour vos équipes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const qc = useQueryClient();
  const create = useServerFn(createMemberCode);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<{ label: string; code: string } | null>(null);

  const { data: codes = [] } = useQuery({
    queryKey: ["member-codes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_codes")
        .select("id, label, expires_at, revoked_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({ data: { label } });
      setNewCode({ label, code: res.code });
      setLabel("");
      qc.invalidateQueries({ queryKey: ["member-codes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase
      .from("member_codes")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Révocation impossible");
    else {
      toast.success("Accès retiré");
      qc.invalidateQueries({ queryKey: ["member-codes"] });
    }
  }

  const link = typeof window !== "undefined" ? `${window.location.origin}/membre` : "/membre";
  const now = Date.now();

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/app" className="text-sm text-muted-foreground underline">
        ← Retour à mon espace
      </Link>
      <h1 className="mt-4 font-display text-2xl text-foreground">Membres autorisés</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Créez un code pour un membre de votre provende. Il pourra saisir la production et les entrées du
        jour, et consulter le stock, jusqu'à minuit. Ses saisies s'ajoutent à votre compte à votre
        prochaine ouverture de l'application.
      </p>

      <form onSubmit={onCreate} className="mt-6 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nom du membre (ex. Koffi — chef d'équipe)"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          required
        />
        <button
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Créer un code
        </button>
      </form>

      {newCode && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Code pour {newCode.label} (valable aujourd'hui) :</p>
          <p className="mt-1 font-mono text-3xl tracking-widest text-foreground">{newCode.code}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            À ouvrir sur : <span className="font-semibold text-foreground">{link}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Notez-le maintenant : il ne sera plus affiché ensuite.
          </p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`Accès Provende du jour : ${link}  —  code ${newCode.code}`);
              toast.success("Copié");
            }}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Copier le lien et le code
          </button>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg text-foreground">Codes récents</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
        {codes.length === 0 && <li className="p-4 text-sm text-muted-foreground">Aucun code.</li>}
        {codes.map((c) => {
          const active = !c.revoked_at && new Date(c.expires_at).getTime() > now;
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">{c.label}</p>
                <p className="text-muted-foreground">
                  {c.revoked_at
                    ? "Retiré"
                    : active
                      ? `Actif jusqu'à ${new Date(c.expires_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : `Expiré (${new Date(c.expires_at).toLocaleDateString("fr-FR")})`}
                </p>
              </div>
              {active && (
                <button
                  onClick={() => revoke(c.id)}
                  className="rounded-lg border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-secondary"
                >
                  Retirer l'accès
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
