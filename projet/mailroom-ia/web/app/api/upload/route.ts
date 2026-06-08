import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { uploadInboxBlob, sendQueueMessage } from "@/lib/azure/blob";

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file manquant" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `type non autorisé : ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "fichier trop volumineux (max 25 MiB)" }, { status: 413 });
  }

  const uploadMeta = z
    .object({
      originalName: z.string().min(1).max(256),
      mimeType: z.string().min(3).max(64),
      size: z.number().int().positive(),
    })
    .parse({ originalName: file.name, mimeType: file.type, size: file.size });

  const id = randomUUID();
  const ext = uploadMeta.mimeType === "application/pdf" ? "pdf" : uploadMeta.mimeType.split("/")[1];
  const blobName = `_inbox/${id}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadInboxBlob(blobName, buffer, uploadMeta.mimeType, {
    id,
    originalName: uploadMeta.originalName,
  });
  await sendQueueMessage({ id, blobName, ...uploadMeta });

  return NextResponse.json({ id, blobName });
}
