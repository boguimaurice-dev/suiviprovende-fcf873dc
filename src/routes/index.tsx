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

function Index() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="font-display text-xl text-foreground">Provende</span>
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
