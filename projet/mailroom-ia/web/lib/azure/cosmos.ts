import { CosmosClient } from "@azure/cosmos";
import { getCredential, requireEnv } from "./credential";
import type { DocumentRecord } from "@/lib/types/domain";

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

export async function listInboxDocuments(limit = 20): Promise<DocumentRecord[]> {
  const { resources } = await documents()
    .items.query<DocumentRecord>({
      query:
        "SELECT TOP @limit * FROM c WHERE c.classification.needsReview = true ORDER BY c.uploadedAt DESC",
      parameters: [{ name: "@limit", value: limit }],
    })
    .fetchAll();
  return resources;
}
