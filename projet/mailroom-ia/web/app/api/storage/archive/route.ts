import { NextResponse } from "next/server";
import { z } from "zod";
import { moveBlob } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  path: z.string().min(1).max(1024),
});

/**
 * POST /api/storage/archive  { path }
 * Déplace un blob sous `archives/<original-path>` (idempotent — écrase si existe déjà).
 * Si déjà sous `archives/`, no-op.
 */
export async function POST(req: Request) {
  const { path } = Body.parse(await req.json());
  if (path.includes("..")) {
    return NextResponse.json({ error: "path invalide" }, { status: 400 });
  }
  if (path.startsWith("archives/")) {
    return NextResponse.json({ ok: true, alreadyArchived: true, path });
  }
  const dest = `archives/${path}`;
  try {
    await moveBlob(path, dest);
    return NextResponse.json({ ok: true, from: path, to: dest });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
