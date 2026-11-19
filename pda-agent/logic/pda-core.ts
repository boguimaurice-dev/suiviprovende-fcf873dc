// pda-core.ts — Cœur métier de l'agent Provende Data Analyst (PDA).
//
// Version pure : aucune dépendance Supabase/framework. Que le JSON des données
// de l'utilisateur en entrée. Aucune écriture sur les données de production.
//
// Règles métier appliquées :
//  - Anti-double comptage : la consommation vient du calendrier de production
//    (app_data.days -> formulas), jamais des sorties manuelles.
//  - Pas de hallucination : un prix absent est signalé, pas inventé.
//  - Les valeurs monétaires sont exprimées en F CFA d'après le chat de base.

export type Material = {
  id: string;
  name: string;
  unitPrice?: number; // F CFA / kg (dernier prix d'achat)
  stock?: number; // kg
  thresholdDays?: number; // nb de jours avant rupture -> seuil d'alerte
  lossRate?: number; // taux de perte / de rattrapage appliqué au coût (ex: 0.02 = 2 %)
  supplierId?: string; // fournisseur habituel de la matière (id)
};

export type Formula = {
  id: string;
  name: string;
  mix?: Record<string, number>; // materialId -> kg matière par 1000 kg (1 t) de produit fini
};

export type OrderSuggestion = {
  materialId: string;
  name: string;
  stock: number;
  consumptionPerDay: number;
  autonomyDays: number;
  thresholdDays: number;
  supplierId: string | null;
  supplierName: string | null;
  qtyToOrder: number;
  unitPrice: number | null;
};

export type ChartSeries = {
  date: string;
  [materialId: string]: number;
};

export type ChartPayload = {
  series: ChartSeries[];
  materials: { id: string; key: string; name: string; kg: number; value: number; priced: boolean }[];
  kg: number;
  value: number;
};

export type PdaData = {
  materials?: Material[];
  formulas?: Formula[];
  finished?: Array<{ id: string; name: string }>;
  suppliers?: Array<{ id: string; name: string }>;
  days?: Record<
    string,
    { formulas?: Record<string, number>; faciKg?: number; note?: string }
  >;
  receipts?: Array<{
    date: string;
    materialId: string;
    qty: number;
    note?: string;
  }>;
  movements?: Array<{
    date: string;
    type: string;
    materialId: string;
    qty: number;
  }>;
  sales?: Array<{ date: string; qty: number; unitPrice?: number }>;
  arrangements?: Array<{
    date: string;
    materialId: string;
    counted: number;
    note?: string;
  }>;
};

export const DEFAULT_LOSS_RATE = 0.02;

export interface CostDetail {
  materialId: string;
  name: string;
  qtyKg: number;
  unitPrice: number;
  unitCost: number;
}

export interface FormulaCost {
  formulaId: string;
  formulaName: string;
  batchQtyKg: number;
  ingredients: CostDetail[];
  totalCost: number;
  costPerKg: number;
  costPerSac50: number;
  costPerTonne: number;
  missingPrices: string[];
  note?: string;
}

export interface RunwayEntry {
  materialId: string;
  name: string;
  stock: number;
  consumptionPerDay: number;
  autonomyDays: number;
  thresholdDays: number;
  status: "secure" | "warning" | "critical";
}

export interface GapEntry {
  materialId: string;
  name: string;
  actualStock: number;
  theoreticalConsumption: number;
  gap: number;
  gapPercent: number;
  signal: "ok" | "suspect" | "alert";
}

export function resolveMaterials(data: PdaData): Material[] {
  return (data.materials ?? []).map((m) => ({
    id: String(m.id ?? ""),
    name: String(m.name ?? m.id ?? "inconnu"),
    unitPrice: Number(m.unitPrice ?? 0),
    stock: Number(m.stock ?? 0),
    thresholdDays: Number(m.thresholdDays ?? data.thresholdDays ?? 7),
    lossRate: Number(m.lossRate ?? data.lossRate ?? DEFAULT_LOSS_RATE),
  }));
}

export function resolveFormulas(data: PdaData): Formula[] {
  return (data.formulas ?? []).map((f) => ({
    id: String(f.id ?? ""),
    name: String(f.name ?? f.id ?? "inconnu"),
    mix: f.mix ?? {},
  }));
}

export function resolveDays(data: PdaData): DayProduction {
  const days = data.days ?? {};
  const ordered: DayProduction = {};
  Object.keys(days)
    .sort()
    .forEach((d) => {
      ordered[d] = days[d] ?? {};
    });
  return ordered;
}

