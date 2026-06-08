import { NextResponse } from "next/server";
import { z } from "zod";
import { getDocument, upsertDocument, deleteDocument } from "@/lib/azure/cosmos";
import { moveBlob } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ValidateBody = z.object({
  clientId: z.string().min(1).max(64),
  category: z.enum(["factures", "contrats", "avis-officiels", "courriers", "autres"]),
  subCategory: z.string().max(64).optional(),
});

function buildTargetPath(
  clientId: string,
  category: string,
  subCategory: string | undefined,
  originalName: string,
): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const parts = ["clients", clientId, category];
  if (subCategory) parts.push(subCategory);
  parts.push(safeName);
  return parts.join("/");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = ValidateBody.parse(await req.json());
  const oldClientId = doc.clientId ?? "_unassigned";
  const targetBlob = buildTargetPath(body.clientId, body.category, body.subCategory, doc.originalName);

  try {
    await moveBlob(doc.blobPath, targetBlob);
  } catch (err) {
    console.error("moveBlob failed", err);
    return NextResponse.json({ error: "failed to move blob" }, { status: 500 });
  }

  const updated = {
    ...doc,
    clientId: body.clientId,
    blobPath: targetBlob,
    category: body.category,
    subCategory: body.subCategory ?? null,
    classification: {
      ...(doc.classification ?? { model: "manual", confidence: 1, needsReview: false }),
      needsReview: false,
      confidence: 1,
    },
  };

  if (oldClientId !== body.clientId) {
    await deleteDocument(id, oldClientId).catch(() => undefined);
  }
  await upsertDocument(updated);

  return NextResponse.json({ ok: true, blobPath: targetBlob });
}
