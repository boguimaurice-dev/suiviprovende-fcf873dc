import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { memberDeleteEntry, memberSaveEntry, memberSession } from "@/lib/members.functions";

export const Route = createFileRoute("/membre")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saisie du jour — Provende" },
      { name: "description", content: "Accès membre temporaire pour saisir la production et les entrées du jour." },
      { property: "og:title", content: "Saisie du jour — Provende" },
      { property: "og:description", content: "Accès membre temporaire Provende." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MemberPage,
});

type Session = Awaited<ReturnType<typeof memberSession>>;
type Kind = "production" | "receipt";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function MemberPage() {
  const getSession = useServerFn(memberSession);
  const saveEntry = useServerFn(memberSaveEntry);
  const deleteEntry = useServerFn(memberDeleteEntry);
  const [code, setCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Kind | "stock">("production");
  const [form, setForm] = useState<{ id?: string; refId: string; qty: string; note: string }>({
    refId: "",
    qty: "",
    note: "",
  });

  async function load(c: string) {
    setBusy(true);
    try {
      const s = await getSession({ data: { code: c } });
      setSession(s);
      sessionStorage.setItem("provende-member-code", c);
    } catch (e) {
      sessionStorage.removeItem("provende-member-code");
      setSession(null);
      toast.error(e instanceof Error ? e.message : "Code invalide ou expiré");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("provende-member-code");
    if (saved) {
      setCode(saved);
      load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function quit() {
    sessionStorage.removeItem("provende-member-code");
    setSession(null);
    setCode("");
  }

  async function submit(e: React.FormEvent, kind: Kind) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveEntry({
        data: { code, id: form.id, kind, refId: form.refId, qty: Number(form.qty.replace(",", ".")), note: form.note },
      });
      toast.success(form.id ? "Saisie corrigée" : "Saisie enregistrée");
      setForm({ refId: "", qty: "", note: "" });
      await load(code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette saisie ?")) return;
    try {
      await deleteEntry({ data: { code, id } });
      toast.success("Saisie supprimée");
      await load(code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    }
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(code);
          }}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
        >
          <h1 className="font-display text-2xl text-foreground">Saisie du jour</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entrez le code temporaire donné par votre responsable.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            autoComplete="off"
            className="mt-4 w-full rounded-lg border border-input bg-background px-3 py-3 text-center font-mono text-xl tracking-widest text-foreground"
            required
          />
          <button
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            Accéder
          </button>
        </form>
      </main>
    );
  }

  const nameOf = (kind: Kind, id: string) =>
    (kind === "production" ? session.formulas : session.materials).find((x) => x.id === id)?.name ?? id;
  const options = tab === "production" ? session.formulas : session.materials;
  const entries = session.entries.filter((e) => e.kind === tab);

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground">{session.company || "Provende"}</h1>
          <p className="text-sm text-muted-foreground">
            {session.label} · {new Date(session.today).toLocaleDateString("fr-FR")} · accès jusqu'à{" "}
            {new Date(session.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button onClick={quit} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary">
          Quitter
        </button>
      </header>

      <nav className="mt-5 flex gap-2">
        {(
          [
            ["production", "Production"],
            ["receipt", "Entrées"],
            ["stock", "Stock"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              setForm({ refId: "", qty: "", note: "" });
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}
          >
            {l}
          </button>
        ))}
      </nav>

      {tab === "stock" ? (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
          {session.materials.map((m) => (
            <li key={m.id} className="flex justify-between p-3 text-sm">
              <span className="text-foreground">{m.name}</span>
              <span className="font-semibold text-foreground">{fmt(m.stock)} kg</span>
            </li>
          ))}
          {session.materials.length === 0 && <li className="p-3 text-sm text-muted-foreground">Aucune matière.</li>}
        </ul>
      ) : (
        <>
          <form onSubmit={(e) => submit(e, tab)} className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">
              {form.id ? "Corriger la saisie" : tab === "production" ? "Production du jour" : "Nouvelle entrée (réception)"}
            </p>
            <select
              value={form.refId}
              onChange={(e) => setForm({ ...form, refId: e.target.value })}
              required
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">{tab === "production" ? "— Formule —" : "— Matière —"}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <input
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              inputMode="decimal"
              placeholder={tab === "production" ? "Tonnes produites" : "Quantité reçue (kg)"}
              required
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Note (facultatif)"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <div className="flex gap-2">
              <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                Enregistrer
              </button>
              {form.id && (
                <button type="button" onClick={() => setForm({ refId: "", qty: "", note: "" })} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground">
                  Annuler
                </button>
              )}
            </div>
          </form>

          <h2 className="mt-6 text-sm font-semibold text-foreground">Mes saisies d'aujourd'hui</h2>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
            {entries.length === 0 && <li className="p-3 text-sm text-muted-foreground">Aucune saisie.</li>}
            {entries.map((e) => {
              const p = e.payload as { formulaId?: string; materialId?: string; tonnes?: number; qty?: number; note?: string };
              const refId = (tab === "production" ? p.formulaId : p.materialId) ?? "";
              const qty = (tab === "production" ? p.tonnes : p.qty) ?? 0;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="text-foreground">
                      {nameOf(tab, refId)} — <b>{fmt(qty)} {tab === "production" ? "t" : "kg"}</b>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.imported ? "Intégrée par le responsable" : "En attente d'intégration"}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  {!e.imported && (
                    <div className="flex gap-2">
                      <button onClick={() => setForm({ id: e.id, refId, qty: String(qty), note: p.note ?? "" })} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-foreground">
                        Corriger
                      </button>
                      <button onClick={() => remove(e.id)} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold text-foreground">
                        Supprimer
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
