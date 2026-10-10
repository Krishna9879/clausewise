import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documents, clauses, comparisons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { segmentTextIntoClauses, alignClauses, ClauseSegment } from "@/lib/compare/aligner";
import { analyzeComparison } from "@/lib/compare/analyzer";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { docA: docAId, docB: docBId } = body;

    if (!docAId || !docBId) {
      return NextResponse.json(
        { error: "Both docA and docB document IDs are required" },
        { status: 400 }
      );
    }

    const docA = await db.query.documents.findFirst({
      where: eq(documents.id, docAId),
    });
    const docB = await db.query.documents.findFirst({
      where: eq(documents.id, docBId),
    });

    if (!docA || !docB) {
      return NextResponse.json(
        { error: "One or both documents could not be found" },
        { status: 404 }
      );
    }

    // 1. Fetch stored clauses or segment from canonical text
    const storedClausesA = await db.query.clauses.findMany({
      where: eq(clauses.documentId, docA.id),
      orderBy: (c, { asc }) => [asc(c.charStart)],
    });

    const storedClausesB = await db.query.clauses.findMany({
      where: eq(clauses.documentId, docB.id),
      orderBy: (c, { asc }) => [asc(c.charStart)],
    });

    const segmentsA: ClauseSegment[] =
      storedClausesA.length > 0
        ? storedClausesA.map((c) => ({
            id: c.id,
            number: c.number,
            heading: c.heading,
            text: c.text,
            charStart: c.charStart,
            charEnd: c.charEnd,
          }))
        : segmentTextIntoClauses(docA.text || "");

    const segmentsB: ClauseSegment[] =
      storedClausesB.length > 0
        ? storedClausesB.map((c) => ({
            id: c.id,
            number: c.number,
            heading: c.heading,
            text: c.text,
            charStart: c.charStart,
            charEnd: c.charEnd,
          }))
        : segmentTextIntoClauses(docB.text || "");

    // 2. Align clauses
    const alignedPairs = alignClauses(segmentsA, segmentsB);

    // 3. Analyze differences
    const report = await analyzeComparison(
      { id: docA.id, name: docA.name },
      { id: docB.id, name: docB.name },
      alignedPairs
    );

    // 4. Save in comparisons table
    const [savedComparison] = await db
      .insert(comparisons)
      .values({
        docA: docA.id,
        docB: docB.id,
        status: "ready",
        progress: 100,
        summary: report.executiveSummary.join("\n"),
        result: report,
      })
      .returning();

    return NextResponse.json({
      comparisonId: savedComparison.id,
      report,
    });
  } catch (err: unknown) {
    console.error("Comparison error:", err);
    const message = err instanceof Error ? err.message : "Comparison failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allComparisons = await db.query.comparisons.findMany({
      orderBy: (c, { desc }) => [desc(c.createdAt)],
      limit: 20,
    });
    return NextResponse.json(allComparisons);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load comparisons";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
