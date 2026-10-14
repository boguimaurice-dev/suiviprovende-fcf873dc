import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/demo")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Démo Provende — Testez en 5 minutes sans inscription" },
      {
        name: "description",
        content:
          "Essayez Provende avec une provenderie exemple : stock, formules, coût par sac, production et commandes fournisseurs. Sans compte.",
      },
      { property: "og:title", content: "Démo Provende — 5 minutes sans inscription" },
      { property: "og:description", content: "Testez la gestion de stock et de production d'aliments avec des données exemple." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

function buildDemoData() {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const days: Record<string, unknown> = {};
  for (let i = 1; i <= 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days[iso(d)] = { formulas: { A1: 1.5 + (i % 3) * 0.5, C2: 1 + (i % 2) }, faciKg: 0, note: "" };
  }
  return {
    month: iso(today).slice(0, 7),
    materials: [
      { id: "mais", name: "Maïs", supplier: "Coop. Bouaké", unitPrice: 230, stock: 9000, alertDays: 15 },
      { id: "soja", name: "T. de soja", supplier: "Agro Import", unitPrice: 420, stock: 1200, alertDays: 15 },
      { id: "son", name: "Son de blé", supplier: "Moulins CI", unitPrice: 110, stock: 3000, alertDays: 15 },
      { id: "coq", name: "Coquille marine", supplier: "Abidjan Port", unitPrice: 90, stock: 150, alertDays: 15 },
      { id: "cmv", name: "Prémix CMV 5%", supplier: "Agro Import", unitPrice: 1500, stock: 400, alertDays: 15 },
    ],
    formulas: [
      { id: "A1", family: "A · Poulette-Pondeuse", name: "Pondeuse", color: "#2f6b4f", mix: { mais: 600, soja: 200, son: 80, coq: 70, cmv: 50 } },
      { id: "C2", family: "C · Chair", name: "Chair croissance", color: "#c45c26", mix: { mais: 620, soja: 280, son: 50, cmv: 50 } },
    ],
    days,
    receipts: [{ id: "r1", date: iso(today), materialId: "mais", qty: 2000, note: "Livraison démo" }],
    finished: [{ id: "f1", name: "Pondeuse sac 50 kg", qty: 40, unitPrice: 17500 }],
    movements: [],
    sales: [],
    suppliers: [{ id: "s1", name: "Agro Import", phone: "", email: "" }],
    orders: [],
  };
}

function DemoPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const msg = e.data as { type?: string } | null;
      if (msg?.type === "provende:ready") {
        frameRef.current?.contentWindow?.postMessage(
          { type: "provende:init", data: buildDemoData() },
          window.location.origin,
        );
      }
      // Démo : aucune donnée n'est enregistrée sur le serveur.
    }
    window.addEventListener("message", onMessage);
    const frame = frameRef.current;
    const sendInit = () =>
      frame?.contentWindow?.postMessage({ type: "provende:init", data: buildDemoData() }, window.location.origin);
    if (frame?.contentDocument?.readyState === "complete" && frame.contentWindow?.location.pathname === "/provende.html") sendInit();
    else frame?.addEventListener("load", sendInit, { once: true });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-xs sm:px-5 sm:text-sm">
        <span className="font-semibold text-foreground">Mode démo — testez librement, rien n'est enregistré.</span>
        <Link to="/auth" className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
          Offre Pionniers 5 000 F/mois
        </Link>
      </header>
      <iframe ref={frameRef} src="/provende.html" title="Démo Provende" className="w-full flex-1 border-0" />
    </div>
  );
}
