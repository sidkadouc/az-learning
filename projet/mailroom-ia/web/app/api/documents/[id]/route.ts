import { NextResponse } from "next/server";
import { deleteDocument, getDocument } from "@/lib/azure/cosmos";
import { deleteBlob } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  await deleteBlob(doc.blobPath).catch(() => undefined);
  await deleteDocument(id, doc.clientId ?? "_unassigned").catch(() => undefined);
  return NextResponse.json({ ok: true });
}
