# SPEC — `mailroom-ia`

> **Le QUOI** : périmètre fonctionnel, utilisateurs, jalons.  
> Pour le **COMMENT** (architecture, choix techno, modèle de données), voir [DESIGN.md](DESIGN.md).

## 1. Pitch

Application web de **tri automatique de courriers physiques scannés**. Un administrateur uploade un PDF/image, l'IA identifie le **client destinataire** et la **catégorie** du document, et le range dans un Blob Storage hiérarchique. Les clients consultent leurs documents via un front-office mobile-first.

## 2. Utilisateurs & cas d'usage

| Rôle | Auth | Ce qu'il fait |
|------|------|---------------|
| 🧑‍💼 **Admin** | Entra ID (tenant interne) | CRUD clients, upload des docs scannés, inbox des docs à valider, explorateur complet de l'arborescence storage, statistiques de classification |
| 👤 **Client** | Entra External ID | Consulte **uniquement** son arborescence (`clients/<son-id>/...`), preview PDF, recherche full-text/sémantique |

## 3. Périmètre fonctionnel (MVP)

- ✅ Upload d'un scan (PDF, JPG, PNG) côté admin
- ✅ Classification automatique : `client` + `catégorie` + `sous-catégorie`
- ✅ Rangement dans Blob `clients/<client-id>/<categorie>/<sous-categorie>/<filename>.pdf`
- ✅ Inbox des documents en attente de validation (confiance < seuil)
- ✅ Front-office client : arborescence + preview + download
- ✅ Back-office admin : CRUD clients + explorateur storage + queue à valider
- ✅ Mobile-first + accessible (WCAG AA)

**Hors MVP :** OCR de docs manuscrits avancé, signature électronique, workflow d'approbation multi-étapes, recherche sémantique full-RAG (phase 2).

## 4. Contraintes non-fonctionnelles

| | |
|---|---|
| Plateforme | Web responsive (mobile-first, mais utilisable PC) |
| Auth | OIDC Entra (External ID pour clients) — **jamais de mot de passe géré nous-mêmes** |
| Sécurité | Aucune clé API en clair · Managed Identity · Key Vault · HTTPS uniquement |
| Coût cible MVP | < 30 €/mois pour 0-100 docs/jour |
| Latence ingestion | < 1 min entre upload et classification visible |
| Volume cible v1 | 1 000 docs/jour max |
| Région Azure | Suivre celle du `rg-stage-<id>` (auto-détectée) |

## 5. Architecture & modèle de données

→ Voir **[DESIGN.md](DESIGN.md)** (architecture Mermaid, choix techno, classification hybride, modèle Blob + Cosmos).

Résumé ultra-court : **un Azure Container Apps Environment** héberge `web` (Next.js + BFF) et `worker-classify` (Python event-driven via KEDA queue). Classification **hybride Document Intelligence + LLM Foundry**.

## 6. Catégories de docs supportées (MVP)

| Catégorie | Sous-catégories | Détection |
|-----------|-----------------|-----------|
| `factures` | par année | DI prebuilt `prebuilt-invoice` + LLM |
| `contrats` | `assurance`, `bancaire`, `telecom`, `autre` | LLM |
| `avis-officiels` | `impots`, `caf`, `prefecture`, `tribunal`, `autre` | LLM |
| `courriers` | `medical`, `professionnel`, `autre` | LLM |
| `autres` | — | LLM (fallback) |

Seuil de confiance par défaut : **0.8**. En dessous → `_inbox/` avec flag `needsReview = true`.

## 7. Jalons

| # | Jalon | Délivrable |
|---|-------|------------|
| 0 | Bootstrap | Repo + Next.js + worker + connexion Azure |
| 1 | Pipeline d'ingestion | Upload → classification → rangement Blob (admin uniquement, pas d'auth client) |
| 2 | Back-office admin | CRUD clients + explorateur storage + queue à valider |
| 3 | Front-office client | Auth Entra External ID + arborescence + preview |
| 4 | Polish mobile + PWA | Responsive validé + installable |
| 5 *(optionnel)* | Recherche sémantique | Index AI Search + RAG sur les docs du client |

## 8. Risques connus

| Risque | Mitigation |
|--------|------------|
| Hallucination LLM sur l'ID client (matching nom flou) | Seuil de confiance + validation humaine en dessous + few-shot avec liste clients |
| Coûts Foundry qui dérapent | Quota TPM sur le déploiement + alertes Cost Management |
| RGPD (docs perso scannés) | Région EU + chiffrement at rest + audit log Cosmos + droits RBAC stricts |
| Scans illisibles | Re-route vers `_inbox/` + UI de re-scan |
| Faux positif catégorie | UI admin de re-classification rapide |
