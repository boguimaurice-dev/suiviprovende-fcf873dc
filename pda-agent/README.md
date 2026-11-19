# pda-agent — Provende Data Analyst

Agent de gestion technico-économique de la provenderie, conforme à la spécification
du client (Analyste Provende).

Ce dossier contient les outils de calcul et de lecture, ainsi qu'un example de
validation avec des données fictives. Il ne modifie jamais les données de
production : tous les outils sont en lecture seule.

## Structure

- `logic/pda-core.ts` : calculs purs (coût, autonomie, écarts) — aucune dépendance
  Supabase. À tester indépendamment.
- `server-functions/pda-calculate-formula-costs.ts` : coût d'une formule au kg,
  sac 50 kg, tonne.
- `server-functions/pda-calculate-stock-runway.ts` : autonomie des stocks.
- `server-functions/pda-detect-consumption-gaps.ts` : écarts stock réel / théorique.
- `examples/validation.ts` : exemple de calcul avec des données fictives.

## Intégration

1. Copier ce dossier dans le projet, par exemple `src/pda-agent/`.
2. Les fonctions serveur utilisent `requireSupabaseAuth` et la table `app_data` (JSON
   par utilisateur). Aucun changement de schéma requis pour l'usage de base.
3. Appeler un serveur function depuis le frontend via `@tanstack/react-start`
   `useServerFn(calculateFormulaCosts)` et ainsi de suite.

### Format attendu de `app_data.data`

```json
{
  "materials": [
    { "id": "mp1", "name": "Maïs", "unitPrice": 210, "stock": 5000, "thresholdDays": 7 }
  ],
  "formulas": [
    { "id": "f1", "name": "Ponte", "mix": { "mp1": 500, "mp2": 300 } }
  ],
  "days": {
    "2026-11-14": { "formulas": { "f1": 2 } },
    "2026-11-15": { "formulas": { "f1": 3 } }
  }
}
```

`mix` = kg de matière par 1000 kg (1 t) de produit fini. Exemple : un mélange
50% maïs + 50% concentré donne `mp1: 500`, `mp2: 500`.

## Nouveaux outils (ajoutés pour compléter la spécification)

| Outil | Fichier serveur |
|---|---|
| `draft_order_suggestion` | `server-functions/pda-draft-order-suggestion.ts` |
| `generate_recharts_payload` | `server-functions/pda-generate-recharts-payload.ts` |
| `log_agent_action` | `server-functions/pda-agent-logs.ts` |

## Cerveau de l'agent — le "cerveau" du PDA

Le dossier `pda-agent/` contient aussi le **cerveau** (agent-brain) et le **prompt
système** pour le dialogue en français :

- `agent-brain.ts` — moteur de dispatch : une phrase de l'utilisateur est analysée,
  l'intention est reconnue, l'outil serveur approprié est appelé, et la réponse est
  synthétisée en français (`reply.answer`, `reply.tools`, `reply.actions`,
  `reply.confidence`).
- `system-prompt.md` — le prompt système à envoyer au LLM pour le configurer comme
  âme de l'application (rôle, contexte `app_data`, règles de lecture seule, exemples).
- `chat-ui-component.md` — composant de chat (Svelte/React) à coller dans le
  frontend, avec les appels `useServerFn` et l'intégration du cerveau.
- `examples/brain-test.ts` — exemple de tests du cerveau.

### Exemple d'utilisation du cerveau (frontend)

```ts
import { AgentBrain } from "@/pda-agent/agent-brain";
import { PdaData } from "@/pda-agent/logic/pda-core";

// 1) Lire les données pour le compte connecté (via supabase)
const { data: row } = await supabase
  .from("app_data")
  .select("data")
  .eq("user_id", userId)
  .maybeSingle();
const pda = typeof row?.data === "string"
  ? JSON.parse(row.data as string)
  : row?.data as PdaData;

// 2) Lancer le cerveau avec la demande
const brain = new AgentBrain(pda, userId);
const reply = await brain.think("Aide-moi à réapprovisionner");
// reply.answer  → la réponse française
// reply.tools   → [{ name: "draft_order_suggestion", args: {...} }]
// reply.actions → "propose" si une commande est suggérée
```

## Intégration dans l'application

1. Copier `pda-agent/` dans le projet (ex. `src/pda-agent/`).
2. Exposer les fonctions serveur (via routes TanStack Start) et vérifier que
   `requireSupabaseAuth` est configuré.
3. Dans le frontend, appeler un `useServerFn` par outil (voir
   `chat-ui-component.md`).
4. Utiliser `system-prompt.md` comme système de prompt pour le modèle LLM.
5. S'assurer que `app_data` est soumis à RLS (`user_id`).

## Sécurité et règles

- Lecture seule : aucun outil ne modifie les écritures de production.
- Cloisonnement par `user_id` (RLS).
- Zéro hallucination : un prix manquant est signalé, pas inventé.
- La commande serveur ne doit jamais être envoyée sans validation de
  l'utilisateur.
- Langue : réponse en français, chiffres précis, alerte explicite.

## Notes complémentaires

- `log_agent_action` : trace de l'agent (tool, params, résultat, succès, durée).
- `import_member_entries` / `agent_logs` : mémoire et logs (partiellement présent).
- Tâche planifiée (`cron`) pour le rapport de non-connexion (documenté dans
  `cron/rapport-inactif.ts`).
