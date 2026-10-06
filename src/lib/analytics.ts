export type AnalyticsData = {
  materials?: { id: string; name: string; unitPrice?: number }[];
  formulas?: { id: string; mix?: Record<string, number> }[];
  days?: Record<string, { formulas?: Record<string, number>; faciKg?: number }>;
  movements?: { date: string; type: string; materialId: string; qty: number }[];
};

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function periodRange(period: string, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") from.setDate(from.getDate() - (from.getDay() + 6) % 7);
  if (period === "month") from.setDate(1);
  if (period === "year") from.setMonth(0, 1);
  return { from: localDate(from), to: localDate(now) };
}

// Calendar formulas are the consumption source. Explicit stock withdrawals are
// separate operations and are not added again to avoid counting production twice.
export function buildAnalytics(data: AnalyticsData, from: string, to: string, grouping: string) {
  const totals = new Map<string, number>();
  const buckets = new Map<string, Record<string, number>>();
  if (!from || !to || from > to) return { series: [], materials: [], kg: 0, value: 0 };
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const bucketOf = (date: string) => {
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
  for (const [date, day] of Object.entries(data.days ?? {})) {
    if (date < from || date > to) continue;
    const bucket = bucketOf(date);
    const row = buckets.get(bucket) ?? {};
    for (const [formulaId, tonnes] of Object.entries(day.formulas ?? {})) {
      const formula = data.formulas?.find(f => f.id === formulaId);
      for (const [id, amount] of Object.entries(formula?.mix ?? {})) {
        const kg = Math.max(0, Number(amount) || 0) * Math.max(0, Number(tonnes) || 0);
        totals.set(id, (totals.get(id) ?? 0) + kg);
        row[id] = (row[id] ?? 0) + kg;
      }
    }
    buckets.set(bucket, row);
  }
  const materials = [...totals].filter(([, kg]) => kg > 0).map(([id, kg], index) => {
    const material = data.materials?.find(m => m.id === id);
    return { id, key: `material${index}`, name: material?.name ?? id, kg, value: kg * (material?.unitPrice ?? 0), priced: (material?.unitPrice ?? 0) > 0 };
  });
  const series = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({
    date,
    ...Object.fromEntries(materials.map(m => [m.key, row[m.id] ?? 0])),
  }));
  return { series, materials, kg: materials.reduce((sum, m) => sum + m.kg, 0), value: materials.reduce((sum, m) => sum + m.value, 0) };
}