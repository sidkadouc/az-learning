---
description: Workflow de classification hybride Document Intelligence + LLM Foundry — pipeline, prompts, seuils, fallback humain.
applyTo: "projet/mailroom-ia/worker/**/*.py"
---

# Classification hybride DI + LLM Foundry — règles d'implémentation

> Voir [DESIGN.md §3.3](../../projet/mailroom-ia/DESIGN.md) pour le rationale architectural.

## Vue d'ensemble du pipeline

```
PDF/image dans _inbox/<uuid>
       │
       ▼
┌──────────────────────────────────┐
│ 1. Document Intelligence          │
│    - prebuilt-layout (OCR + struct)│
│    - prebuilt-invoice si applicable│
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ 2. Tentative "fast path"          │
│    - Si invoice détecté & client   │
│      matché de façon unique → OK   │
│    - Sinon → étape 3               │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ 3. LLM Foundry (gpt-5-mini)      │
│    - Input : texte DI + image opt. │
│    - System prompt : catalogue cat │
│      + liste clients (truncated)   │
│    - Output JSON structuré         │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ 4. Décision                       │
│    confidence >= 0.8 → range       │
│    confidence < 0.8  → _inbox/     │
│    + flag needsReview              │
└──────────────────────────────────┘
       │
       ▼
   Update Cosmos + move Blob
```

## Étape 1 — Document Intelligence

```python
from azure.ai.documentintelligence.aio import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeResult

async def extract_with_di(
    client: DocumentIntelligenceClient,
    blob_url: str,
) -> tuple[AnalyzeResult, AnalyzeResult | None]:
    """Lance prebuilt-layout, puis prebuilt-invoice en parallèle si l'extension suggère une facture."""
    layout_poller = await client.begin_analyze_document(
        model_id="prebuilt-layout",
        analyze_request={"urlSource": blob_url},
    )
    invoice_poller = await client.begin_analyze_document(
        model_id="prebuilt-invoice",
        analyze_request={"urlSource": blob_url},
    )
    layout = await layout_poller.result()
    invoice = await invoice_poller.result()
    return layout, invoice if _is_likely_invoice(invoice) else None
```

