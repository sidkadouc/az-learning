// =====================================================================
// mailroom-ia — Infra base (passe 1, avant build des images)
// =====================================================================
// Déploie : Log Analytics, App Insights, ACR, Storage (Blob+Queue),
// Cosmos DB, Foundry (AIServices) + projet + déploiement modèle,
// ACA Environment.
//
// PASSE 1 : on déploie ceci, puis on build/push les images dans l'ACR
//          créé ici, puis on lance infra-apps.bicep.
// =====================================================================

targetScope = 'resourceGroup'

@description('Identifiant utilisateur, suffixe -stage-<id> extrait du nom du RG.')
@minLength(3)
@maxLength(20)
param userId string

@description('Région des ressources (par défaut : celle du RG).')
param location string = resourceGroup().location

@description('Région spécifique pour ACA Environment. Override possible si la région du RG est en capacity error (ManagedEnvironmentCapacityHeavyUsageError). Par défaut : la même que location.')
param acaLocation string = location

@description('Région spécifique pour Cosmos DB. Override possible si la région du RG est en capacity error (ServiceUnavailable). Par défaut : la même que location.')
param cosmosLocation string = location

@description('Nom du déploiement modèle dans Foundry.')
param foundryModelDeployment string = 'gpt-5-mini'

@description('Version du modèle Foundry.')
param foundryModelVersion string = '2025-08-07'

@description('Tags appliqués à toutes les ressources.')
param tags object = {
  project: 'mailroom-ia'
  managedBy: 'bicep'
  owner: userId
  // Exempte la ressource de la policy tenant qui force publicNetworkAccess=Disabled
  // sur les services de données. Workshop env, pas de VNet ni private endpoint.
  SecurityControl: 'ignore'
}

// ---------------------------------------------------------------------
// Conventions de nommage
// ---------------------------------------------------------------------
var cleanId = toLower(replace(userId, '-', ''))
var acrName = 'acrmailroom${cleanId}'
var lawName = 'law-stage-${userId}'
var appiName = 'appi-stage-${userId}'
var storageName = 'stmailroom${cleanId}'
var cosmosName = 'cosmos-stage-${userId}'
var foundryName = 'aif-stage-${userId}'
var foundryProjectName = 'mailroom-project'
var acaEnvName = 'aca-stage-${userId}'

var blobContainerName = 'mailroom'
var queueName = 'doc-to-classify'
var cosmosDbName = 'mailroom'

// ---------------------------------------------------------------------
// Log Analytics + Application Insights
// ---------------------------------------------------------------------
resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: appiName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
    IngestionMode: 'LogAnalytics'
  }
}

// ---------------------------------------------------------------------
// Azure Container Registry (Basic)
// ---------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// ---------------------------------------------------------------------
// Storage Account (Blob + Queue)
// ---------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: storageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    supportsHttpsTrafficOnly: true
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storage
  name: 'default'
}

resource mailroomContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobServices
  name: blobContainerName
  properties: { publicAccess: 'None' }
}

resource queueServices 'Microsoft.Storage/storageAccounts/queueServices@2024-01-01' = {
  parent: storage
  name: 'default'
}

resource docQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2024-01-01' = {
  parent: queueServices
  name: queueName
}

// ---------------------------------------------------------------------
// Cosmos DB (Serverless)
// ---------------------------------------------------------------------
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: cosmosName
  location: cosmosLocation
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      // isZoneRedundant: false → évite ServiceUnavailable quand la région
      // n'a plus de capacité zonale (cas West Europe en 2026).
      { locationName: cosmosLocation, failoverPriority: 0, isZoneRedundant: false }
    ]
    capabilities: [
      { name: 'EnableServerless' }
    ]
    disableLocalAuth: false
    minimalTlsVersion: 'Tls12'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmos
  name: cosmosDbName
  properties: { resource: { id: cosmosDbName } }
}

resource documentsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDb
  name: 'documents'
  properties: {
    resource: {
      id: 'documents'
      partitionKey: { paths: ['/clientId'], kind: 'Hash' }
      indexingPolicy: { indexingMode: 'consistent' }
    }
  }
}

resource clientsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDb
  name: 'clients'
  properties: {
    resource: {
      id: 'clients'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

// ---------------------------------------------------------------------
// Microsoft Foundry (AIServices) — note : projet créé via az cli ensuite
// car la ressource projects nécessite une API preview pas toujours dispo.
// ---------------------------------------------------------------------
resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: foundryName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: foundryName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: foundry
  name: foundryModelDeployment
  sku: { name: 'GlobalStandard', capacity: 50 }
  properties: {
    model: {
      format: 'OpenAI'
      name: foundryModelDeployment
      version: foundryModelVersion
    }
    raiPolicyName: 'Microsoft.DefaultV2'
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

// ---------------------------------------------------------------------
// ACA Environment
// ---------------------------------------------------------------------
resource acaEnv 'Microsoft.App/managedEnvironments@2024-10-02-preview' = {
  name: acaEnvName
  location: acaLocation
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

// ---------------------------------------------------------------------
// Outputs (consommés par infra-apps.bicep + setup.ipynb)
// ---------------------------------------------------------------------
output acrLoginServer string = '${acr.name}.azurecr.io'
output acrName string = acr.name
output storageAccountName string = storage.name
output blobContainerName string = blobContainerName
output queueName string = queueName
output cosmosName string = cosmos.name
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output cosmosDatabase string = cosmosDbName
output foundryName string = foundry.name
output foundryEndpoint string = foundry.properties.endpoint
output foundryProjectName string = foundryProjectName
output foundryModelDeployment string = foundryModelDeployment
output appInsightsConnectionString string = appi.properties.ConnectionString
output acaEnvId string = acaEnv.id
output acaEnvName string = acaEnv.name
output acaEnvLocation string = acaEnv.location
output logAnalyticsCustomerId string = law.properties.customerId
