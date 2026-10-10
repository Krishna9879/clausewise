import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { comparisons, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comp = await db.query.comparisons.findFirst({
      where: eq(comparisons.id, id),
    });

    if (!comp) {
      return NextResponse.json({ error: "Comparison not found" }, { status: 404 });
    }

    const docA = await db.query.documents.findFirst({
      where: eq(documents.id, comp.docA),
    });
    const docB = await db.query.documents.findFirst({
      where: eq(documents.id, comp.docB),
    });

    return NextResponse.json({
      ...comp,
      documentA: docA ? { id: docA.id, name: docA.name } : null,
      documentB: docB ? { id: docB.id, name: docB.name } : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch comparison";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
