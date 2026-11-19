# Composant de chat — à coller dans ton app (SvelteKit/React)

## 1. `ChatPane.svelte` (ou `.tsx`)

Un élement de chat qui utilise `useServerFn` pour appeler les outils du PDA.
Il affiche un listing des messages, postule l'utilisateur, et affiche les
réponses de l'agent. À l'intérieur, tu as la logique de dispatch (agent-brain)
qui sélectionne l'outil en fonction du message.

```ts
// +page.svelte ou un composant React
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

// Les outils disponibles
import { calculateFormulaCosts } from "@/pda-agent/server-functions/pda-calculate-formula-costs";
import { calculateStockRunway } from "@/pda-agent/server-functions/pda-calculate-stock-runway";
import { detectConsumptionGaps } from "@/pda-agent/server-functions/pda-detect-consumption-gaps";
import { draftOrderSuggestion } from "@/pda-agent/server-functions/pda-draft-order-suggestion";
import { generateRechartsPayload } from "@/pda-agent/server-functions/pda-generate-recharts-payload";
import { logAgentAction } from "@/pda-agent/server-functions/pda-agent-logs";

type Message = {
  role: "user" | "assistant";
  text: string;
  payload?: unknown;
  tool?: string;
  error?: string;
};

export function ChatPane() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Salut ! Je suis ton cerveau : demande-moi ce que tu veux savoir sur ta provenderie." },
  ]);
  const [input, setInput] = useState("");

  const call = useServerFn((fn: string) => fn); // placeholder, voir plus bas
  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input }]);
    // Ici, l'agent-brain détermine l'outil et appelle le serveur
    // (voir agent-brain.ts)
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded ${m.role === "user" ? "bg-primary" : "bg-secondary"}`}>
            <p className="text-sm">{m.text}</p>
          </div>
        ))}
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Demande en français… (ex : « quels sont mes écarts ? »)"
            className="flex-1 rounded border p-2 text-sm"
          />
          <button onClick={send} className="rounded bg-primary px-4 py-2 text-white text-sm">Envoyer</button>
        </div>
      </div>
    </div>
  );
}
```

## 2. Intégration du moteur de dispatch (agent-brain)

Le `agent-brain.ts` que tu as téléchargé est le "cerveau". Il est conçu pour
être appelé par le composant lors de `send()` :

```ts
import { AgentBrain } from "@/pda-agent/agent-brain";
import type { PdaData } from "@/pda-agent/logic/pda-core";

// 1) lire les données de l'utilisateur (via supabase)
const { data: row } = await supabase
  .from("app_data")
  .select("data")
  .eq("user_id", userId)
  .maybeSingle();
const pda = typeof row?.data === "string"
  ? JSON.parse(row.data as string)
  : row?.data as PdaData;

// 2) lancer le cerveau
const brain = new AgentBrain(pda, userId);
const reply = await brain.think(userMessage);
// 3) afficher reply.answer, reply.tools, etc.
```

## 3. Outils serveur — correspondance

| Outil du prompt | Fichier serveur |
|---|---|
| `calculate_formula_costs` | `pda-calculate-formula-costs.ts` |
| `calculate_stock_runway` | `pda-calculate-stock-runway.ts` |
| `detect_consumption_gaps` | `pda-detect-consumption-gaps.ts` |
| `draft_order_suggestion` | `pda-draft-order-suggestion.ts` |
| `generate_recharts_payload` | `pda-generate-recharts-payload.ts` |
| `log_agent_action` | `pda-agent-logs.ts` |

## 4. Ce qu'il faut vérifier dans ton app

- Les `server-functions/` doivent être exposées comme des routes TanStack Start.
- Le `requireSupabaseAuth` est déjà configuré dans chaque fonction.
- Le `app_data` doit être sous RLS et associé à `user_id`.

---

> Le composant ci-dessus est un squelette. Adapte-le au framework de ton app
> (SvelteKit ou React). Le corps du dialogue et la génération de la réponse
> est assuré par le `agent-brain` + le `system-prompt.md`.
