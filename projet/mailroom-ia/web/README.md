# web — Next.js 15 (App Router) + BFF

Front-office client + back-office admin + API Route Handlers (BFF).

## Lancer en local

```bash
npm install
# Variables d'env nécessaires (cf. setup.ipynb à la racine du projet)
$env:STORAGE_BLOB_URL="https://<account>.blob.core.windows.net"
$env:STORAGE_QUEUE_URL="https://<account>.queue.core.windows.net"
$env:STORAGE_QUEUE_NAME="doc-to-classify"
$env:STORAGE_CONTAINER="mailroom"
$env:COSMOS_ENDPOINT="https://<account>.documents.azure.com:443/"
$env:COSMOS_DATABASE="mailroom"
$env:COSMOS_CONTAINER_DOCUMENTS="documents"
# Auth dev : az login (DefaultAzureCredential prend le relais)
npm run dev
```

## Builder l'image Docker

```bash
docker build -t mailroom-web .
docker run -p 3000:3000 \
  -e STORAGE_BLOB_URL=... \
  -e COSMOS_ENDPOINT=... \
  mailroom-web
```

## Structure

```
app/
├── layout.tsx              ← shell racine
├── page.tsx                ← landing page
├── globals.css
├── (admin)/                ← group route admin
│   ├── layout.tsx
│   └── admin/
│       ├── page.tsx        (dashboard)
│       ├── clients/page.tsx
│       ├── inbox/page.tsx  (upload + queue à valider)
│       └── storage/page.tsx
├── (client)/
│   └── client/page.tsx
└── api/
    └── upload/route.ts     (BFF : upload → Blob + Queue)
lib/
├── azure/                  ← clients Blob, Queue, Cosmos (DefaultAzureCredential)
└── types/domain.ts         (modèles partagés front + BFF)
```

Cf. `.github/instructions/frontend-design.instructions.md` à la racine du repo.
