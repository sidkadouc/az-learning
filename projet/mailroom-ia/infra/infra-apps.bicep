// =====================================================================
// mailroom-ia — Infra apps (passe 2, après build des images)
// =====================================================================
// Déploie : Container App `web` + Container App Job `worker-classify`
// + toutes les Managed Identities et role assignments.
//
// Pré-requis : infra-base.bicep déjà déployé ET images pushées dans l'ACR.
// =====================================================================

targetScope = 'resourceGroup'

@minLength(3)
@maxLength(20)
param userId string
param location string = resourceGroup().location

@description('Région de l ACA Environment (output acaEnvLocation de infra-base). Doit matcher l environnement existant.')
param acaLocation string = location

@description('Tag de l image web déjà pushée dans l ACR.')
param webImageTag string = 'v1'

@description('Tag de l image worker déjà pushée dans l ACR.')
param workerImageTag string = 'v1'

@description('Nom du déploiement modèle Foundry (doit matcher infra-base).')
param foundryModelDeployment string = 'gpt-5-mini'

param tags object = {
  project: 'mailroom-ia'
  managedBy: 'bicep'
  owner: userId
  SecurityControl: 'ignore'
}

// ---------------------------------------------------------------------
// Conventions de nommage (doivent matcher infra-base.bicep)
// ---------------------------------------------------------------------
var cleanId = toLower(replace(userId, '-', ''))
var acrName = 'acrmailroom${cleanId}'
var storageName = 'stmailroom${cleanId}'
var cosmosName = 'cosmos-stage-${userId}'
var foundryName = 'aif-stage-${userId}'
var foundryProjectName = 'mailroom-project'
var acaEnvName = 'aca-stage-${userId}'
var appiName = 'appi-stage-${userId}'
var webAppName = 'web-stage-${userId}'
var workerJobName = 'worker-stage-${userId}'
var blobContainerName = 'mailroom'
var queueName = 'doc-to-classify'
var cosmosDbName = 'mailroom'

// ---------------------------------------------------------------------
// Rôles built-in (data-plane)
// ---------------------------------------------------------------------
var roleBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var roleQueueDataMessageProcessor = '8a0f0c08-91a1-4084-bc3d-661d67233fed'
var roleQueueDataMessageSender = 'c6a89b2d-59bc-44d0-9896-0f6e12d7b80a'
var roleCogServicesOpenAIUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
var roleCogServicesUser = 'a97b65f3-24c7-4388-baec-2e87135dc908'
var roleAcrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// ---------------------------------------------------------------------
// References existantes
// ---------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageName
}
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosName
}
resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: foundryName
}
resource acaEnv 'Microsoft.App/managedEnvironments@2024-10-02-preview' existing = {
  name: acaEnvName
}
resource appi 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appiName
}

var storageSuffix = environment().suffixes.storage

// ---------------------------------------------------------------------
// Identités managées User-Assigned (une par app)
// On utilise UAMI (pas SystemAssigned) car :
//   1. AcrPull doit être granté AVANT la création du Container App
//      (sinon deadlock "Operation expired" : l'app ne peut pas pull
//       tant que le rôle n'existe pas, et le rôle nécessite l'identité).
//   2. Avec plusieurs MI attachées, DefaultAzureCredential
//      ne sait pas laquelle choisir → on passe AZURE_CLIENT_ID en env.
// ---------------------------------------------------------------------
resource webUami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'uami-web-${userId}'
  location: location
  tags: tags
}

resource workerUami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'uami-worker-${userId}'
  location: location
  tags: tags
}

// --- web : AcrPull + Blob Data Contributor + Queue Sender ---
resource webAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webUami.id, roleAcrPull)
  scope: acr
  properties: {
    principalId: webUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
  }
}

resource webBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, webUami.id, roleBlobDataContributor)
  scope: storage
  properties: {
    principalId: webUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobDataContributor)
  }
}

resource webQueueSend 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, webUami.id, roleQueueDataMessageSender)
  scope: storage
  properties: {
    principalId: webUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleQueueDataMessageSender)
  }
}

// --- worker : AcrPull + Blob + Queue Processor + Foundry ---
resource workerAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, workerUami.id, roleAcrPull)
  scope: acr
  properties: {
    principalId: workerUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAcrPull)
  }
}

resource workerBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, workerUami.id, roleBlobDataContributor)
  scope: storage
  properties: {
    principalId: workerUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobDataContributor)
  }
}

resource workerQueueProcess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, workerUami.id, roleQueueDataMessageProcessor)
  scope: storage
  properties: {
    principalId: workerUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleQueueDataMessageProcessor)
  }
}

resource workerFoundryUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, workerUami.id, roleCogServicesOpenAIUser)
  scope: foundry
  properties: {
    principalId: workerUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCogServicesOpenAIUser)
  }
}

resource workerCogUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, workerUami.id, roleCogServicesUser)
  scope: foundry
  properties: {
    principalId: workerUami.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleCogServicesUser)
  }
}

