import { CosmosClient } from "@azure/cosmos";
import { getCredential, requireEnv } from "./credential";
import type { ClientRecord, DocumentRecord } from "@/lib/types/domain";

let client: CosmosClient | null = null;

function getCosmos(): CosmosClient {
  client ??= new CosmosClient({
    endpoint: requireEnv("COSMOS_ENDPOINT"),
    aadCredentials: getCredential(),
  });
  return client;
}

function documents() {
  return getCosmos()
    .database(requireEnv("COSMOS_DATABASE"))
    .container(requireEnv("COSMOS_CONTAINER_DOCUMENTS"));
}

function clients() {
  return getCosmos()
    .database(requireEnv("COSMOS_DATABASE"))
    .container(requireEnv("COSMOS_CONTAINER_CLIENTS"));
}

export async function listInboxDocuments(limit = 50): Promise<DocumentRecord[]> {
  const { resources } = await documents()
    .items.query<DocumentRecord>({
      query:
        "SELECT TOP @limit * FROM c WHERE c.classification.needsReview = true ORDER BY c.uploadedAt DESC",
      parameters: [{ name: "@limit", value: limit }],
    })
    .fetchAll();
  return resources;
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  // We don't know the partition key (clientId) upfront — query by id.
  const { resources } = await documents()
    .items.query<DocumentRecord>({
      query: "SELECT TOP 1 * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

/** Replaces the document (must include the partition key field `clientId`). */
export async function upsertDocument(doc: DocumentRecord): Promise<void> {
  await documents().items.upsert(doc);
}

export async function deleteDocument(id: string, partitionKey: string): Promise<void> {
  await documents().item(id, partitionKey).delete();
}

export async function listClients(limit = 200): Promise<ClientRecord[]> {
  const { resources } = await clients()
    .items.query<ClientRecord>({
      query: "SELECT TOP @limit * FROM c ORDER BY c.displayName",
      parameters: [{ name: "@limit", value: limit }],
    })
    .fetchAll();
  return resources;
}
