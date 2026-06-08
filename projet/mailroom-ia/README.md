# mailroom-ia

POC : tri automatique de courriers physiques scannés grâce à Azure Document Intelligence + LLM Foundry, avec front-office client et back-office admin.

## Lire en premier

| Document | Contenu |
|----------|---------|
| [SPEC.md](SPEC.md) | **Le QUOI** — pitch, utilisateurs, périmètre MVP, catégories supportées, jalons, risques |
| [DESIGN.md](DESIGN.md) | **Le COMMENT** — architecture (Mermaid), choix techno, classification hybride, modèle de données, historique des décisions |

Pratiques transverses (frontend, sécurité Azure, Python/FastAPI, classification IA) : voir `.github/instructions/` à la racine du repo — lues automatiquement par Copilot selon les fichiers édités.

## Structure cible (à scaffolder)

```
mailroom-ia/
├── SPEC.md
├── README.md                       ← ce fichier
├── docs/
│   └── decisions/                  ← ADRs
├── web/                            ← Container App : Next.js 15 (App Router) — frontend + BFF
│   ├── Dockerfile
│   ├── app/
│   │   ├── (admin)/                ← back-office
│   │   ├── (client)/               ← front-office
│   │   └── api/                    ← Route Handlers BFF
│   ├── components/
│   ├── lib/                        ← services purs (Blob, Cosmos, Foundry)
│   └── ...
├── worker/                         ← Container App Job : Python — ingestion + classification
│   ├── Dockerfile
│   ├── worker/
│   │   ├── main.py                 ← entrypoint (lecture queue, dispatch)
│   │   └── classify.py             ← logique de classification (pure, testable)
│   └── requirements.txt
└── infra/                          ← Bicep (à venir) : ACA Environment + Apps + Jobs
```

## Pré-requis (au-delà du README racine)

Tout est déjà là : voir le `requirements.txt` racine + le devcontainer Codespaces. Pour ce projet on ajoute :
- **Node.js 22 LTS** (pour Next.js) — `winget install OpenJS.NodeJS.LTS` ou via le devcontainer
- **Docker Desktop** (pour builder les images des Container Apps en local) — `winget install Docker.DockerDesktop`
- **Azure CLI extension `containerapp`** — `az extension add --name containerapp --upgrade`

## Statut

🌱 **Code scaffoldé** :
- ✅ `web/` — Next.js 15 (App Router) + Tailwind + shadcn-style components, BFF Route Handlers, adapters Blob/Cosmos via Managed Identity, Dockerfile multi-stage
- ✅ `worker/` — Python 3.13, pipeline DI + Foundry, adapters Blob/Queue/Cosmos/DI/Foundry, Dockerfile multi-stage
- ✅ `infra/` — Bicep en 2 passes (`infra-base.bicep` + `infra-apps.bicep`)
- ✅ `setup.ipynb` — orchestre tout : pré-requis, login, Bicep passe 1, projet Foundry, `az acr build` des 2 images, Bicep passe 2, tests, cleanup

**Pour démarrer** : ouvrir `setup.ipynb` et dérouler les cellules.

**À implémenter dans les jalons suivants** (cf. [SPEC.md §7](SPEC.md#7-jalons)) :
- Auth Entra (External ID clients, Entra ID admins)
- CRUD clients côté admin
- Polish UI mobile + PWA
- CI/CD GitHub Actions
