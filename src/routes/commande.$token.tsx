import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrderForSupplier, respondToOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/commande/$token")({
  staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bon de commande — Provende" },
      { name: "description", content: "Consultez et confirmez un bon de commande envoyé via Provende." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Bon de commande — Provende" },
      { property: "og:description", content: "Confirmez la commande en un clic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierOrderPage,
});

type Data = Awaited<ReturnType<typeof getOrderForSupplier>>;

function SupplierOrderPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getOrderForSupplier);
  const respond = useServerFn(respondToOrder);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load({ data: { token } }).then(setData, (e) => setError(e instanceof Error ? e.message : "Lien invalide"));
  }, [token, load]);

  async function answer(status: "confirmed" | "declined") {
    setBusy(true);
    try {
      await respond({ data: { token, status, note } });
      setData(await load({ data: { token } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const total = data?.snapshot.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0) ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-background px-5 py-10 text-foreground">
      <p className="font-display text-lg">Provende</p>
      {error && <p className="mt-6 rounded-lg border border-border bg-card p-4 text-destructive">{error}</p>}
      {!data && !error && <p className="mt-6 text-muted-foreground">Chargement…</p>}
      {data && (
        <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <h1 className="text-xl font-semibold">Bon de commande du {data.snapshot.date}</h1>
          <p className="text-sm text-muted-foreground">
            De : {data.snapshot.company || "Client Provende"} · Pour : {data.snapshot.supplier}
            {data.snapshot.expected && <> · Livraison souhaitée : {data.snapshot.expected}</>}
          </p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th>Article</th><th className="text-right">Qté (kg)</th><th className="text-right">P.U.</th></tr></thead>
            <tbody>
              {data.snapshot.lines.map((l, i) => (
                <tr key={i} className="border-t border-border"><td className="py-1">{l.name}</td><td className="text-right">{fmt(l.qty)}</td><td className="text-right">{l.unitPrice ? fmt(l.unitPrice) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
          {total > 0 && <p className="text-right font-semibold">Total estimé : {fmt(total)} F CFA</p>}
          {data.snapshot.note && <p className="text-sm">Note : {data.snapshot.note}</p>}
          {data.status === "pending" ? (
            <div className="space-y-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Message (date de livraison, remarque…) — facultatif" className="w-full rounded-lg border border-input bg-background p-2 text-sm" />
              <div className="flex gap-3">
                <button disabled={busy} onClick={() => answer("confirmed")} className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">Valider la commande</button>
                <button disabled={busy} onClick={() => answer("declined")} className="rounded-lg border border-border px-4 py-2 font-semibold">Refuser</button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-secondary p-3 font-semibold">
              {data.status === "confirmed" ? "✓ Commande confirmée" : "Commande refusée"}
              {data.note && <span className="block font-normal">« {data.note} »</span>}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
