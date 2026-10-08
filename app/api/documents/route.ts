import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const docList = await db
      .select({
        id: documents.id,
        name: documents.name,
        mime: documents.mime,
        sizeBytes: documents.sizeBytes,
        status: documents.status,
        statusDetail: documents.statusDetail,
        progress: documents.progress,
        errorCode: documents.errorCode,
        errorMessage: documents.errorMessage,
        pageCount: documents.pageCount,
        charCount: documents.charCount,
        emptyPageCount: documents.emptyPageCount,
        lang: documents.lang,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .orderBy(desc(documents.createdAt));

    return NextResponse.json(docList);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
