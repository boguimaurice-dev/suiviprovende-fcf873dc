// agent-brain.ts — cerveau du PDA.
//
// Transforme une demande de l'utilisateur (en français) en appels d'outils
// (server functions) et synthétise une réponse en français.
//
// C'est le "cerveau" de l'agent : il ne fait pas le calcul lui-même mais
// décide QUOI calculer, appelle les bons outils, et réunit le résultat.
//
// Dépendances : tous les outils sont dans ../logic/pda-core.ts (version pure);
// les appels serveur se font via useServerFn dans ton frontend.
//
// Usage:
//   const brain = new AgentBrain(data, { userId });
//   const reply = await brain.think("Aide-moi à réapprovisionner");
//   // reply { answer, actions, confidence, tools }
//
// Note : ce fichier est la logique de routage. L'exécution des outils se fait
// côté serveur (server-functions/) ; la version front est un hook usePdaTools.

export type PdaData = import("./logic/pda-core").PdaData;
import {
  calculateFormulaCost,
  computeRunway,
  detectGaps,
  proposeOrderSuggestion,
  buildChartPayload,
} from "./logic/pda-core";

export type ToolName =
  | "calculate_formula_costs"
  | "calculate_stock_runway"
  | "detect_consumption_gaps"
  | "draft_order_suggestion"
  | "generate_recharts_payload"
  | "log_agent_action";

export interface ToolCall {
  name: ToolName;
  args: Record<string, unknown>;
}

export interface BrainReply {
  answer: string;       // réponse en français
  actions: "read" | "propose" | "ask"; // lecture / proposition / question
  tools: ToolCall[];    // les outils appelés
  confidence: number;   // 0..1
  status: "ok" | "needs_clarification";
}

// Intents reconnus (rulé); à enrichir au fur et à mesure.
const INTENTS: Record<string, ToolName[]> = {
  // coût
  "coût": ["calculate_formula_costs"],
  "cout": ["calculate_formula_costs"],
  "coûts": ["calculate_formula_costs"],
  "calculer le coût": ["calculate_formula_costs"],
  "prix de la formule": ["calculate_formula_costs"],
  "combien coûte": ["calculate_formula_costs"],

  // autonomie
  "autonomie": ["calculate_stock_runway"],
  "stock": ["calculate_stock_runway"],
  "stocks": ["calculate_stock_runway"],
  "ration": ["calculate_stock_runway"],
  "réserves": ["calculate_stock_runway"],
  "jours de stock": ["calculate_stock_runway"],
  "jours d'autonomie": ["calculate_stock_runway"],

  // écarts
  "écart": ["detect_consumption_gaps"],
  "ecart": ["detect_consumption_gaps"],
  "inventaire": ["detect_consumption_gaps"],
  "stock réel": ["detect_consumption_gaps"],
  "stock réel/": ["detect_consumption_gaps"],
  "boucle": ["detect_consumption_gaps"],
  "déficit": ["detect_consumption_gaps"],
  "manque": ["detect_consumption_gaps"],

  // commande
  "commande": ["draft_order_suggestion"],
  "commander": ["draft_order_suggestion"],
  "commande fournisseur": ["draft_order_suggestion"],
  "fournisseur": ["draft_order_suggestion"],
  "réapprovisionnement": ["draft_order_suggestion"],
  "astreindre": ["draft_order_suggestion"],
  "restock": ["draft_order_suggestion"],
  "commande entreprise": ["draft_order_suggestion"],

  // graphiques
  "graphique": ["generate_recharts_payload"],
  "graphe": ["generate_recharts_payload"],
  "chart": ["generate_recharts_payload"],
  "diagramme": ["generate_recharts_payload"],
  "historique": ["generate_recharts_payload"],
  "chronologie": ["generate_recharts_payload"],
  "tendance": ["generate_recharts_payload"],
  "évolution": ["generate_recharts_payload"],
  "période": ["generate_recharts_payload"],

  // rapport / synthèse générale
  "rapport": ["calculate_stock_runway", "detect_consumption_gaps"],
  "synthèse": ["calculate_stock_runway", "detect_consumption_gaps"],
  "bilan": ["calculate_stock_runway", "detect_consumption_gaps"],
  "situation": ["calculate_stock_runway", "detect_consumption_gaps"],
  "aide": ["calculate_stock_runway", "detect_consumption_gaps", "calculate_formula_costs"],

  // signature / trace
  "trace": ["log_agent_action"],
  "journal": ["log_agent_action"],
  "historique des actions": ["log_agent_action"],
  "mémoire": ["log_agent_action"],
};

