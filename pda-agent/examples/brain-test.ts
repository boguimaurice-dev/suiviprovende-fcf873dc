import { AgentBrain } from "../agent-brain";
import { PdaData } from "../logic/pda-core";

const data: PdaData = {
  materials: [
    { id: "mp1", name: "Maïs", unitPrice: 210, stock: 5000, thresholdDays: 7 },
    { id: "mp2", name: "Tourteau de soja", unitPrice: 330, stock: 2000, thresholdDays: 7 },
    { id: "mp3", name: "Concentré FACI", unitPrice: 0, stock: 500, thresholdDays: 7 },
  ],
  formulas: [
    { id: "f1", name: "Ponte", mix: { mp1: 500, mp2: 300 } },
    { id: "f2", name: "Concentré", mix: { mp3: 500 } },
  ],
  days: {
    "2026-11-14": { formulas: { f1: 2 } },
    "2026-11-15": { formulas: { f1: 3 } },
    "2026-11-16": { formulas: { f1: 2, f2: 1 } },
  },
  suppliers: [
    { id: "sup1", name: "FACI" },
    { id: "sup2", name: "Lancet" },
  ],
};

const brain = new AgentBrain(data, "test-user");

const tests = [
  "Quels sont mes écarts de stock ?",
  "Aide-moi à réapprovisionner",
  "Combien coûte la formule Ponte ?",
  "Quelle est mon autonomie ?",
  "Render un graphique de consommation pour les 30 prochains jours",
  "Commande pour le fournisseur",
  "Qu'est-ce que tu peux faire ?",
];

(async () => {
  for (const msg of tests) {
    const reply = await brain.think(msg);
    console.log(`\nUSER: ${msg}`);
    console.log(`⬇️  ${reply.answer}`);
    console.log(`   outils=[${reply.tools.map((t) => t.name).join(", ") || "-"}]`);
  }
})();
