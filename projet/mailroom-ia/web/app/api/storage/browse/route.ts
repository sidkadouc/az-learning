import { NextResponse } from "next/server";
import { listBlobLevel } from "@/lib/azure/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") ?? "";
  // sécurité minimale : interdit les sauts de répertoire
  if (prefix.includes("..")) {
    return NextResponse.json({ error: "prefix invalide" }, { status: 400 });
  }
  try {
    const entries = await listBlobLevel(prefix);
    return NextResponse.json({ prefix, entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
