import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.storage.from(env.SUPABASE_BUCKET).download(doc.storagePath);

    if (error || !data) {
      return NextResponse.json({ error: "Failed to download file from storage" }, { status: 500 });
    }

    const arrayBuffer = await data.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": doc.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
