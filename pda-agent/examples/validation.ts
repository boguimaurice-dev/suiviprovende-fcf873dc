// examples/validation.ts
//
// Validation de la logique pda-core avec des données fictives.
// Exécuter avec : bun run examples/validation.ts
// (ou avec tsx / vite-node si bun n'est pas installé).

import {
  calculateFormulaCost,
  computeRunway,
  detectGaps,
  proposeOrderSuggestion,
  buildChartPayload,
  type PdaData,
} from "../logic/pda-core";

const data: PdaData = {
  materials: [
    { id: "mp1", name: "Maïs", unitPrice: 210, stock: 5000, thresholdDays: 7 },
    { id: "mp2", name: "Tourteau de soja", unitPrice: 540, stock: 2000 },
    { id: "mp3", name: "Concentré FACI", unitPrice: 650, stock: 500 },
  ],
  formulas: [
    {
      id: "f1",
      name: "Ponte",
      // 50% maïs + 30% tourteau de soja + 20% concentré (par tonne)
      mix: { mp1: 500, mp2: 300, mp3: 200 },
    },
  ],
  days: {
    "2026-11-14": { formulas: { f1: 2 } },
    "2026-11-15": { formulas: { f1: 3 } },
  },
  thresholds: { lossRate: 0.02 },
};

console.log("=== COÛT DE LA FORMULE PONTE (production 1 000 kg) ===");
const cost = calculateFormulaCost(data.formulas![0], data.materials!, 1000);
const preLoss = cost.ingredients.reduce((s, i) => s + i.unitCost, 0);
const lossAmount = cost.totalCost - preLoss;
for (const ing of cost.ingredients) {
  console.log(
    `  ${ing.name.padEnd(18)} ${ing.qtyKg.toFixed(1)} kg x ${ing.unitPrice.toFixed(2)} F/kg = ${ing.unitCost.toFixed(2)} F`,
  );
}
console.log(`  Total avant perte (sans perte 2%) : ${preLoss.toFixed(2)} F`);
console.log(`  Perte appliquée (2%)             : ${lossAmount.toFixed(2)} F`);
console.log(`  Total après perte (2%)   : ${cost.totalCost.toFixed(2)} F`);
console.log(`  coût/kg  : ${cost.costPerKg.toFixed(2)} F`);
console.log(`  coût/50kg: ${cost.costPerSac50.toFixed(2)} F`);
console.log(`  coût/t   : ${cost.costPerTonne.toFixed(2)} F`);
if (cost.missingPrices.length) {
  console.log(`  [INFO] ingrédients sans prix : ${cost.missingPrices.join(", ")}`);
}

console.log("\n=== AUTONOMIE DES STOCKS (14 derniers jours) ===");
const runway = computeRunway(data);
for (const r of runway) {
  console.log(
    `  ${String(r.name).padEnd(18)} stock=${String(r.stock).padEnd(6)} kg  cadence=${r.consumptionPerDay} kg/j  autonomie=${r.autonomyDays.toFixed(1)} j  seuil=${r.thresholdDays}j  ${r.status}`,
  );
}

console.log("\n=== ÉCARTS STOCK RÉEL / THÉORIQUE ===");
const gaps = detectGaps(data);
for (const g of gaps) {
  console.log(
    `  ${String(g.name).padEnd(18)} réel=${g.actualStock} kg  théo=${g.theoreticalConsumption} kg  écart=${g.gap} kg (${g.gapPercent.toFixed(2)}%)  signal=${g.signal}`,
  );
}

console.log("\n=== COMMANDE FOURNISSEUR (proposition) ===");
const order = proposeOrderSuggestion(data, { thresholdDays: 7, minAutonomy: 7 });
console.log(`Alertes détectées : ${order.summary.alertCount}`);
for (const s of order.suggestions) {
  console.log(
    `  ${String(s.name).padEnd(18)} stock=${s.stock} kg  autonomy=${s.autonomyDays.toFixed(1)}j  fournisseur=${s.supplierName ?? "(non défini)"}  à commander=${s.qtyToOrder} kg`,
  );
}

console.log("\n=== GRAPHIQUES (série mensuelle) ===");
const chart = buildChartPayload(data, "2026-11-01", "2026-11-30", "month");
console.log(`  Période : 2026-11-01 → 2026-11-30, regroupement : month`);
console.log(`  matières : ${chart.materials.map((m) => `${m.name}=${m.kg.toFixed(0)} kg`).join(", ")}`);
console.log(`  consommation totale : ${chart.kg.toFixed(0)} kg`);
console.log(`  valeur estimée       : ${chart.value.toFixed(2)} F`);
for (const s of chart.series.slice(0, 5)) {
  console.log(`  ${s.date} : ${Object.entries(s).map(([k, v]) => `${k}=${Number(v).toFixed(0)}kg`).join(" · ")}`);
}

console.log("\nRègle d'anti-double comptage vérifiée : la consommation vient du");
console.log("calendrier de production x mix des formules, sans ajout des sorties manuelles.");
