import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startPaystackCheckout } from "@/lib/paystack.functions";
import type { AccessState } from "@/lib/subscription";

const WA = "https://wa.me/2250151740187?text=";

function payLink(text: string) {
  return WA + encodeURIComponent(text);
}

function PayButtons({ className = "" }: { className?: string }) {
  const start = useServerFn(startPaystackCheckout);
  const [busy, setBusy] = useState(false);
  async function pay(plan: "month" | "year") {
    setBusy(true);
    try {
      const { url } = await start({ data: { plan } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Paiement impossible pour le moment");
      setBusy(false);
    }
  }
  const b = "rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50";
  return (
    <span className={`inline-flex flex-wrap gap-2 ${className}`}>
      <button disabled={busy} onClick={() => pay("month")} className={b}>Payer 1 mois</button>
      <button disabled={busy} onClick={() => pay("year")} className={b}>Payer 1 an (150 000 F)</button>
    </span>
  );
}

export function AccessBanner({ access, onSurvey }: { access: AccessState; onSurvey: () => void }) {
  if (access.kind === "trial") {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary px-5 py-2 text-xs text-secondary-foreground">
        Essai gratuit : <strong>{access.daysLeft} jour(s) restant(s)</strong>.
        <a className="underline" href={payLink("Bonjour, je souhaite m'abonner à Provende.")} target="_blank" rel="noopener noreferrer">
          M'abonner
        </a>
        <PayButtons />
      </div>
    );
  }
  if (access.kind === "grace") {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-destructive bg-destructive/10 px-5 py-3 text-sm text-destructive">
        <span>
          ⚠️ Votre essai de 14 jours est terminé. Il vous reste <strong>{access.daysLeft} jour(s)</strong> pour
          régler votre abonnement avant le blocage de l'application.
        </span>
        <a
          className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
          href={payLink("Bonjour, mon essai Provende est terminé, je souhaite régler mon abonnement.")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Régler sur WhatsApp
        </a>
        <PayButtons />
        <button onClick={onSurvey} className="text-xs underline">
          Pourquoi je n'ai pas encore payé
        </button>
      </div>
    );
  }
  return null;
}

export function BlockedScreen({ onSurvey }: { onSurvey: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-2xl text-foreground">Accès suspendu</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre période d'essai et les 3 jours de grâce sont terminés. Vos données sont conservées en
          toute sécurité : réglez votre abonnement (Wave, Orange Money, MTN MoMo, Moov Money) pour
          retrouver l'accès immédiatement.
        </p>
        <PayButtons className="mt-6 justify-center" />
        <br />
        <a
          className="mt-3 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          href={payLink("Bonjour, mon accès Provende est suspendu, je souhaite régler mon abonnement.")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Régler mon abonnement sur WhatsApp
        </a>
        <button onClick={onSurvey} className="mt-4 block w-full text-sm underline text-muted-foreground">
          Donner mon avis sur Provende
        </button>
      </div>
    </div>
  );
}

export function SurveyDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState("");
  const [issues, setIssues] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!rating) { toast.error("Choisissez une note de 1 à 5."); return; }
    setBusy(true);
    const { error } = await supabase.from("survey_responses").insert({
      user_id: userId,
      rating,
      liked: liked.slice(0, 2000) || null,
      issues: issues.slice(0, 2000) || null,
      suggestions: suggestions.slice(0, 2000) || null,
      price_opinion: price || null,
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible pour le moment."); return; }
    toast.success("Merci ! Votre avis nous aide à améliorer Provende.");
    onClose();
  }

  const field = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl text-foreground">Votre avis sur Provende</h2>
        <p className="mt-1 text-xs text-muted-foreground">2 minutes pour nous aider à améliorer l'application.</p>
        <p className="mt-4 text-sm font-semibold text-foreground">Note globale</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-primary" : "text-muted-foreground"}`} aria-label={`${n} sur 5`}>
              ★
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold text-foreground">
          Ce que vous aimez le plus
          <textarea className={field} rows={2} value={liked} onChange={(e) => setLiked(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-foreground">
          Ce qui vous bloque ou vous gêne
          <textarea className={field} rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-foreground">
          Fonctions à ajouter ou améliorer
          <textarea className={field} rows={2} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-foreground">
          Le prix vous semble…
          <select className={field} value={price} onChange={(e) => setPrice(e.target.value)}>
            <option value="">— Choisir —</option>
            <option>Trop cher</option>
            <option>Correct</option>
            <option>Bon marché</option>
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Annuler</button>
          <button disabled={busy} onClick={submit} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