// Mot-clé pour détecter un besoin de clarification.
const CLARIFY_KEYWORDS = [
  "quel",
  "quelle",
  "quels",
  "quelles",
  "qui",
  "qui est",
  "quelle formule",
  "quelle matière",
  "quel fournisseur",
  "combien",
  "combien de",
  "depuis quand",
  "depuis quand est",
  "exemple",
  "tu parles de",
  "dis-moi plus",
  "précise",
  "précisez",
  "s'il te plaît",
];

export class AgentBrain {
  private data: PdaData;
  private userId: string;

  constructor(data: PdaData, userId: string) {
    this.data = data;
    this.userId = userId;
  }

  // Analyse une demande et retourne la meilleure réponse (ou une clarification).
  async think(message: string): Promise<BrainReply> {
    const clean = message.trim().toLowerCase();
    if (!clean) {
      return {
        answer: "Tu as demandé quoi ? Dis-moi ce que tu veux savoir sur ta provenderie.",
        actions: "ask",
        tools: [],
        confidence: 0.5,
        status: "needs_clarification",
      };
    }

    // Détecte si c'est un appel de commande (exécution).
    const isCommand = clean.startsWith("exécute") || clean.startsWith("exécutez");
    // Détecte si c'est une demande d'aide explicite.
    const isHelp =
      clean === "aide" ||
      /^\s*aide([;,.\s]|$)/.test(clean) ||
      clean.includes("qu'est-ce que tu peux faire") ||
      clean.includes("qu'est-ce que je peux faire") ||
      clean.includes("que peux-tu faire") ||
      clean.includes("quel outil") ||
      clean.includes("que puis-je utiliser");

    if (isHelp) {
      return this.help();
    }

    // Actions prioritaires : réapprovisionnement, commande, fournisseur.
    const actionIntent = this.actionIntent(clean);
    if (actionIntent) {
      const params = this.buildParams(actionIntent[0], {});
      const result = await this.callTools([{ name: actionIntent[0], args: params }]);
      return {
        answer: this.summarize(clean, actionIntent, result),
        actions: actionIntent[0] === "draft_order_suggestion" ? "propose" : "read",
        tools: [{ name: actionIntent[0], args: params }],
        confidence: 0.85,
        status: "ok",
      };
    }

    if (isCommand) {
      return this.directExecute(clean);
    }

    // Reconnaissance d'intent.
    const matched = this.matchIntent(clean);
    if (!matched) {
      return this.unknownIntent(clean);
    }

    // Déduire les paramètres (matière / formule / fournisseur) depuis le message.
    const args = this.extractArgs(clean);

    // Outil principal pour l'intent.
    const primary = matched[0];
    const params = this.buildParams(primary, args);

    const tools: ToolCall[] = [
      { name: primary, args: params },
    ];

    // Si l'intent est une commande (draft_order_suggestion), c'est une proposition.
    let actions: "read" | "propose" | "ask" = "read";
    if (matched.includes("draft_order_suggestion")) actions = "propose";
    if (matched.includes("log_agent_action")) actions = "read";

    const result = await this.callTools(tools);
    return {
      answer: this.summarize(clean, matched, result),
      actions,
      tools,
      confidence: this.confidence(clean, matched, result),
      status: "ok",
    };
  }

  private matchIntent(clean: string): ToolName[] {
    for (const [keyword, tools] of Object.entries(INTENTS)) {
      if (clean.includes(keyword)) return tools;
    }
    return [];
  }

  private actionIntent(clean: string): ToolName[] | null {
    const actionKeywords = [
      "réapprovisionner", "commander", "fournisseur", "astreindre", "restock", "commande entreprise",
    ];
    for (const kw of actionKeywords) {
      if (clean.includes(kw)) return ["draft_order_suggestion"];
    }
    return null;
  }

  private extractArgs(clean: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    // Derniers N jours (ex: « 30 derniers jours », « 30 prochains jours »)
    const nLast = clean.match(/(\d+)\s*(prochains|derniers|dernières)\s*jours?/i);
    if (nLast) {
      const days = Number(nLast[1]);
      const end = new Date();
      end.setDate(end.getDate() - days);
      args.from = this.toISODate(end);
      args.to = this.toISODate(new Date());
      args.grouping = "day";
      return args;
    }
    // Période explicite (ex: « du 2026-11-01 au 2026-11-30 »)
    const from = clean.match(/(\d{4}-\d{2}-\d{2})/);
    const to = clean.match(/(\d{4}-\d{2}-\d{2})/);
    if (from && to) {
      args.from = from[1];
      args.to = to[1];
      args.grouping = "day";
    }
    return args;
  }

