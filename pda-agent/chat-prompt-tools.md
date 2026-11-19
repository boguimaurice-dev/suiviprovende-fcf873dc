# Schéma des outils de l'agent — pour le dialogue (LLM)

Le chatbot de Provende (fichier `chatWithApp` dans le repo) doit pouvoir appeler
ces outils. Le message système doit décrire chacun avec sa schéma JSON (mode
`function_call`), de manière à ce que l'agent sélectionne l'outil et l'utilise.

---

## 1. calculate_formula_costs

Retourne le coût d'une formule pour une production.

```json
{
  "name": "calculate_formula_costs",
  "description": "Coût d'une formule pour une production (kg, sac 50 kg, tonne).",
  "parameters": {
    "type": "object",
    "properties": {
      "formulaId": { "type": "string", "description": "Identifiant de la formule." },
      "batchQtyKg": { "type": "number", "description": "Volume de production (kg). Défaut : 1000." }
    },
    "required": ["formulaId"]
  }
}
```

Réponse attendue : `{ formulaId, formulaName, batchQtyKg, ingredients, totalCost, costPerKg, costPerSac50, costPerTonne, missingPrices }`.

---

## 2. calculate_stock_runway

Autonomie des stocks.

```json
{
  "name": "calculate_stock_runway",
  "description": "Jours d'autonomie restante pour chaque matière.",
  "parameters": {
    "type": "object",
    "properties": {
      "windowDays": { "type": "number", "description": "Période de consommation (jours). Défaut : 14." },
      "thresholdDays": { "type": "number", "description": "Seuil d'alerte en jours. Défaut : 7." }
    }
  }
}
```

Réponse : `{ materials: [{ materialId, name, stock, consumptionPerDay, autonomyDays, thresholdDays, status }] }`.

---

## 3. detect_consumption_gaps

Écart entre stock réel et consommation théorique.

```json
{
  "name": "detect_consumption_gaps",
  "description": "Détecte les écarts entre le stock réel et la consommation théorique.",
  "parameters": {
    "type": "object",
    "properties": {
      "windowDays": { "type": "number" },
      "alertPercent": { "type": "number", "description": "Pourcentage d'alerte. Défaut : 5." }
    }
  }
}
```

Réponse : `{ entries: [{ materialId, name, actualStock, theoreticalConsumption, gap, gapPercent, signal }] }`.

---

## 4. draft_order_suggestion

Commande fournisseur brouillonnée pour les matières à réapprovisionner.

```json
{
  "name": "draft_order_suggestion",
  "description": "Suggestion de commande pour des matières en rupture (lecture seule).",
  "parameters": {
    "type": "object",
    "properties": {
      "windowDays": { "type": "number" },
      "thresholdDays": { "type": "number" }
    }
  }
}
```

Réponse : `{ suggestions: [{ materialId, name, stock, consumptionPerDay, autonomyDays, supplierId, supplierName, qtyToOrder, unitPrice }], summary }`.

---

## 5. generate_recharts_payload

Série temporelle pour les graphiques.

```json
{
  "name": "generate_recharts_payload",
  "description": "Série de consommation pour un périodes et un regroupement.",
  "parameters": {
    "type": "object",
    "properties": {
      "from": { "type": "string", "description": "Date de début (AAAA-MM-JJ)." },
      "to": { "type": "string", "description": "Date de fin (AAAA-MM-JJ)." },
      "grouping": { "type": "string", "enum": ["day", "week", "month"] }
    }
  }
}
```

Réponse : `{ series, materials, kg, value }`.

---

## Règles d'or du dialogue

- Ne jamais modifier les données de production.
- Toujours signaler explicitement les prix manquants.
- Proposer une commande, ne pas l'envoyer sans validation de l'utilisateur.
- Répondre en français, brièvement, avec les chiffres clés.
