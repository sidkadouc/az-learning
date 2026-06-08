import { NextResponse } from "next/server";
import { z } from "zod";
import { CosmosClient } from "@azure/cosmos";
import { getCredential, requireEnv } from "@/lib/azure/credential";
import { listClients } from "@/lib/azure/cosmos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateClientBody = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i, "id: alphanum + _ -"),
  displayName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  entraExternalId: z.string().max(64).optional(),
});

let client: CosmosClient | null = null;
function clientsContainer() {
  client ??= new CosmosClient({
    endpoint: requireEnv("COSMOS_ENDPOINT"),
    aadCredentials: getCredential(),
  });
  return client
    .database(requireEnv("COSMOS_DATABASE"))
    .container(requireEnv("COSMOS_CONTAINER_CLIENTS"));
}

export async function GET() {
  try {
    const data = await listClients(200);
    return NextResponse.json(data);
  } catch (err) {
    console.error("listClients failed", err);
    return NextResponse.json({ error: "cosmos query failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = CreateClientBody.parse(await req.json());
  const record = {
    id: body.id,
    displayName: body.displayName,
    email: body.email,
    entraExternalId: body.entraExternalId,
    createdAt: new Date().toISOString(),
    createdBy: "admin",
  };
  await clientsContainer().items.create(record);
  return NextResponse.json(record, { status: 201 });
}