  private toISODate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildParams(tool: ToolName, args: Record<string, unknown>): Record<string, unknown> {
    switch (tool) {
      case "calculate_formula_costs":
        return { formulaId: args.formulaId ?? "f1" };
      case "calculate_stock_runway":
        return { windowDays: args.windowDays ?? 14, thresholdDays: args.thresholdDays ?? 7 };
      case "detect_consumption_gaps":
        return { windowDays: args.windowDays ?? 14, alertPercent: args.alertPercent ?? 5 };
      case "draft_order_suggestion":
        return { windowDays: args.windowDays ?? 14, thresholdDays: args.thresholdDays ?? 7 };
      case "generate_recharts_payload":
        return {
          from: args.from ?? null,
          to: args.to ?? null,
          grouping: args.grouping ?? "month",
        };
      default:
        return {};
    }
  }

  private async callTools(tools: ToolCall[]): Promise<unknown[]> {
    // Cette méthode est un squelette. Dans l'interface réelle, tu as un
    // useServerFn par outil. Ici, on simule le retour avec des données
    // réelles de pda-core (lecture seule) pour que la réponse soit cohérente.
    return tools.map((t) => this.dummyToolResult(t.name, t.args));
  }

  // Simulation d'un résultat côté serveur (version test/prototype).
  private dummyToolResult(name: ToolName, args: Record<string, unknown>): unknown {
    const material = (id: string) => this.data.materials?.find((m) => m.id === id);
    const formula = (id: string) => this.data.formulas?.find((f) => f.id === id);

    switch (name) {
      case "calculate_formula_costs": {
        const f = formula(args.formulaId as string ?? "f1");
        if (!f) return { formulaId: args.formulaId, formulaName: String(args.formulaId), error: "formule introuvable" };
        const res = calculateFormulaCost(f, this.data.materials ?? [], args.batchQtyKg as number ?? 1000);
        return {
          formulaId: f.id,
          formulaName: f.name,
          batchQtyKg: res.batchQtyKg,
          ingredients: res.ingredients.map((i) => ({ name: i.name, qtyKg: i.qtyKg, unitPrice: i.unitPrice, unitCost: i.unitCost })),
          costPerKg: res.costPerKg,
          costPerSac50: res.costPerSac50,
          costPerTonne: res.costPerTonne,
          missingPrices: res.missingPrices,
        };
      }
      case "calculate_stock_runway": {
        const runway = computeRunway(this.data, args as { windowDays?: number; thresholdDays?: number });
        return {
          materials: runway.map((r) => ({
            materialId: r.materialId,
            name: r.name,
            stock: r.stock,
            consumptionPerDay: r.consumptionPerDay,
            autonomyDays: r.autonomyDays,
            thresholdDays: r.thresholdDays,
            status: r.status,
          })),
        };
      }
      case "detect_consumption_gaps": {
        const gaps = detectGaps(this.data, args as { windowDays?: number; alertPercent?: number });
        return {
          entries: gaps.map((g) => ({
            materialId: g.materialId,
            name: g.name,
            actualStock: g.actualStock,
            theoreticalConsumption: g.theoreticalConsumption,
            gap: g.gap,
            gapPercent: g.gapPercent,
            signal: g.signal,
          })),
        };
      }
      case "draft_order_suggestion": {
        const order = proposeOrderSuggestion(this.data, args as { windowDays?: number; thresholdDays?: number; minAutonomy?: number });
        return {
          suggestions: order.suggestions.map((s) => ({
            materialId: s.materialId,
            name: s.name,
            stock: s.stock,
            autonomyDays: s.autonomyDays,
            supplierId: s.supplierId,
            supplierName: s.supplierName ?? null,
            qtyToOrder: s.qtyToOrder,
            unitPrice: s.unitPrice ?? null,
          })),
          summary: order.summary,
        };
      }
      case "generate_recharts_payload": {
        const chart = buildChartPayload(this.data, args.from as string ?? "2026-11-01", args.to as string ?? "2026-11-30", args.grouping as string ?? "month");
        const materials = chart.materials;
        return {
          series: chart.series.map((s) => ({ date: s.date, ...Object.fromEntries(materials.map((m) => [m.key, s[m.id] ?? 0])) })),
          materials: chart.materials.map((m) => ({ id: m.id, name: m.name, kg: m.kg, value: m.value })),
          kg: chart.kg,
          value: chart.value,
        };
      }
      case "log_agent_action": {
        return { ok: true, message: "trace enregistrée" };
      }
      default:
        return { error: `outil ${name} non implémenté dans ce squelette` };
    }
  }

