---
description: FastAPI — structure, async, dependency injection, déploiement container (ACA / App Service / Functions).
applyTo: "**/*.py"
---

# FastAPI & déploiement Python — règles

## Quand utiliser FastAPI dans ce repo

- Pour tout service Python qui expose **HTTP** (API REST / webhooks).
- Pour les workers ACA qui ont besoin d'un endpoint healthcheck/debug.
- **Pas** pour le worker d'ingestion principal (`worker-classify`) qui est event-driven (KEDA queue) — un simple `python -m worker.main` suffit, sans serveur web.

## Structure de projet recommandée

```
service/
├── pyproject.toml          ← deps + ruff + mypy + pytest config
├── Dockerfile
├── app/
│   ├── __init__.py
│   ├── main.py             ← création de l'app FastAPI + middlewares
│   ├── settings.py         ← Pydantic Settings (env vars)
│   ├── deps.py             ← Depends() partagés (auth, clients Azure)
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── routes_documents.py
│   │       └── routes_clients.py
│   ├── domain/             ← entités métier (Pydantic models, pas d'ORM ici)
│   │   ├── document.py
│   │   └── client.py
│   ├── services/           ← logique métier pure (testable sans HTTP)
│   │   ├── classification.py
│   │   └── storage.py
│   └── adapters/           ← intégrations externes (Blob, Cosmos, Foundry, DI)
│       ├── blob.py
│       ├── cosmos.py
│       └── foundry.py
└── tests/
    ├── unit/
    └── integration/
```

**Règle d'or** : `services/` ne sait rien d'HTTP ni de Azure. Les `adapters/` injectent les clients. Cette séparation permet de tester la logique métier sans mock complexe.

## Pattern de base — app

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from azure.monitor.opentelemetry import configure_azure_monitor

from app.settings import settings
from app.api.v1 import routes_documents, routes_clients


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_azure_monitor(connection_string=settings.appinsights_connection_string)
    # Init clients (DB pool, etc.) ici, fermeture après yield
    yield


app = FastAPI(
    title="mailroom-ia BFF",
    lifespan=lifespan,
    docs_url="/docs" if settings.env != "prod" else None,
)

app.include_router(routes_documents.router, prefix="/api/v1")
app.include_router(routes_clients.router, prefix="/api/v1")


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

## Pattern de base — settings (Pydantic v2)

```python
# app/settings.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    env: str = Field(default="dev")
    appinsights_connection_string: str = ""
    cosmos_endpoint: str
    blob_account_url: str
    foundry_project_endpoint: str


settings = Settings()  # type: ignore[call-arg]
```

⚠️ **Aucune clé** dans `Settings` — uniquement des endpoints. L'auth est via `DefaultAzureCredential()`.

## Async / await

- Routes : **toujours `async def`** pour les endpoints I/O bound (DB, HTTP, Blob).
- Utiliser les **clients async** Azure : `aio.BlobServiceClient`, `aio.CosmosClient`, etc. — pas les versions sync dans un endpoint async (ça bloque l'event loop).
- Pour du CPU-bound : `await asyncio.to_thread(...)` ou un worker dédié.

## Dependency Injection

```python
# app/deps.py
from typing import Annotated
from fastapi import Depends
from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob.aio import BlobServiceClient

from app.settings import settings


async def get_credential() -> DefaultAzureCredential:
    return DefaultAzureCredential()


async def get_blob_client(
    credential: Annotated[DefaultAzureCredential, Depends(get_credential)],
) -> BlobServiceClient:
    return BlobServiceClient(account_url=settings.blob_account_url, credential=credential)


BlobDep = Annotated[BlobServiceClient, Depends(get_blob_client)]
```

Puis dans la route :
```python
@router.get("/{doc_id}")
async def get_document(doc_id: str, blob: BlobDep) -> Document:
    ...
```

## Validation des inputs

- **Tout** ce qui vient du client (path, query, body, headers) est typé avec Pydantic v2.
- Limites de taille `Field(max_length=...)`, regex, contraintes.
- Body : un modèle Pydantic dédié, pas `dict[str, Any]`.

## Erreurs

- Utiliser `HTTPException(status_code=..., detail=...)` avec `status` enum, pas des codes magiques.
- Handler d'erreur global pour mapper les exceptions métier custom vers les codes HTTP corrects.
- **Jamais** d'`except Exception: pass`. Logguer + re-raise ou raise une exception spécifique.

## Tests

- **pytest** + **pytest-asyncio** + **httpx.AsyncClient** pour les tests d'intégration FastAPI.
- Couverture cible : **≥ 80 %** sur `services/` et `domain/` (la logique métier).
- Les `adapters/` peuvent avoir une couverture plus faible, testés en intégration.
- **Pas de mock excessif** : préférer des fakes (`InMemoryBlobRepository`) à `MagicMock`.

## Déploiement container (ACA)

### Dockerfile multi-stage minimal

```dockerfile
# Build stage
FROM python:3.13-slim AS builder
WORKDIR /build
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv export --frozen --no-dev --output-file requirements.txt

# Runtime stage
FROM python:3.13-slim
WORKDIR /app

RUN groupadd -r app && useradd -r -g app app

COPY --from=builder /build/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Container App / ACA

- **HTTP ingress** activé pour les services FastAPI.
- **probe `liveness`** sur `/health`, **probe `readiness`** sur `/health` aussi (ou `/ready` si init lourd).
- **Min replicas = 1** si latence critique, **0** si on tolère le cold start.
- **CPU/Memory** : commencer petit (0.25 CPU / 0.5 Gi) et monter selon métriques.
- **Managed Identity** activée, role assignments faits en Bicep (cf. instructions Azure security).

### Variables d'environnement

- **JAMAIS** de secret en env var directe.
- Endpoints + non-secrets : env vars normales du Container App.
- Secrets externes (clés tierces) : monter depuis Key Vault via `secrets:` du Container App.

## Observabilité

- `azure-monitor-opentelemetry` configuré au démarrage (cf. `lifespan` ci-dessus).
- Traces automatiques HTTP + dépendances (httpx, requests).
- Logs structurés via `logging` standard, pas `print()`.
- `cloud_RoleName` défini via `OTEL_SERVICE_NAME` ou `resource_attributes={"service.name": "web-bff"}`.

## Ce qu'il NE FAUT PAS faire
- ❌ Flask / Django pour un nouveau service ici — on standardise sur FastAPI.
- ❌ Clients sync (`BlobServiceClient` sans `.aio`) dans une route `async`.
- ❌ Logique métier dans les routes — extraire en `services/`.
- ❌ `print()` pour debug — utiliser `logger.info(...)`.
- ❌ `requirements.txt` édité à la main — passer par `uv`/`pip-compile`.
