# infra — Bicep (2 passes)

Déploiement en **deux passes** pour résoudre la dépendance circulaire « image dans ACR » ↔ « Container App qui pull l'image » :

## Passe 1 — `infra-base.bicep`

Crée tout ce qui ne dépend pas des images applicatives :
- Log Analytics + Application Insights
- ACR (Basic)
- Storage Account + container `mailroom` + queue `doc-to-classify`
- Cosmos DB Serverless + database `mailroom` + containers `documents` / `clients`
- Microsoft Foundry (AIServices) + déploiement modèle (`gpt-5-mini` par défaut)
- ACA Environment

> Le projet Foundry est créé **après** via `az cli` (l'API ARM `accounts/projects` change vite — c'est plus fiable en CLI).

## Passe 2 — `infra-apps.bicep`

À lancer **après** avoir buildé et pushé les images dans l'ACR. Crée :
- Container App `web` (ingress externe)
- Container App Job `worker-classify` (event-driven, KEDA `azure-queue`)
- Toutes les **Managed Identities** + **role assignments** (least privilege)

## Tout est piloté par `../setup.ipynb`

Vous n'avez normalement pas à lancer ces déploiements à la main — le notebook le fait étape par étape.
