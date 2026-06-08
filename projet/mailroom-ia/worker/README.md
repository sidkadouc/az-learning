# worker — ingestion & classification

Container App Job event-driven (KEDA azure-queue scaler).

## Lancer en local

```powershell
cd worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# Auth dev :
az login

Copy-Item .env.example .env
# … éditer .env avec vos endpoints (sans aucune clé)

python -m worker.main
```

## Builder l'image Docker

```powershell
docker build -t mailroom-worker .
docker run --rm `
  -e STORAGE_BLOB_URL=... `
  -e COSMOS_ENDPOINT=... `
  -e DOC_INTELLIGENCE_ENDPOINT=... `
  -e FOUNDRY_PROJECT_ENDPOINT=... `
  mailroom-worker
```

## Structure

```
worker/
├── pyproject.toml
├── Dockerfile
├── .env.example
└── worker/
    ├── main.py              ← entrypoint (boucle queue → pipeline)
    ├── settings.py          ← Pydantic Settings (env vars uniquement)
    ├── domain/models.py     ← Pydantic models (QueueMessage, ClassificationOutput…)
    ├── services/pipeline.py ← orchestrateur DI + LLM + décision (testable pur)
    └── adapters/
        ├── blob.py
        ├── queue.py
        ├── cosmos.py
        ├── doc_intelligence.py
        └── foundry.py
```

Règles : cf. `.github/instructions/python-quality.instructions.md` et `.github/instructions/classification-hybride.instructions.md` à la racine du repo.
