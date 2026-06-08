import { NextResponse } from "next/server";
import { z } from "zod";
import { CosmosClient } from "@azure/cosmos";
import { getCredential, requireEnv } from "@/lib/azure/credential";
import { moveBlob } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  sourceId: z.string().min(1).max(64),
  targetId: z.string().min(1).max(64),
});

let cli: CosmosClient | null = null;
function cosmos(): CosmosClient {
  cli ??= new CosmosClient({
    endpoint: requireEnv("COSMOS_ENDPOINT"),
    aadCredentials: getCredential(),
  });
  return cli;
}

function db() { return cosmos().database(requireEnv("COSMOS_DATABASE")); }
function docs() { return db().container(requireEnv("COSMOS_CONTAINER_DOCUMENTS")); }
function clientsCt() { return db().container(requireEnv("COSMOS_CONTAINER_CLIENTS")); }

/**
 * POST /api/clients/merge { sourceId, targetId }
 * - Vérifie que les 2 clients existent.
 * - Réassigne chaque document du sourceId vers le targetId :
 *     - met à jour clientId + blobPath (clients/<source>/... → clients/<target>/...)
 *     - déplace le blob correspondant
 *     - supprime l'ancien item Cosmos (partition différente)
 * - Supprime le client source.
 */
export async function POST(req: Request) {
  const { sourceId, targetId } = Body.parse(await req.json());
  if (sourceId === targetId) {
    return NextResponse.json({ error: "source et target identiques" }, { status: 400 });
  }

  // 1. Vérifier que les 2 clients existent
  try {
    await clientsCt().item(sourceId, sourceId).read();
  } catch {
    return NextResponse.json({ error: `client source '${sourceId}' introuvable` }, { status: 404 });
  }
  try {
    await clientsCt().item(targetId, targetId).read();
  } catch {
    return NextResponse.json({ error: `client target '${targetId}' introuvable` }, { status: 404 });
  }

  // 2. Lister tous les docs du source
  const { resources: sourceDocs } = await docs().items.query<{
    id: string;
    clientId: string;
    blobPath: string;
    [k: string]: unknown;
  }>({
    query: "SELECT * FROM c WHERE c.clientId = @cid",
    parameters: [{ name: "@cid", value: sourceId }],
  }).fetchAll();

  let moved = 0;
  const errors: string[] = [];

  // 3. Pour chaque doc : move blob + recreate item dans nouvelle partition + delete ancien
  for (const d of sourceDocs) {
    const oldBlob = d.blobPath;
    const newBlob = typeof oldBlob === "string" && oldBlob.startsWith(`clients/${sourceId}/`)
      ? `clients/${targetId}/` + oldBlob.slice(`clients/${sourceId}/`.length)
      : oldBlob;

    try {
      if (typeof newBlob === "string" && newBlob !== oldBlob) {
        await moveBlob(oldBlob, newBlob);
      }
      const updated = { ...d, clientId: targetId, blobPath: newBlob };
      await docs().items.upsert(updated);
      // Cosmos requiert delete par (id, partitionKey) — la PK actuelle (avant upsert) est sourceId
      await docs().item(d.id, sourceId).delete().catch(() => undefined);
      moved += 1;
    } catch (err) {
      errors.push(`doc ${d.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Supprimer le client source si pas d'erreurs
  if (errors.length === 0) {
    await clientsCt().item(sourceId, sourceId).delete().catch(() => undefined);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    moved,
    sourceDeleted: errors.length === 0,
    errors,
  });
}