  private summarize(clean: string, matched: ToolName[], result: unknown): string {
    if (result === null || typeof result !== "object") return "Données disponibles.";
    const results = Array.isArray(result) ? result : [result];
    const first = results[0];
    if (matched.includes("calculate_stock_runway") && first && typeof first === "object") {
      const r = first as { materials?: { name: string; autonomyDays: number; status: string }[] };
      const alert = r.materials?.filter((m) => m.status === "critical").map((m) => `${m.name}`);
      if (alert.length) return `⚠️ ${alert.join(", ")} ont une autonomie critique. Il faut agir vite.`;
      return "Stocks dans les normes : toutes les matières ont plus de 7 jours d'autonomie.";
    }
    if (matched.includes("detect_consumption_gaps") && first && typeof first === "object") {
      const e = first as { entries?: { name: string; signal: string; gap: number }[] };
      const alerts = e.entries?.filter((g) => g.signal === "alert").map((g) => `${g.name} (${g.gap} kg)`);
      if (alerts.length) return `🚨 ${alerts.join(", ")} sont en déficit.`;
      return "Aucun déficit : le stock réel est suffisant pour la période.";
    }
    if (matched.includes("draft_order_suggestion") && first && typeof first === "object") {
      const o = first as { suggestions?: { name: string; qtyToOrder: number }[] };
      const need = o.suggestions?.filter((s) => s.qtyToOrder > 0).map((s) => `${s.name} : ${s.qtyToOrder} kg`);
      if (need.length) return `💡 Commande à valider : ${need.join(" ; ")}.`;
      return "Aucune commande à proposer : tout est en sécurité.";
    }
    if (matched.includes("calculate_formula_costs") && first && typeof first === "object") {
      const c = first as { costPerKg?: number; costPerTonne?: number };
      const kg = c.costPerKg ?? 0;
      const tonnes = c.costPerTonne ?? 0;
      return `Le coût est de ${kg.toFixed(2)} F/kg (${tonnes.toFixed(2)} F/t).`;
    }
    if (matched.includes("generate_recharts_payload") && first && typeof first === "object") {
      const c = first as { kg?: number; series?: { date: string; consumption?: number }[] };
      const kg = c.kg ?? 0;
      const series = c.series ?? [];
      if (kg > 0) return `📊 Série de ${series.length} points, ${kg.toFixed(0)} kg consommés. Premier jour : ${series[0]?.date}.`;
      return "Série à ouvrir dans le graphique (jours ou mois).";
    }
    return "J'ai trouvé des informations. Dis-moi ce que tu en veux, ou précise ton besoin.";
  }

  private confidence(clean: string, matched: ToolName[], result: unknown): number {
    if (matched.length === 0) return 0.1;
    if (result === null || typeof result !== "object") return 0.5;
    const hasData = Array.isArray(result) && result.length > 0 ? true : false;
    return hasData ? 0.85 : 0.6;
  }

  private async directExecute(clean: string): Promise<BrainReply> {
    const body = clean.replace(/^exécute(s|z)?\s*/, "").trim();
    return {
      answer: `✅ Exécuté : ${body}. Le résultat arrive dans la réponse suivante.`,
      actions: "read",
      tools: [],
      confidence: 0.9,
      status: "ok",
    };
  }

  private help(): BrainReply {
    return {
      answer: [
        "Je suis ton cerveau : je lis ta provenderie et je calcule les choses qui t'intéressent.",
        "Ce que je peux faire (en français) :",
        "  • coût de production (kg / sac 50 kg / tonne)",
        "  • autonomie des stocks (combien de jours il reste)",
        "  • écarts stock réel vs consommation (déficit oui/non)",
        "  • commande fournisseur brouillonnée (à valider toi)",
        "  • graphiques d'évolution (consumption / prix)",
        "  • rapport de synthèse complet",
        "",
        "Exemples de demandes :",
        "  • « Combien coûte la formule f1 ? »",
        "  • « Quelle est mon autonomie de stock ? »",
        "  • « Quels sont les écarts ? »",
        "  • « Quelle commande je dois passer ? »",
      ].join("\n"),
      actions: "read",
      tools: [],
      confidence: 0.95,
      status: "ok",
    };
  }

  private unknownIntent(clean: string): BrainReply {
    return {
      answer: `Je ne comprends pas « ${clean} ». Dis-moi : « coût de X », « autonomie », « écarts », « commande », « graphique » ou « aide`.trim(),
      actions: "ask",
      tools: [],
      confidence: 0.1,
      status: "needs_clarification",
    };
  }
}
