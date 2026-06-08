import { NextResponse } from "next/server";
import { getDocument } from "@/lib/azure/cosmos";
import { downloadBlobBuffer } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "document not found" }, { status: 404 });
  }
  try {
    const { data, contentType } = await downloadBlobBuffer(doc.blobPath);
    return new NextResponse(data as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${doc.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("download blob failed", err);
    return NextResponse.json({ error: "blob not accessible" }, { status: 500 });
  }
}
