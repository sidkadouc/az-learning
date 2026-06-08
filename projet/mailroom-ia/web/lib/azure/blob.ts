import { BlobServiceClient } from "@azure/storage-blob";
import { QueueServiceClient } from "@azure/storage-queue";
import { getCredential, requireEnv } from "./credential";
import type { QueueMessage } from "@/lib/types/domain";

function blobService(): BlobServiceClient {
  return new BlobServiceClient(requireEnv("STORAGE_BLOB_URL"), getCredential());
}

function container() {
  return blobService().getContainerClient(requireEnv("STORAGE_CONTAINER"));
}

export async function uploadInboxBlob(
  blobName: string,
  data: Buffer,
  contentType: string,
  metadata: Record<string, string>,
): Promise<void> {
  const blob = container().getBlockBlobClient(blobName);
  await blob.uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType },
    metadata,
  });
}

/**
 * Renvoie une arborescence textuelle façon `tree` pour debug admin.
 * À remplacer par un vrai composant explorateur côté UI quand on aura besoin.
 */
export async function listBlobsAsTree(prefix: string): Promise<string> {
  const cli = container();
  const paths = new Set<string>();
  for await (const blob of cli.listBlobsFlat({ prefix })) {
    paths.add(blob.name);
  }
  if (paths.size === 0) return `${prefix} (vide)`;
  return Array.from(paths).sort().join("\n");
}

let queueClient: ReturnType<QueueServiceClient["getQueueClient"]> | null = null;

function getQueue() {
  if (!queueClient) {
    const svc = new QueueServiceClient(requireEnv("STORAGE_QUEUE_URL"), getCredential());
    queueClient = svc.getQueueClient(requireEnv("STORAGE_QUEUE_NAME"));
  }
  return queueClient;
}

export async function sendQueueMessage(msg: QueueMessage): Promise<void> {
  // Storage Queue encode en base64 par défaut côté SDK quand on lui passe un objet ; on encode explicitement pour être safe.
  const encoded = Buffer.from(JSON.stringify(msg), "utf-8").toString("base64");
  await getQueue().sendMessage(encoded);
}
