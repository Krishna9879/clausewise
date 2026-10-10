import { db } from "@/lib/db/client";
import { chunks } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import { getEmbeddings } from "@/lib/ai/embeddings";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  idx: number;
  pageStart: number;
  pageEnd: number;
  sectionLabel: string | null;
  text: string;
  score: number;
}

/**
 * Hybrid retrieval combining pgvector cosine similarity and PostgreSQL full-text search with RRF.
 * Conforms to PLAN.md Section 8.
 */
export async function hybridRetrieve(
  documentIds: string[],
  query: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // 1. Generate query embedding
  const [queryEmbedding] = await getEmbeddings([query]);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // 2. Vector search using pgvector cosine distance <=>
  const vectorResults = await db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      idx: chunks.idx,
      pageStart: chunks.pageStart,
      pageEnd: chunks.pageEnd,
      sectionLabel: chunks.sectionLabel,
      text: chunks.text,
      distance: sql<number>`${chunks.embedding} <=> ${vectorStr}::vector`,
    })
    .from(chunks)
    .where(inArray(chunks.documentId, documentIds))
    .orderBy(sql`${chunks.embedding} <=> ${vectorStr}::vector`)
    .limit(topK * 2);

  // 3. PostgreSQL text search
  const textResults = await db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      idx: chunks.idx,
      pageStart: chunks.pageStart,
      pageEnd: chunks.pageEnd,
      sectionLabel: chunks.sectionLabel,
      text: chunks.text,
      rank: sql<number>`ts_rank_cd(to_tsvector('english', ${chunks.text}), plainto_tsquery('english', ${query}))`,
    })
    .from(chunks)
    .where(inArray(chunks.documentId, documentIds))
    .orderBy(sql`ts_rank_cd(to_tsvector('english', ${chunks.text}), plainto_tsquery('english', ${query})) DESC`)
    .limit(topK * 2);

  // 4. Reciprocal Rank Fusion (RRF)
  const rrfConstant = 60;
  const scoreMap = new Map<
    string,
    {
      chunk: {
        id: string;
        documentId: string;
        idx: number;
        pageStart: number;
        pageEnd: number;
        sectionLabel: string | null;
        text: string;
      };
      score: number;
    }
  >();

  vectorResults.forEach((item, rank) => {
    const score = 1 / (rrfConstant + rank + 1);
    scoreMap.set(item.id, { chunk: item, score });
  });

  textResults.forEach((item, rank) => {
    const rrfScore = 1 / (rrfConstant + rank + 1);
    const existing = scoreMap.get(item.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(item.id, { chunk: item, score: rrfScore });
    }
  });

  if (documentIds.length > 1) {
    // Balanced per-document retrieval so each contract is fairly represented
    const perDocChunks: RetrievedChunk[] = [];
    const perDocLimit = Math.max(4, Math.ceil(topK / documentIds.length));

    for (const docId of documentIds) {
      const docEntries = Array.from(scoreMap.values())
        .filter((entry) => entry.chunk.documentId === docId)
        .sort((a, b) => b.score - a.score)
        .slice(0, perDocLimit);

      docEntries.forEach((entry) => {
        perDocChunks.push({
          id: entry.chunk.id,
          documentId: entry.chunk.documentId,
          idx: entry.chunk.idx,
          pageStart: entry.chunk.pageStart,
          pageEnd: entry.chunk.pageEnd,
          sectionLabel: entry.chunk.sectionLabel,
          text: entry.chunk.text,
          score: entry.score,
        });
      });
    }

    return perDocChunks;
  }

  const sorted = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return sorted.map((entry) => ({
    id: entry.chunk.id,
    documentId: entry.chunk.documentId,
    idx: entry.chunk.idx,
    pageStart: entry.chunk.pageStart,
    pageEnd: entry.chunk.pageEnd,
    sectionLabel: entry.chunk.sectionLabel,
    text: entry.chunk.text,
    score: entry.score,
  }));
}

