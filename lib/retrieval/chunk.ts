import { PageOffset } from "@/lib/text/locate";
import { ParsedClause } from "@/lib/extract/clause-parse";

export interface DocumentChunk {
  idx: number;
  pageStart: number;
  pageEnd: number;
  sectionLabel?: string;
  charStart: number;
  charEnd: number;
  text: string;
  tokenCount: number;
}

function findPage(charOffset: number, pages: PageOffset[]): number {
  for (const p of pages) {
    if (charOffset >= p.start && charOffset <= p.end) {
      return p.n;
    }
  }
  return 1;
}

/**
 * Splits document text into clause-aware chunks (~600–900 tokens / 2400-3600 chars, with overlap).
 * Conforms to PLAN.md Section 5.
 */
export function chunkDocument(
  text: string,
  pages: PageOffset[],
  clauses: ParsedClause[]
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const targetChars = 2800; // ~700 tokens
  const overlapChars = 400; // ~100 tokens

  if (!clauses || clauses.length === 0) {
    // Fallback: chunk by paragraph
    let start = 0;
    let idx = 0;

    while (start < text.length) {
      let end = Math.min(start + targetChars, text.length);

      // Avoid splitting mid-sentence
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf(". ", end);
        if (sentenceEnd > start + targetChars / 2) {
          end = sentenceEnd + 1;
        }
      }

      const chunkText = text.slice(start, end).trim();
      const pageStart = findPage(start, pages);
      const pageEnd = findPage(end, pages);

      chunks.push({
        idx,
        pageStart,
        pageEnd,
        sectionLabel: `Section ${idx + 1}`,
        charStart: start,
        charEnd: end,
        text: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4),
      });

      idx++;
      start = end - overlapChars;
      if (start >= text.length || start < 0) break;
    }

    return chunks;
  }

  // Clause-aware chunking
  let idx = 0;
  for (const clause of clauses) {
    if (clause.text.length <= targetChars) {
      const pageStart = findPage(clause.charStart, pages);
      const pageEnd = findPage(clause.charEnd, pages);

      chunks.push({
        idx: idx++,
        pageStart,
        pageEnd,
        sectionLabel: `${clause.number ?? ""} ${clause.heading ?? ""}`.trim() || undefined,
        charStart: clause.charStart,
        charEnd: clause.charEnd,
        text: clause.text,
        tokenCount: Math.ceil(clause.text.length / 4),
      });
    } else {
      // Split large clause into multiple subchunks
      let subStart = clause.charStart;
      let part = 1;
      while (subStart < clause.charEnd) {
        let subEnd = Math.min(subStart + targetChars, clause.charEnd);
        if (subEnd < clause.charEnd) {
          const sentenceEnd = text.lastIndexOf(". ", subEnd);
          if (sentenceEnd > subStart + targetChars / 2) {
            subEnd = sentenceEnd + 1;
          }
        }

        const chunkText = text.slice(subStart, subEnd).trim();
        const pageStart = findPage(subStart, pages);
        const pageEnd = findPage(subEnd, pages);

        chunks.push({
          idx: idx++,
          pageStart,
          pageEnd,
          sectionLabel: `${clause.number ?? ""} ${clause.heading ?? ""} (Part ${part++})`.trim(),
          charStart: subStart,
          charEnd: subEnd,
          text: chunkText,
          tokenCount: Math.ceil(chunkText.length / 4),
        });

        subStart = subEnd - overlapChars;
        if (subStart >= clause.charEnd) break;
      }
    }
  }

  return chunks;
}