// Coût d'une formule pour une production de batchQtyKg.
// mix = kg de matière par 1000 kg (1 t) de produit fini
// -> pour batchQtyKg : qty = mix * batchQtyKg / 1000
export function calculateFormulaCost(
  formula: Formula,
  materials: Material[],
  batchQtyKg: number,
): FormulaCost {
  if (!formula || !formula.id) {
    throw new Error("calculateFormulaCost : formula_id manquant");
  }
  if (batchQtyKg <= 0) {
    throw new Error("batchQtyKg doit être strictement positif");
  }

  const ingredients: CostDetail[] = [];
  const missingPrices: string[] = [];
  let total = 0;

  for (const [materialId, kgPerTonne] of Object.entries(formula.mix ?? {})) {
    const m = materials.find((x) => x.id === materialId);
    if (!m || m.unitPrice === undefined || m.unitPrice === null) {
      missingPrices.push(materialId);
      continue;
    }
    const qtyKg = kgPerTonne * batchQtyKg / 1000;
    const unitCost = m.unitPrice * qtyKg;
    total += unitCost;
    ingredients.push({
      materialId,
      name: m.name,
      qtyKg,
      unitPrice: m.unitPrice,
      unitCost,
    });
  }

  const lossRate =
    formula.lossRate ??
    materials.find((m) => m.id === formula.id)?.lossRate ??
    DEFAULT_LOSS_RATE;

  const totalWithLoss = total * (1 + lossRate);

  return {
    formulaId: formula.id,
    formulaName: formula.name,
    batchQtyKg,
    ingredients,
    totalCost: totalWithLoss,
    costPerKg: totalWithLoss / batchQtyKg,
    costPerSac50: totalWithLoss / (batchQtyKg / 50),
    costPerTonne: totalWithLoss / (batchQtyKg / 1000),
    missingPrices,
    note: missingPrices.length ? `Coût partiel — ingrédients sans prix : ${missingPrices.join(", ")}` : undefined,
  };
}

// Autonomie des stocks par matière sur la fenêtre récente.
export function computeRunway(data: PdaData, opts?: { windowDays?: number; thresholdDays?: number }) {
  const materials = resolveMaterials(data);
  const days = resolveDays(data);
  const window = opts?.windowDays ?? 14;
  const threshold = opts?.thresholdDays ?? 7;

  const dayKeys = Object.keys(days).sort();
  const recent = dayKeys.slice(-window);

  const consumptionPerMaterial: Record<string, number> = {};
  for (const date of recent) {
    const entry = days[date];
    const formulas = entry?.formulas;
    if (!formulas) continue;
    for (const [formulaId, tonnes] of Object.entries(formulas)) {
      const formula = data.formulas?.find((f) => f.id === formulaId);
      if (!formula) continue;
      for (const [materialId, kgPerTonne] of Object.entries(formula.mix ?? {})) {
        consumptionPerMaterial[materialId] =
          (consumptionPerMaterial[materialId] ?? 0) + kgPerTonne * tonnes;
      }
    }
  }

  const perDay = Object.fromEntries(
    Object.entries(consumptionPerMaterial).map(([id, total]) => [
      id,
      total / Math.max(1, recent.length),
    ]),
  );

  return materials.map((m) => {
    const daily = perDay[m.id] ?? 0;
    const autonomy = daily > 0 ? m.stock / daily : Infinity;
    let status: RunwayEntry["status"] = "secure";
    if (typeof autonomy === "number" && autonomy <= threshold / 2) status = "critical";
    else if (typeof autonomy === "number" && autonomy <= threshold) status = "warning";

    return {
      materialId: m.id,
      name: m.name,
      stock: m.stock,
      consumptionPerDay: Math.round(daily * 100) / 100,
      autonomyDays: autonomy,
      thresholdDays: threshold,
      status,
    };
  });
}

// Écart entre stock réel (materials.stock) et consommation théorique (production x mix).
export function detectGaps(data: PdaData, opts?: { windowDays?: number; alertPercent?: number }) {
  const materials = resolveMaterials(data);
  const days = resolveDays(data);
  const window = opts?.windowDays ?? 14;
  const alertPercent = opts?.alertPercent ?? 5;

  const dayKeys = Object.keys(days).sort();
  const recent = dayKeys.slice(-window);
  const theoretical: Record<string, number> = {};

  for (const date of recent) {
    const entry = days[date];
    const formulas = entry?.formulas;
    if (!formulas) continue;
    for (const [formulaId, tonnes] of Object.entries(formulas)) {
      const formula = data.formulas?.find((f) => f.id === formulaId);
      if (!formula) continue;
      for (const [materialId, kgPerTonne] of Object.entries(formula.mix ?? {})) {
        theoretical[materialId] = (theoretical[materialId] ?? 0) + kgPerTonne * tonnes;
      }
    }
  }

  return materials.map((m) => {
    const expected = theoretical[m.id] ?? 0;
    const actualStock = m.stock ?? 0;
    const gap = actualStock - expected;
    const gapPercent = expected > 0 ? (gap / expected) * 100 : 0;
    let signal: GapEntry["signal"] = "ok";
    if (Math.abs(gapPercent) >= alertPercent) signal = gap < 0 ? "alert" : "suspect";
    else if (gap < 0) signal = "alert";

    return {
      materialId: m.id,
      name: m.name,
      actualStock,
      theoreticalConsumption: expected,
      gap,
      gapPercent: Math.round(gapPercent * 100) / 100,
      signal,
    };
  });
}

