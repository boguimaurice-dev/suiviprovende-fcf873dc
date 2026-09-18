import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/")({
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
    </main>
  );
}