**Règles** :
- Toujours lancer `prebuilt-layout` en priorité (OCR + structure → indispensable pour l'étape LLM).
- Lancer `prebuilt-invoice` en **parallèle** uniquement si on a un indice (extension, mots-clés "facture/invoice").
- Stocker la **sortie brute** de DI dans Cosmos (`classification.diRawOutput`) pour audit + ré-entraînement.

## Étape 2 — Fast path

Court-circuiter le LLM uniquement si **tous** les critères sont remplis :
- Modèle `prebuilt-invoice` retourné, avec champ `VendorName` ou `CustomerName` de confiance ≥ 0.95.
- Le nom matche **exactement une** entrée de la base clients (matching insensible casse + tolérance accents).
- Le type "facture" est explicite (catégorie = `factures`).

Sinon → étape 3 systématiquement. **Ne pas être trop agressif sur le fast path** : un faux positif silencieux est pire qu'un appel LLM en plus.

## Étape 3 — LLM Foundry

### Prompt system (template)

```python
SYSTEM_PROMPT = """Tu es un assistant de tri de courriers physiques scannés.

Tu reçois le texte OCRisé d'un document, et tu dois identifier :
1. Le client destinataire (parmi la liste fournie)
2. La catégorie et sous-catégorie du document

Catégories autorisées (catégorie / sous-catégories) :
- factures : <année> (ex: 2026)
- contrats : assurance, bancaire, telecom, autre
- avis-officiels : impots, caf, prefecture, tribunal, autre
- courriers : medical, professionnel, autre
- autres : (pas de sous-catégorie)

Liste des clients connus (id : nom) :
{clients_list}

RÈGLES :
- Si tu n'es PAS sûr du client, retourne clientId = null
- Si tu n'es PAS sûr de la catégorie, retourne category = "autres"
- La confidence doit refléter ta vraie certitude (0.0 à 1.0)
- Output STRICT en JSON, conforme au schéma fourni
- En cas de doute, baisse la confidence — le doc sera revu manuellement

Réponds uniquement avec le JSON, sans markdown ni commentaire."""
```

### Output schéma (Pydantic)

```python
from pydantic import BaseModel, Field

class ClassificationOutput(BaseModel):
    client_id: str | None = Field(default=None, description="ID du client matché, ou null si incertain")
    category: str = Field(description="Une des catégories autorisées")
    sub_category: str | None = Field(default=None)
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="Justification courte en français")
```

### Appel LLM via `azure-ai-projects`

```python
from azure.ai.projects.aio import AIProjectClient

async def classify_with_llm(
    project: AIProjectClient,
    di_text: str,
    clients_catalog: str,
) -> ClassificationOutput:
    openai = await project.get_openai_client()
    response = await openai.responses.create(
        model="gpt-5-mini",
        input=[
            {"role": "system", "content": SYSTEM_PROMPT.format(clients_list=clients_catalog)},
            {"role": "user", "content": di_text[:8000]},  # limiter à ~8k chars
        ],
        text_format=ClassificationOutput,  # forme strict JSON
    )
    return response.output_parsed
```

**Règles** :
- Utiliser **`gpt-5-mini`** par défaut (coût/perf optimal). Escalader vers `gpt-5` si confidence systématiquement basse.
- **Truncate** le texte DI à ~8 000 caractères max (suffit pour 99 % des courriers, évite les coûts).
- **Structured output** (JSON schema strict via `text_format=Pydantic`) — **jamais** parser une réponse free-text.
- Activer le **multimodal** (envoyer aussi l'image) uniquement si DI a échoué ou le doc est très visuel (formulaire).

### Liste clients dans le prompt

Si > 100 clients dans la base → **pré-filtrer avant le LLM** :
1. Embed la query (premiers 500 chars du texte DI).
2. Top-K (k=20) plus proches via Azure AI Search ou cosine sur Cosmos.
3. Injecter uniquement ces 20 dans le prompt.

Sinon : injecter la liste complète.

## Étape 4 — Décision & seuils

```python
CONFIDENCE_THRESHOLD = 0.8  # configurable via env var

def decide(output: ClassificationOutput) -> Decision:
    if output.client_id is None:
        return Decision.NEEDS_REVIEW
    if output.confidence < CONFIDENCE_THRESHOLD:
        return Decision.NEEDS_REVIEW
    if output.category not in ALLOWED_CATEGORIES:
        return Decision.NEEDS_REVIEW
    return Decision.AUTO_FILE
```

- `NEEDS_REVIEW` → le blob **reste** dans `_inbox/` avec `needsReview = true` en Cosmos.
- `AUTO_FILE` → blob déplacé vers `clients/<client_id>/<category>/<sub_category>/<filename>`, Cosmos updated.

## Observabilité

Pour chaque doc traité, émettre **une trace OpenTelemetry** avec :
- `doc.id`, `doc.size_bytes`, `doc.mime_type`
- `di.duration_ms`, `di.model_used`, `di.confidence`
- `llm.model`, `llm.input_tokens`, `llm.output_tokens`, `llm.duration_ms`
- `classification.client_id`, `classification.category`, `classification.confidence`
- `decision` (`auto_file` | `needs_review`)
- `total_cost_eur` (estimation)

Ces traces remontent dans Application Insights (cf. instructions Azure security).

## Tests

### Jeu de données d'évaluation

- Maintenir un dossier `worker/tests/fixtures/sample_docs/` avec **≥ 20 docs annotés** (PDF + JSON `expected.json`).
- Couvrir : factures (3 types), contrats, avis impôts, CAF, médical, doc bruité illisible.
- Test d'intégration : exécute le pipeline complet → compare output au `expected.json`, calcule **précision et recall** par catégorie.

### Métriques cibles MVP

| Métrique | Cible |
|----------|-------|
| Précision globale | ≥ 90 % |
| Recall sur factures | ≥ 95 % |
| Taux de `needsReview` faux positifs | ≤ 10 % |
| Latence p95 par doc | ≤ 15 s |
| Coût moyen par doc | ≤ 0,05 € |

Si en-dessous : itérer sur **les prompts** (few-shot, exemples), puis seulement envisager fine-tuning d'un SLM (`Phi-4`).

## Sécurité spécifique IA

- **Prompt Shields** activé côté Foundry pour bloquer prompt injection via contenu de docs malicieux.
- Si un doc contient `"ignore your instructions"` ou patterns suspects, log un warning + flag pour revue.
- **PII detection** (Azure AI Language) en plus pour masquer numéros sécu sociale / IBAN si on les redirige vers le LLM.
- Content Safety activé sur le déploiement modèle (niveau `medium`).

## Anti-patterns à éviter

- ❌ Parser une réponse free-text du LLM — toujours structured output.
- ❌ Faire confiance à un seul appel LLM pour décider — toujours le seuil + fallback humain.
- ❌ Envoyer le doc complet au LLM (gaspillage de tokens, fenêtre saturée).
- ❌ Injecter la liste complète des clients dans le prompt si > 100 — utiliser retrieval.
- ❌ Hardcoder le seuil de confiance — env var configurable.
- ❌ Mettre la logique de classification dans `function_app.py` / le handler — extraire en `classify.py` pur, testable hors infra.
