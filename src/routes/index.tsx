import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPromoSlots } from "@/lib/subscriptions.functions";
import { PROMO_MONTHS, PROMO_PRICE, PROMO_SLOTS } from "@/lib/subscription";


export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Provende — Inventaire & Production d'aliments" },
      {
        name: "description",
        content:
          "Suivez vos matières premières, vos fournisseurs, vos formules et votre production quotidienne d'aliments. Chaque compte garde ses données privées.",
      },
      { property: "og:title", content: "Provende — Inventaire & Production d'aliments" },
      {
        property: "og:description",
        content:
          "Stocks, formules, production : un outil simple pour piloter la fabrication d'aliments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.origin;
    const shareData = {
      title: "Provende — Inventaire & Production",
      text: "Suivez vos stocks, formules et production d'aliments avec Provende.",
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Le partage n'a pas abouti.");
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié dans le presse-papiers.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      aria-label="Partager le site"
      title="Partager"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {copied ? "Lien copié" : "Partager"}
    </button>
  );
}

function Index() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-5">
        <span className="mr-auto font-display text-xl text-foreground">Provende</span>
        <ShareButton />
        <Link
          to="/demo"
          className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary"
        >
          Démo 5 min
        </Link>
        {signedIn ? (
          <Link
            to="/app"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Mon espace
          </Link>
        ) : (
          <Link
            to="/auth"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Se connecter
          </Link>
        )}
      </header>


      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
        <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
          Vos stocks, vos formules, votre production — au même endroit
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          Provende suit vos matières premières et vos fournisseurs, calcule le coût de vos formules
          et vous alerte avant la rupture de stock. Chaque utilisateur retrouve uniquement ses
          propres données.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            to={signedIn ? "/app" : "/auth"}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {signedIn ? "Ouvrir mon espace" : "Créer mon compte"}
          </Link>
          <Link
            to="/auth"
            className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Se connecter
          </Link>
        </div>

        <ul className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Inventaire", "Stock en kg, prix unitaire, valeur et jours de couverture."],
            ["Formules", "Compositions au millier de kg avec coût de revient calculé."],
            ["Production", "Tonnage jour par jour et consommation de matières."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <Pricing signedIn={signedIn} />
      <footer className="pb-8 text-center text-xs text-muted-foreground">
        <Link to="/confidentialite" className="underline hover:text-foreground">
          Politique de confidentialité
        </Link>
      </footer>
    </main>
  );
}

const WA = "https://wa.me/2250151740187?text=";

const PLANS = [
  {
    name: "Essai Découverte",
    price: "0 F CFA",
    period: "pendant 14 jours",
    yearly: "Sans carte bancaire",
    features: [
      "Testez avec vos vraies matières premières",
      "Stocks, formules et fabrications",
      "1 code ouvrier par jour",
      "Analyses sur 7 jours",
    ],
    cta: "Créer mon compte",
    kind: "signup" as const,
    featured: false,
  },
  {
    name: "Formule Pro",
    price: "15 000 F CFA",
    period: "/ mois",
    yearly: "ou 150 000 F CFA / an (2 mois offerts)",
    features: [
      "Matières et formules illimitées",
      "Codes ouvriers illimités, sans accès à vos marges",
      "Bons de commande WhatsApp avec confirmation fournisseur",
      "Analyses complètes, exports Excel et PDF",
      "Assistance WhatsApp prioritaire",
    ],
    cta: "Démarrer l'essai Pro 14 jours",
    kind: "signup" as const,
    featured: true,
  },
  {
    name: "Entreprise & Coopérative",
    price: "35 000 F CFA",
    period: "/ mois",
    yearly: "ou 350 000 F CFA / an (2 mois offerts)",
    features: [
      "Tout le contenu de la Formule Pro",
      "Plusieurs sites ou fabriques",
      "Paramétrage initial de vos formules offert",
      "Rapports avancés",
      "Support WhatsApp direct",
    ],
    cta: "Nous contacter sur WhatsApp",
    kind: "whatsapp" as const,
    featured: false,
  },
];

function PromoBanner({ signedIn }: { signedIn: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    getPromoSlots()
      .then((r) => setRemaining(r.remaining))
      .catch(() => setRemaining(null));
  }, []);
  if (remaining === 0) return null;
  const taken = remaining === null ? 0 : PROMO_SLOTS - remaining;
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl border-2 border-primary bg-card p-6 text-center shadow-lg">
      <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
        Offre Pionniers
      </span>
      <p className="mt-4 font-display text-2xl text-foreground sm:text-3xl">
        {PROMO_PRICE.toLocaleString("fr-FR")} F CFA / mois pendant {PROMO_MONTHS} mois
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Réservée aux 10 premiers inscrits, après les 14 jours d'essai.</p>
      <p className="mt-5 text-5xl font-bold text-primary">{remaining ?? "…"}</p>
      <p className="text-sm font-semibold text-foreground">place(s) restante(s) sur {PROMO_SLOTS}</p>
      <div className="mx-auto mt-3 flex max-w-xs gap-1">
        {Array.from({ length: PROMO_SLOTS }).map((_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < taken ? "bg-muted" : "bg-primary"}`} />
        ))}
      </div>
      <Link
        to={signedIn ? "/app" : "/auth"}
        className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        {signedIn ? "Ouvrir mon espace" : "Réserver ma place"}
      </Link>
    </div>
  );
}

function Pricing({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="tarifs" className="mx-auto max-w-5xl px-6 pb-24">
      <div className="text-center">
        <h2 className="font-display text-3xl text-foreground sm:text-4xl">
          Des tarifs clairs, rentabilisés dès le premier sac sauvé
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Un sac de tourteau de soja perdu coûte plus cher qu'un mois d'abonnement. 14 jours
          d'essai gratuit sur toutes les formules.
        </p>
      </div>
      <PromoBanner signedIn={signedIn} />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-2xl border bg-card p-6 text-left ${
              p.featured ? "border-primary shadow-lg" : "border-border"
            }`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Recommandé
              </span>
            )}
            <h3 className="font-display text-xl text-foreground">{p.name}</h3>
            <p className="mt-4">
              <span className="text-3xl font-bold text-foreground">{p.price}</span>{" "}
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{p.yearly}</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-foreground">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-primary">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {p.kind === "whatsapp" ? (
              <a
                href={
                  WA +
                  encodeURIComponent(
                    "Bonjour, je souhaite des informations sur l'offre Entreprise & Coopérative de Provende.",
                  )
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                {p.cta}
              </a>
            ) : (
              <Link
                to={signedIn ? "/app" : "/auth"}
                className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90 ${
                  p.featured
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground"
                }`}
              >
                {signedIn ? "Ouvrir mon espace" : p.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Paiement par Wave, Orange Money, MTN MoMo, Moov Money ou virement. Chaque provenderie
        dispose d'un espace 100 % privé.
      </p>
    </section>
  );
}
