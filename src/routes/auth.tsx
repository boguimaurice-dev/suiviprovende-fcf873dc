import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Provende" },
      {
        name: "description",
        content:
          "Connectez-vous à Provende pour retrouver vos matières premières, vos formules et votre production en toute confidentialité.",
      },
      { property: "og:title", content: "Connexion — Provende" },
      {
        property: "og:description",
        content: "Accédez à votre espace Provende : inventaire, formules et production.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, company_name: companyName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/app", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("La connexion Google a échoué");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lg">
        <Link to="/" className="font-display text-2xl text-foreground">
          Provende
        </Link>
        <h1 className="mt-6 font-display text-2xl text-foreground">
          {mode === "signin" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos matières, fournisseurs et formules restent privés, visibles par vous seul.
        </p>

        {sent ? (
          <p className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
            Vérifiez votre boîte mail : un lien de confirmation vient de vous être envoyé.
          </p>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Continuer avec Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <Field
                    label="Votre nom"
                    value={fullName}
                    onChange={setFullName}
                    placeholder="Bony Maurice"
                    required
                  />
                  <Field
                    label="Nom de l'exploitation"
                    value={companyName}
                    onChange={setCompanyName}
                    placeholder="Ferme Provende"
                  />
                </>
              )}
              <Field
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="vous@exemple.com"
                required
              />
              <Field
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
              </button>
            </form>

            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {mode === "signin"
                ? "Pas encore de compte ? Créer un compte"
                : "J'ai déjà un compte — me connecter"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring"
      />
    </label>
  );
}