// --- Cosmos DB SQL data-plane RBAC (système séparé d'Azure RBAC) ---
// "Cosmos DB Built-in Data Contributor" : lecture + écriture sur tous les conteneurs SQL.
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource workerCosmosDataRbac 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmos
  name: guid(cosmos.id, workerUami.id, cosmosDataContributorRoleId)
  properties: {
    principalId: workerUami.properties.principalId
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    scope: cosmos.id
  }
}

resource webCosmosDataRbac 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmos
  name: guid(cosmos.id, webUami.id, cosmosDataContributorRoleId)
  properties: {
    principalId: webUami.properties.principalId
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    scope: cosmos.id
  }
}

// ---------------------------------------------------------------------
// Container App : web (même région que l'ACA Environment)
// ---------------------------------------------------------------------
resource web 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: webAppName
  location: acaLocation
  tags: tags
  dependsOn: [ webAcrPull, webBlob, webQueueSend ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webUami.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: acaEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: '${acr.name}.azurecr.io'
          identity: webUami.id
        }
      ]
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${acr.name}.azurecr.io/mailroom-web:${webImageTag}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AZURE_CLIENT_ID', value: webUami.properties.clientId }
            { name: 'STORAGE_BLOB_URL', value: 'https://${storage.name}.blob.${storageSuffix}' }
            { name: 'STORAGE_QUEUE_URL', value: 'https://${storage.name}.queue.${storageSuffix}' }
            { name: 'STORAGE_QUEUE_NAME', value: queueName }
            { name: 'STORAGE_CONTAINER', value: blobContainerName }
            { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
            { name: 'COSMOS_DATABASE', value: cosmosDbName }
            { name: 'COSMOS_CONTAINER_DOCUMENTS', value: 'documents' }
            { name: 'COSMOS_CONTAINER_CLIENTS', value: 'clients' }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appi.properties.ConnectionString }
            { name: 'NODE_ENV', value: 'production' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

// ---------------------------------------------------------------------
// Container App Job : worker-classify (même région que l'ACA Environment)
// ---------------------------------------------------------------------
resource worker 'Microsoft.App/jobs@2024-10-02-preview' = {
  name: workerJobName
  location: acaLocation
  tags: tags
  dependsOn: [ workerAcrPull, workerBlob, workerQueueProcess, workerFoundryUser, workerCogUser ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${workerUami.id}': {}
    }
  }
  properties: {
    environmentId: acaEnv.id
    configuration: {
      triggerType: 'Event'
      replicaTimeout: 600
      replicaRetryLimit: 1
      eventTriggerConfig: {
        replicaCompletionCount: 1
        parallelism: 4
        scale: {
          minExecutions: 0
          maxExecutions: 10
          pollingInterval: 30
          rules: [
            {
              name: 'queue-length'
              type: 'azure-queue'
              metadata: {
                accountName: storage.name
                queueName: queueName
                queueLength: '1'
              }
              identity: workerUami.id
            }
          ]
        }
      }
      registries: [
        {
          server: '${acr.name}.azurecr.io'
          identity: workerUami.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: '${acr.name}.azurecr.io/mailroom-worker:${workerImageTag}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AZURE_CLIENT_ID', value: workerUami.properties.clientId }
            { name: 'STORAGE_BLOB_URL', value: 'https://${storage.name}.blob.${storageSuffix}' }
            { name: 'STORAGE_QUEUE_URL', value: 'https://${storage.name}.queue.${storageSuffix}' }
            { name: 'STORAGE_QUEUE_NAME', value: queueName }
            { name: 'STORAGE_CONTAINER', value: blobContainerName }
            { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
            { name: 'COSMOS_DATABASE', value: cosmosDbName }
            { name: 'COSMOS_CONTAINER_DOCUMENTS', value: 'documents' }
            { name: 'COSMOS_CONTAINER_CLIENTS', value: 'clients' }
            { name: 'DOC_INTELLIGENCE_ENDPOINT', value: 'https://${foundry.name}.cognitiveservices.azure.com/' }
            { name: 'FOUNDRY_PROJECT_ENDPOINT', value: '${foundry.properties.endpoint}api/projects/${foundryProjectName}' }
            { name: 'FOUNDRY_MODEL_DEPLOYMENT', value: foundryModelDeployment }
            { name: 'APPINSIGHTS_CONNECTION_STRING', value: appi.properties.ConnectionString }
            { name: 'SERVICE_NAME', value: 'mailroom-worker' }
            { name: 'CONFIDENCE_THRESHOLD', value: '0.8' }
          ]
        }
      ]
    }
  }
}

// ---------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------
output webFqdn string = web.properties.configuration.ingress.fqdn
output webName string = web.name
output workerJobName string = worker.name
output webIdentityClientId string = webUami.properties.clientId
output workerIdentityClientId string = workerUami.properties.clientId
