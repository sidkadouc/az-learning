import { NextResponse } from "next/server";
import { deleteBlob, downloadBlobBuffer } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function inferContentType(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "txt": return "text/plain; charset=utf-8";
    case "json": return "application/json";
    case "csv": return "text/csv; charset=utf-8";
    case "html":
    case "htm": return "text/html; charset=utf-8";
    default: return "application/octet-stream";
  }
}

/**
 * GET /api/storage/file?path=<blobName>
 * Stream un blob (preview) — utilisé par l'explorateur storage.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "path invalide" }, { status: 400 });
  }
  try {
    const { data, contentType } = await downloadBlobBuffer(path);
    const filename = path.split("/").pop() ?? "file";
    // Si le blob n'a pas de contentType, ou que c'est le generic octet-stream, on
    // infère depuis l'extension pour que le navigateur fasse un inline preview.
    const effectiveContentType =
      contentType && contentType !== "application/octet-stream"
        ? contentType
        : inferContentType(path);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": effectiveContentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 },
    );
  }
}

/**
 * DELETE /api/storage/file?path=<blobName>
 * Supprime un blob du conteneur. Ne touche pas Cosmos.
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "path invalide" }, { status: 400 });
  }
  try {
    await deleteBlob(path);
    return NextResponse.json({ ok: true, deleted: path });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