// Commande fournisseur proposée pour les matières en rupture ou sous seuil.
export function proposeOrderSuggestion(
  data: PdaData,
  opts?: { windowDays?: number; thresholdDays?: number; minAutonomy?: number },
) {
  const materials = resolveMaterials(data);
  const window = opts?.windowDays ?? 14;
  const threshold = opts?.thresholdDays ?? 7;
  const minAutonomy = opts?.minAutonomy ?? threshold;

  const runway = computeRunway(data, { windowDays: window, thresholdDays: threshold });

  const suppliersById = new Map();
  for (const s of (data.suppliers ?? [])) {
    if (s && s.id) suppliersById.set(String(s.id), s);
  }
  const firstSupplier = suppliersById.size > 0 ? suppliersById.values().next().value : null;

  const suggestions: OrderSuggestion[] = [];
  for (const entry of runway) {
    if (entry.autonomyDays === Infinity) continue;
    if (entry.autonomyDays >= minAutonomy) continue;

    const material = materials.find((x) => x.id === entry.materialId);
    const supplier = material.supplierId
      ? suppliersById.get(String(material.supplierId)) ?? null
      : firstSupplier;

    const targetStock = entry.consumptionPerDay * threshold * 1.25; // +25 % de sécurité
    const qtyToOrder = Math.max(0, Math.ceil(targetStock - entry.stock));
    if (qtyToOrder <= 0) continue;

    suggestions.push({
      materialId: entry.materialId,
      name: entry.name,
      stock: entry.stock,
      consumptionPerDay: entry.consumptionPerDay,
      autonomyDays: entry.autonomyDays,
      thresholdDays: entry.thresholdDays,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      qtyToOrder,
      unitPrice: material.unitPrice ?? null,
    });
  }

  return {
    suggestions,
    summary: {
      windowDays: window,
      thresholdDays: threshold,
      alertCount: suggestions.length,
    },
  };
}

// Série temporelle pour les graphiques (Recharts).
export function localDate(date: string | Date): string {
  if (typeof date === "string") return date.slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
}

export function buildChartPayload(
  data: PdaData,
  from: string,
  to: string,
  grouping: string,
): ChartPayload {
  const totals = new Map<string, number>();
  const buckets = new Map<string, Record<string, number>>();
  if (!from || !to || from > to) {
    return { series: [], materials: [], kg: 0, value: 0 };
  }
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const bucketOf = (date: string): string => {
    if (grouping === "month") return date.slice(0, 7);
    if (grouping === "week") {
      const d = new Date(`${date}T12:00:00`);
      d.setDate(d.getDate() - (d.getDay() + 6) % 7);
      return localDate(d);
    }
    return date;
  };
  for (let d = new Date(start), count = 0; d <= end && count < 36600; d.setDate(d.getDate() + 1), count++) {
    const key = bucketOf(localDate(d));
    if (!buckets.has(key)) buckets.set(key, {});
  }
  const days = resolveDays(data);
  for (const [date, day] of Object.entries(days)) {
    if (date < from || date > to) continue;
    const bucket = bucketOf(date);
    const row = buckets.get(bucket) ?? {};
    for (const [formulaId, tonnes] of Object.entries(day.formulas ?? {})) {
      const formula = data.formulas?.find((f) => f.id === formulaId);
      if (!formula) continue;
      for (const [materialId, kgPerTonne] of Object.entries(formula.mix ?? {})) {
        const kg = Math.max(0, Number(kgPerTonne) || 0) * Math.max(0, Number(tonnes) || 0);
        totals.set(materialId, (totals.get(materialId) ?? 0) + kg);
        row[materialId] = (row[materialId] ?? 0) + kg;
      }
    }
    buckets.set(bucket, row);
  }
  const materials = [...totals]
    .filter(([, kg]) => kg > 0)
    .map(([id, kg], index) => {
      const material = data.materials?.find((m) => m.id === id);
      return {
        id,
        key: `material${index}`,
        name: material?.name ?? id,
        kg,
        value: kg * (material?.unitPrice ?? 0),
        priced: material?.unitPrice ? true : false,
      };
    });
  const series = [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({
      date,
      ...Object.fromEntries(materials.map((m) => [m.key, row[m.id] ?? 0])),
    }));
  return { series, materials, kg: materials.reduce((sum, m) => sum + m.kg, 0), value: materials.reduce((sum, m) => sum + m.value, 0) };
}


