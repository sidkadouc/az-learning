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

export interface BrowseEntry {
  type: "folder" | "blob";
  name: string;            // dernier segment (sans le préfixe)
  fullPath: string;        // chemin complet dans le container (= blob name pour les blobs, préfixe avec / final pour les folders)
  size?: number;
  modified?: string;
  contentType?: string;
}

/**
 * Liste UN niveau de l'arborescence du container à partir d'un préfixe donné.
 * Utilise listBlobsByHierarchy avec le délimiteur "/" → renvoie folders + blobs.
 * Ex: prefix="clients/client42/" renvoie ["factures/", "contrats/", ...] (folders)
 * et les blobs directement à ce niveau.
 */
export async function listBlobLevel(prefix: string): Promise<BrowseEntry[]> {
  const cli = container();
  const entries: BrowseEntry[] = [];
  for await (const item of cli.listBlobsByHierarchy("/", { prefix })) {
    if (item.kind === "prefix") {
      const full = item.name; // ex: "clients/client42/factures/"
      const trimmed = full.endsWith("/") ? full.slice(0, -1) : full;
      const last = trimmed.slice(prefix.length);
      entries.push({ type: "folder", name: last, fullPath: full });
    } else {
      const full = item.name;
      const last = full.slice(prefix.length);
      entries.push({
        type: "blob",
        name: last,
        fullPath: full,
        size: item.properties.contentLength ?? 0,
        modified: item.properties.lastModified?.toISOString(),
        contentType: item.properties.contentType ?? undefined,
      });
    }
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

/**
 * Renvoie une arborescence textuelle façon `tree` pour debug admin.
 * Indenté pour être lisible. Préfixe vide = racine du container.
 */
export async function listBlobsAsTree(prefix: string): Promise<string> {
  const cli = container();
  const paths: { name: string; size: number; modified?: Date }[] = [];
  for await (const blob of cli.listBlobsFlat({ prefix })) {
    paths.push({
      name: blob.name,
      size: blob.properties.contentLength ?? 0,
      modified: blob.properties.lastModified,
    });
  }
  if (paths.length === 0) return `${prefix || "/"} (vide)`;
  paths.sort((a, b) => a.name.localeCompare(b.name));
  return paths
    .map((p) => {
      const kb = (p.size / 1024).toFixed(1);
      const when = p.modified ? p.modified.toISOString().slice(0, 19).replace("T", " ") : "";
      return `${p.name}  (${kb} KB, ${when})`;
    })
    .join("\n");
}

export async function downloadBlobBuffer(blobName: string): Promise<{ data: Buffer; contentType: string }> {
  const blob = container().getBlobClient(blobName);
  const dl = await blob.download();
  const props = await blob.getProperties();
  const data = await streamToBuffer(dl.readableStreamBody as NodeJS.ReadableStream);
  return { data, contentType: props.contentType ?? "application/octet-stream" };
}

async function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

/**
 * Déplace un blob (copy + delete). Le copy server-side ne supporte que les blobs
 * accessibles via URL publique ou avec SAS — ici on télécharge puis re-upload (POC).
 */
export async function moveBlob(sourceName: string, destinationName: string): Promise<void> {
  if (sourceName === destinationName) return;
  const cli = container();
  const src = cli.getBlobClient(sourceName);
  const dl = await src.download();
  const props = await src.getProperties();
  const buf = await streamToBuffer(dl.readableStreamBody as NodeJS.ReadableStream);
  const dst = cli.getBlockBlobClient(destinationName);
  await dst.uploadData(buf, {
    blobHTTPHeaders: { blobContentType: props.contentType ?? "application/octet-stream" },
    metadata: props.metadata,
  });
  await src.delete();
}

export async function deleteBlob(blobName: string): Promise<void> {
  await container().getBlobClient(blobName).deleteIfExists();
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
