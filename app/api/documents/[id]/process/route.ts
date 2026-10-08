import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
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

    await db
      .update(documents)
      .set({ status: "queued", statusDetail: "Enqueued for analysis", progress: 5 })
      .where(eq(documents.id, id));

    // Send Inngest event
    await inngest.send({
      name: "document/uploaded",
      data: {
        documentId: id,
      },
    });

    return NextResponse.json({ success: true, status: "queued" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to trigger processing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
