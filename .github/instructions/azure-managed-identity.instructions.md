---
description: Sécurité service-à-service Azure — Managed Identity, RBAC moindre privilège, Key Vault, secrets, Bicep sécurisé.
applyTo: "**/*.{bicep,ts,py,tsx}"
---

# Sécurité Azure service-à-service — règles

## Principe directeur

**Aucune clé / aucun secret long-lived dans le code, les `.env`, les app settings ou le repo Git.** L'authentification entre services Azure passe **toujours** par **Managed Identity** (préférer **System-Assigned** pour le couplage 1:1, **User-Assigned** pour le partage d'identité entre plusieurs ressources).

## Managed Identity — règles d'usage

### Préférences
1. **System-Assigned MI** quand l'identité est liée au cycle de vie d'une seule ressource (1 Container App = 1 MI).
2. **User-Assigned MI** quand plusieurs ressources doivent partager la même identité (ex. 3 Container Apps qui accèdent au même Key Vault avec les mêmes droits).
3. **Workload Identity (federated credentials)** côté ACA pour KEDA et pull d'image ACR.

### À faire systématiquement
- Activer la MI au moment de la création de la ressource (Bicep `identity: { type: 'SystemAssigned' }`).
- Donner les rôles RBAC **au scope le plus fin possible** (la ressource cible, pas le RG, encore moins l'abonnement).
- Utiliser les rôles **built-in data-plane** (`Storage Blob Data Reader`, `Key Vault Secrets User`, `Cognitive Services OpenAI User`) — jamais `Contributor` ou `Owner` pour de l'accès applicatif.
- Côté code Python : `DefaultAzureCredential()` exclusivement. Ce credential détecte MI / `az login` / env vars automatiquement.
- Côté code TS : `new DefaultAzureCredential()` de `@azure/identity`.

### À ne JAMAIS faire
- ❌ Clés d'accès Storage / Cosmos / Foundry dans une app setting ou un secret Key Vault.
- ❌ Connection strings avec `AccountKey=` ou `SharedAccessSignature=`.
- ❌ Service Principal avec secret/certificat pour du service-à-service intra-tenant (utiliser MI).
- ❌ MI au scope `subscription` (rétrograde, scope au RG ou ressource).

## Mapping ressource → rôle minimum (pour ce repo)

| Service appelant | Service cible | Rôle RBAC built-in |
|------------------|---------------|---------------------|
| `web` Container App | Blob Storage (`clients/...`) | `Storage Blob Data Contributor` |
| `web` Container App | Cosmos DB (data plane) | `Cosmos DB Built-in Data Contributor` (data-plane RBAC) |
| `web` Container App | Foundry (modèles + agents) | `Cognitive Services OpenAI User` + `Azure AI Project User` |
| `web` Container App | Key Vault (lecture secrets externes) | `Key Vault Secrets User` |
| `worker-classify` Job | Storage Queue | `Storage Queue Data Message Processor` |
| `worker-classify` Job | Blob Storage | `Storage Blob Data Contributor` |
| `worker-classify` Job | Cosmos DB | `Cosmos DB Built-in Data Contributor` |
| `worker-classify` Job | Document Intelligence | `Cognitive Services User` |
| `worker-classify` Job | Foundry | `Cognitive Services OpenAI User` |
| ACA Environment | ACR (pull image) | `AcrPull` |

## Key Vault — quand on a vraiment besoin d'un secret

Cas légitimes : clé d'API d'un service **tiers** (non-Azure, ex. provider SMS, Stripe, etc.).

Règles :
1. Stocker dans Key Vault (jamais en app setting).
2. **Référencer** depuis l'app : `@Microsoft.KeyVault(SecretUri=https://...)` côté App Service, ou monter en volume secret côté ACA.
3. Activer **soft-delete** + **purge protection** systématiquement.
4. **Rotation** : configurer une rotation auto (90 jours max recommandé).
5. RBAC, pas access policies (le mode RBAC est plus auditable).

## Bicep — patterns sécurisés

```bicep
// ✅ Managed Identity sur le Container App
resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'web-stage-${userId}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: { /* ... */ }
}

// ✅ Role assignment au scope de la ressource cible, pas du RG
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, web.id, 'StorageBlobDataContributor')
  scope: storage
  properties: {
    principalId: web.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'ba92f5b4-2d11-453d-a403-e96b0029c9fe'  // Storage Blob Data Contributor
    )
  }
}
```

### ❌ Anti-patterns Bicep
- Variables `@secure() param storageKey string` — la clé n'a rien à faire ici, utiliser MI.
- `outputs` qui exposent des secrets ou des connection strings.
- Role assignment au scope `resourceGroup()` quand un scope ressource suffit.

## HTTPS / TLS
- HTTPS **obligatoire** sur tous les ingress Container Apps (par défaut chez ACA).
- TLS **1.2 minimum**, idéalement 1.3.
- `HSTS` activé côté Next.js (`next.config.js → headers()`).

## CORS
- Côté BFF : whitelist explicite des origines, pas de `*` en production.
- Préférer les Server Actions / Route Handlers même-origine.

## Inputs & injection
- **Toute** entrée externe validée avec **Zod** (TS) ou **Pydantic** (Python) avant utilisation.
- Pour les requêtes Cosmos : utiliser les **paramètres** (`@param`), jamais de string concatenation.
- Pour les LLM : si on injecte du contenu utilisateur dans un prompt, activer **Prompt Shields** côté Foundry (cf. ADR/DESIGN classification).

## Logs & secrets
- **Jamais** logger un token, une clé, un mot de passe, un PII non-masqué.
- Application Insights + Log Analytics activés au niveau ACA Environment, scrubbing des PII activé.
- Audit Activity Log conservé ≥ 90 jours.

## Checklist de revue

Avant de merger un changement qui touche à de l'auth/security Azure, vérifier :

- [ ] Aucune nouvelle clé ou secret en clair
- [ ] Toute identité créée a un rôle RBAC au scope minimal
- [ ] Le rôle choisi est un rôle **data-plane** quand possible, pas un rôle de management
- [ ] HTTPS only / TLS 1.2+ sur l'ingress
- [ ] Inputs validés côté serveur
- [ ] Pas de log de secret
