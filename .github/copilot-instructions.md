# Instructions Copilot — repo `stage`

Ces instructions s'appliquent à **tout le repo** (notebooks de formation et POC `projet/mailroom-ia`). Tu (Copilot) les lis automatiquement à chaque turn.

## Contexte du repo

- Repo de **formation pour stagiaire** : 6 notebooks de fondamentaux Azure + IA dans `notebooks/`, et un POC `projet/mailroom-ia` (app web de tri automatique de courriers scannés).
- Le stagiaire travaille sur **un Resource Group existant** au nom `rg-stage-<son-identifiant>`, sur lequel il a le rôle **Owner** RBAC. **Ne jamais créer ou supprimer de RG** ; toujours travailler dans celui-là.
- Région et noms de ressources sont **dérivés du nom du RG** (convention `*-stage-<id>`).

## Règles transverses

### Sécurité
1. **Aucune clé API en clair** — jamais dans le code, dans `.env`, dans les app settings Azure ou les commits Git. Utiliser **Managed Identity + Key Vault**.
2. **Ne jamais commit** de fichiers `.env`, `*.pem`, `*.key`, ou contenant des secrets.
3. Toujours valider les inputs **côté backend**, jamais faire confiance au frontend.

### Azure
4. **Ne jamais lancer `az group delete`** sur un RG du stagiaire.
5. Pour les nettoyages : suppression **ressource par ressource** uniquement.
6. SKUs : privilégier **gratuit (`F1`)** ou **bas coût (`S0`)** dans le contexte stagiaire.
7. SDK Python Azure : utiliser `azure-ai-projects >= 2.0` (data plane Foundry), `azure-mgmt-cognitiveservices >= 14.1` (management).

### Code
8. **TypeScript strict** côté frontend / BFF, **Python typé** (mypy strict) côté backend Python.
9. Pas de commentaires qui paraphrasent le code. Commentaire utile = explique le *pourquoi* d'une contrainte non évidente.
10. Pas d'over-engineering : pas de helper pour une opération unique, pas d'abstraction prématurée.

### Workflow
11. Avant un changement d'archi ou de techno → **proposer la décision** d'abord, puis l'ajouter au tableau §5 "Historique des décisions" de `projet/mailroom-ia/DESIGN.md` une fois validée.
12. Pour les questions ouvertes, formuler **2-3 options** avec tradeoff plutôt qu'imposer une réponse unique.

### Instructions ciblées (skills réutilisables)
Le dossier `.github/instructions/` contient des fichiers `*.instructions.md` avec frontmatter `applyTo:` (glob) — VS Code les charge automatiquement quand un fichier matche. Aujourd'hui présents :
- `frontend-design.instructions.md` — Next.js 15, React 19, Tailwind, shadcn, mobile-first, a11y
- `azure-managed-identity.instructions.md` — Managed Identity, RBAC, Key Vault, patterns Bicep
- `python-fastapi.instructions.md` — FastAPI, structure projet, async, déploiement container
- `python-quality.instructions.md` — typage strict, SOLID, OO, ruff/mypy/pytest
- `classification-hybride.instructions.md` — workflow DI + LLM Foundry pour `worker/`

## Stack du POC `mailroom-ia`

| Couche | Choix |
|--------|-------|
| Plateforme runtime | **Azure Container Apps Environment** (Apps + Jobs) — cf. ADR 004 |
| Frontend + BFF (`web`) | Container App : Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui |
| Worker ingestion (`worker-classify`) | Container App **Job** event-driven (KEDA `azure-queue` scaler) + Python 3.13 |
| Auth | Entra External ID (clients) + Entra ID (admins) |
| Stockage docs | Azure Blob Storage |
| Métadonnées | Azure Cosmos DB (NoSQL API) |
| Classification IA | Hybride : Document Intelligence + LLM multimodal Foundry (ADR 003) |
| Observabilité | Application Insights + Log Analytics (au niveau ACA Environment) + OpenTelemetry |

Référence détaillée : `projet/mailroom-ia/SPEC.md` (le QUOI) et `projet/mailroom-ia/DESIGN.md` (le COMMENT).

## Pour les notebooks pédagogiques (`notebooks/`)

- Cible : **stagiaire débutant**. Vocabulaire simple, schémas ASCII bienvenus, mises en situation concrètes.
- Toujours en **français**.
- Convention numérotation : `NN-titre.ipynb` (zéro-padded).
- Pour les sources externes (doc Microsoft Foundry surtout), **vérifier la doc récente** via les outils MCP `microsoft_docs_*` avant d'écrire — la nouvelle Foundry change vite.
