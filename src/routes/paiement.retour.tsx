import { createFileRoute, Link } from "@tanstack/react-router";

const WA = "https://wa.me/2250151740187?text=";

export const Route = createFileRoute("/paiement/retour")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Paiement reçu — Provende" },
      { name: "description", content: "Merci pour votre paiement. Votre abonnement Provende est en cours d'activation." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Paiement reçu — Provende" },
      { property: "og:description", content: "Votre abonnement Provende est en cours d'activation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Retour,
});

function Retour() {
  const ref =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("reference") ||
        new URLSearchParams(window.location.search).get("trxref")
      : null;
  const msg = `Bonjour, je viens de payer mon abonnement Provende${ref ? " (référence " + ref + ")" : ""}. Merci d'activer mon compte.`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="text-5xl text-primary">✓</div>
        <h1 className="mt-4 font-display text-3xl text-foreground">Merci pour votre paiement</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre abonnement est en cours d'activation. Si votre accès n'est pas rétabli sous quelques
          heures, envoyez-nous votre référence de paiement sur WhatsApp.
        </p>
        {ref && <p className="mt-3 text-xs text-muted-foreground">Référence : {ref}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <Link to="/app" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            Ouvrir mon espace
          </Link>
          <a
            href={WA + encodeURIComponent(msg)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground"
          >
            Confirmer sur WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
