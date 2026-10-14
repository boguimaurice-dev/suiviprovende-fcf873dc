import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listAccounts,
  resetAccountData,
  setAdminRole,
  type AccountRow,
} from "@/lib/admin.functions";
import { adminListSubscriptions, adminRecordPayment } from "@/lib/subscriptions.functions";
import { computeAccess } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/superadmin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Superadmin — Provende" },
      {
        name: "description",
        content:
          "Espace superadmin Provende : liste des comptes, rôles administrateur et gestion des données.",
      },
      { property: "og:title", content: "Superadmin — Provende" },
      {
        property: "og:description",
        content: "Gestion des comptes et des rôles de la plateforme Provende.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuperadminPage,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl text-foreground">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cet espace est réservé à l'administrateur de la plateforme.
        </p>
        <Link to="/app" className="mt-6 inline-block text-sm underline">
          Retour à mon espace
        </Link>
      </div>
    </main>
  ),
  notFoundComponent: () => <p className="p-6">Page introuvable.</p>,
});

function SuperadminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listAccounts);
  const toggleAdmin = useServerFn(setAdminRole);
  const resetData = useServerFn(resetAccountData);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["superadmin", "accounts"],
    queryFn: () => fetchAccounts(),
  });
  const fetchSubs = useServerFn(adminListSubscriptions);
  const recordPayment = useServerFn(adminRecordPayment);
  const { data: subData, refetch: refetchSubs } = useQuery({
    queryKey: ["superadmin", "subs"],
    queryFn: () => fetchSubs(),
  });
  const subs = subData?.subs ?? [];

  async function onPay(account: AccountRow, months: number, promo: boolean) {
    const msg =
      months === 0
        ? `Suspendre l'abonnement de ${account.email} ?`
        : `Valider le paiement de ${account.email} pour ${months} mois${promo ? " (offre promo)" : ""} ?`;
    if (!window.confirm(msg)) return;
    try {
      await recordPayment({ data: { userId: account.id, months, promo } });
      toast.success("Abonnement mis à jour");
      await refetchSubs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible");
    }
  }

  async function onToggleAdmin(account: AccountRow) {
    try {
      await toggleAdmin({ data: { userId: account.id, makeAdmin: !account.isAdmin } });
      toast.success(account.isAdmin ? "Rôle administrateur retiré" : "Rôle administrateur accordé");
      await queryClient.invalidateQueries({ queryKey: ["superadmin", "accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible");
    }
  }

  async function onReset(account: AccountRow) {
    if (
      !window.confirm(
        `Vider définitivement les données de ${account.email} ? Cette action est irréversible.`,
      )
    )
      return;
    try {
      await resetData({ data: { userId: account.id } });
      toast.success("Données du compte vidées");
      await queryClient.invalidateQueries({ queryKey: ["superadmin", "accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réinitialisation impossible");
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cet espace est réservé à l'administrateur de la plateforme.
          </p>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mt-6 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            Retour à mon espace
          </button>
        </div>
      </main>
    );
  }

  const accounts = data?.accounts ?? [];

  return (
    <main className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
        <div>
          <span className="font-display text-lg text-foreground">Provende — Superadmin</span>
          <p className="text-xs text-muted-foreground">
            {accounts.length} compte{accounts.length > 1 ? "s" : ""} sur la plateforme
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-border px-3 py-1.5 font-semibold transition-colors hover:bg-secondary"
          >
            Actualiser
          </button>
          <Link
            to="/app"
            className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground"
          >
            Mon espace
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-3 py-6 sm:px-5 sm:py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des comptes…</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Compte</th>
                  <th className="px-4 py-3">Inscription</th>
                  <th className="px-4 py-3">Dernière visite</th>
                  <th className="px-4 py-3">Données</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-foreground">{a.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.companyName || a.fullName || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(a.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(a.lastSignInAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.hasData ? `${a.materials} matières · ${a.formulas} formules` : "Vide"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          a.isAdmin
                            ? "rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
                            : "rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground"
                        }
                      >
                        {a.isAdmin ? "Administrateur" : "Utilisateur"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onToggleAdmin(a)}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-secondary"
                        >
                          {a.isAdmin ? "Retirer admin" : "Rendre admin"}
                        </button>
                        <button
                          onClick={() => onReset(a)}
                          className="rounded-lg border border-destructive px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                        >
                          Vider les données
                        </button>
                      </div>
                      <SubCell account={a} sub={subs.find((s) => s.user_id === a.id)} onPay={onPay} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Offre Pionniers (5 000 F CFA / mois pendant 3 mois) : <strong>{subData?.promoRemaining ?? "…"}</strong> place(s) restante(s) sur 10.
        </p>

        <h2 className="mt-10 font-display text-xl text-foreground">Avis des utilisateurs</h2>
        <div className="mt-3 space-y-3">
          {(subData?.surveys ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun avis pour le moment.</p>
          )}
          {(subData?.surveys ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>{accounts.find((a) => a.id === s.user_id)?.email ?? "Compte"}</span>
                <span>{fmt(s.created_at)} · {"★".repeat(s.rating)} · Prix : {s.price_opinion || "—"}</span>
              </div>
              {s.liked && <p className="mt-2"><strong>Aime :</strong> {s.liked}</p>}
              {s.issues && <p className="mt-1"><strong>Gêne :</strong> {s.issues}</p>}
              {s.suggestions && <p className="mt-1"><strong>Suggestions :</strong> {s.suggestions}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function SubCell({
  account,
  sub,
  onPay,
}: {
  account: AccountRow;
  sub: { paid_until: string | null; promo: boolean } | undefined;
  onPay: (a: AccountRow, months: number, promo: boolean) => void;
}) {
  if (account.isAdmin) return null;
  const access = computeAccess(account.createdAt, sub ?? null);
  const label =
    access.kind === "active"
      ? `Abonné jusqu'au ${fmt(access.until.toISOString())}${access.promo ? " · Promo" : ""}`
      : access.kind === "trial"
        ? `Essai : J-${access.daysLeft}`
        : access.kind === "grace"
          ? `Alerte : blocage dans ${access.daysLeft} j`
          : "Bloqué";
  const btn = "rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-secondary";
  return (
    <div className="mt-2 text-xs">
      <span className="font-semibold text-foreground">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1">
        <button className={btn} onClick={() => onPay(account, 1, false)}>+1 mois</button>
        <button className={btn} onClick={() => onPay(account, 12, false)}>+1 an</button>
        {!sub?.promo && (
          <button className={btn} onClick={() => onPay(account, 1, true)}>Promo 5 000 F (+1 mois)</button>
        )}
        {access.kind === "active" && (
          <button className={btn} onClick={() => onPay(account, 0, false)}>Suspendre</button>
        )}
      </div>
    </div>
  );
}

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
