import { NextResponse } from "next/server";
import { CosmosClient } from "@azure/cosmos";
import { getCredential, requireEnv } from "@/lib/azure/credential";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let client: CosmosClient | null = null;
function clientsCt() {
  client ??= new CosmosClient({
    endpoint: requireEnv("COSMOS_ENDPOINT"),
    aadCredentials: getCredential(),
  });
  return client
    .database(requireEnv("COSMOS_DATABASE"))
    .container(requireEnv("COSMOS_CONTAINER_CLIENTS"));
}

function docsCt() {
  client ??= new CosmosClient({
    endpoint: requireEnv("COSMOS_ENDPOINT"),
    aadCredentials: getCredential(),
  });
  return client
    .database(requireEnv("COSMOS_DATABASE"))
    .container(requireEnv("COSMOS_CONTAINER_DOCUMENTS"));
}

/**
 * DELETE /api/clients/[id]
 * Refuse si le client a encore des documents associés (force=true pour bypass).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  // Compter les docs associés
  const { resources } = await docsCt().items.query<{ id: string }>({
    query: "SELECT VALUE COUNT(1) FROM c WHERE c.clientId = @cid",
    parameters: [{ name: "@cid", value: id }],
  }).fetchAll();
  const count = (resources[0] as unknown as number) ?? 0;

  if (count > 0 && !force) {
    return NextResponse.json(
      { error: `${count} document(s) encore associé(s). Fusionne d'abord, ou utilise force=true.`, docCount: count },
      { status: 409 },
    );
  }

  try {
    await clientsCt().item(id, id).delete();
    return NextResponse.json({ ok: true, deleted: id, docCount: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
