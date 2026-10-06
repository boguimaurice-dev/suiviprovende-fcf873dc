import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { buildAnalytics, periodRange, type AnalyticsData } from "@/lib/analytics";

export const Route = createFileRoute("/analyse")({
  ssr: false,
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Analyse & Graphiques — Provende" },
    { name: "description", content: "Analyse privée de la consommation des matières premières et de leur valeur estimée." },
    { property: "og:title", content: "Analyse & Graphiques — Provende" },
    { property: "og:description", content: "Consommation par période et répartition par matière première." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AnalyticsPage,
});

const number = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({});
  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState(() => periodRange("month"));
  const [grouping, setGrouping] = useState("day");
  const [material, setMaterial] = useState("all");
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.type !== "provende:analytics-data") return;
      setData(e.data.data ?? {});
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "provende:analytics-ready" }, window.location.origin);
    const observer = new ResizeObserver(() => window.parent.postMessage({ type: "provende:analytics-height", height: document.documentElement.scrollHeight }, window.location.origin));
    observer.observe(document.body);
    return () => { observer.disconnect(); window.removeEventListener("message", onMessage); };
  }, []);
  const result = useMemo(() => buildAnalytics(data, range.from, range.to, grouping), [data, range, grouping]);
  const visible = result.materials.filter(m => material === "all" || m.id === material);
  const invalid = !range.from || !range.to || range.from > range.to;
  return <section className="bg-background py-5 text-foreground">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <h2 className="font-display text-2xl">Analyse & Graphiques</h2>
      <div className="flex flex-wrap gap-1" aria-label="Période">
        {[["today", "Aujourd’hui"], ["week", "Cette semaine"], ["month", "Ce mois"], ["year", "Cette année"], ["custom", "Plage personnalisée"]].map(([key, label]) => <Button key={key} size="sm" variant={period === key ? "default" : "outline"} aria-pressed={period === key} onClick={() => { setPeriod(key); if (key !== "custom") setRange(periodRange(key)); }}>{label}</Button>)}
      </div>
    </div>
    <div className="mb-5 flex flex-wrap items-end gap-3">
      {period === "custom" ? <>
        <label className="grid gap-1 text-sm">Du<input className="rounded-md border border-input bg-card p-2" type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /></label>
        <label className="grid gap-1 text-sm">Au<input className="rounded-md border border-input bg-card p-2" type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /></label>
      </> : <p className="text-sm text-muted-foreground">{range.from} — {range.to}</p>}
      <label className="grid gap-1 text-sm">Regroupement<select className="rounded-md border border-input bg-card p-2" value={grouping} onChange={e => setGrouping(e.target.value)}><option value="day">Quotidien</option><option value="week">Hebdomadaire</option><option value="month">Mensuel</option></select></label>
      <label className="grid gap-1 text-sm">Matière première<select className="max-w-full rounded-md border border-input bg-card p-2" value={material} onChange={e => setMaterial(e.target.value)}><option value="all">Toutes les matières</option>{(data.materials ?? []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    </div>
    {invalid && <p role="alert" className="mb-4 text-destructive">Choisissez une plage valide : la date de fin doit suivre la date de début.</p>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      <article className="rounded-lg border border-border bg-card p-4"><h3 className="text-sm text-muted-foreground">Total consommé · toutes matières</h3><p className="mt-2 text-2xl font-semibold">{number(result.kg)} kg</p><p className="text-sm text-muted-foreground">{number(result.kg / 1000)} tonnes</p></article>
      <article className="rounded-lg border border-border bg-card p-4"><h3 className="text-sm text-muted-foreground">Valeur estimée · prix actuels</h3><p className="mt-2 text-2xl font-semibold">{number(result.value)} F CFA</p>{result.materials.some(m => !m.priced) && <p className="text-sm text-destructive">Certaines matières n’ont pas de prix renseigné.</p>}</article>
    </div>
    {!result.kg ? <p className="py-12 text-center text-muted-foreground">Aucune consommation calculée à partir des productions sur cette période.</p> : <>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0"><h3 className="mb-4 font-semibold">Consommation par matière · kg</h3><div className="h-80 w-full" role="img" aria-label="Graphique en barres de consommation">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={result.series} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={v => grouping === "month" ? v : v.slice(5)} minTickGap={28} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} formatter={(v: number, name: string) => [`${number(v)} kg`, name]} />
            {visible.map(m => <Bar key={m.id} dataKey={m.key} name={m.name} stackId="consumption" fill={palette[result.materials.indexOf(m) % palette.length]} maxBarSize={44} />)}
          </BarChart></ResponsiveContainer>
        </div></div>
        <div className="min-w-0"><h3 className="mb-4 font-semibold">Répartition · toutes matières</h3><div className="h-80 w-full" role="img" aria-label="Graphique circulaire de répartition">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={result.materials} dataKey="kg" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}>{result.materials.map((m, i) => <Cell key={m.id} fill={palette[i % palette.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} formatter={(v: number, name: string) => [`${number(v)} kg · ${number(v / result.kg * 100)} %`, name]} /></PieChart></ResponsiveContainer>
        </div></div>
      </div>
      <div className="mt-5 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-3">Matière première</th><th>Consommation</th><th>Part</th><th>Valeur estimée</th></tr></thead><tbody>{result.materials.map(m => <tr key={m.id} className="border-b border-border"><td className="py-3">{m.name}</td><td>{number(m.kg)} kg</td><td>{number(m.kg / result.kg * 100)} %</td><td>{number(m.value)} F CFA</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}