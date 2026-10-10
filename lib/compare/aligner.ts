import { normalizeWithMap } from "../text/normalize";

export interface ClauseSegment {
  id?: string;
  number?: string | null;
  heading?: string | null;
  text: string;
  charStart?: number;
  charEnd?: number;
}

export type ChangeType = "unchanged" | "modified" | "added" | "removed" | "moved";

export interface AlignedClausePair {
  type: ChangeType;
  clauseA?: ClauseSegment;
  clauseB?: ClauseSegment;
  similarity: number;
}

const CLAUSE_SPLIT_REGEX = /(?:^|\n\n+)(?=(?:\d+(?:\.\d+)*[.)]?|Article\s+\w+|Section\s+\d+|\([a-z]\)|\([ivx]+\))\s+)/gi;
const CLAUSE_HEADER_REGEX = /^\s*(\d+(?:\.\d+)*[.)]?|Article\s+\w+|Section\s+\d+|\([a-z]\)|\([ivx]+\))(?:\s+([^\n.]+))?/i;

/**
 * Splits plain text into structured clause segments if no parsed clauses exist.
 */
export function segmentTextIntoClauses(text: string): ClauseSegment[] {
  if (!text.trim()) return [];

  const rawBlocks = text.split(CLAUSE_SPLIT_REGEX).map((b) => b.trim()).filter(Boolean);
  if (rawBlocks.length <= 1) {
    // Fallback: split by double newline paragraphs
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20)
      .map((p, i) => ({
        number: `${i + 1}`,
        heading: null,
        text: p,
      }));
  }

  return rawBlocks.map((block, idx) => {
    const match = block.match(CLAUSE_HEADER_REGEX);
    return {
      number: match ? match[1] : `${idx + 1}`,
      heading: match && match[2] ? match[2].trim() : null,
      text: block,
    };
  });
}

/**
 * Calculates word-level Jaccard similarity between two texts.
 */
function calculateJaccardSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(textA.toLowerCase().match(/\b\w+\b/g) || []);
  const wordsB = new Set(textB.toLowerCase().match(/\b\w+\b/g) || []);

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Monotonically aligns clauses from Document A and Document B.
 * Conforms to PLAN.md Section 9.3:
 * 1. Exact match on normalized text -> unchanged
 * 2. Match by clause number + heading similarity
 * 3. Best similarity match with order preservation
 * 4. Leftovers -> removed (only in A) / added (only in B)
 */
export function alignClauses(
  clausesA: ClauseSegment[],
  clausesB: ClauseSegment[]
): AlignedClausePair[] {
  const pairs: AlignedClausePair[] = [];
  const matchedBIndices = new Set<number>();
  const matchedAIndices = new Set<number>();

  // Pass 1: Exact normalized text matches
  for (let i = 0; i < clausesA.length; i++) {
    const normA = normalizeWithMap(clausesA[i].text).norm;
    for (let j = 0; j < clausesB.length; j++) {
      if (matchedBIndices.has(j)) continue;
      const normB = normalizeWithMap(clausesB[j].text).norm;
      if (normA === normB) {
        pairs.push({
          type: i === j ? "unchanged" : "moved",
          clauseA: clausesA[i],
          clauseB: clausesB[j],
          similarity: 1.0,
        });
        matchedAIndices.add(i);
        matchedBIndices.add(j);
        break;
      }
    }
  }

  // Pass 2: Match by clause number + heading similarity
  for (let i = 0; i < clausesA.length; i++) {
    if (matchedAIndices.has(i)) continue;
    const a = clausesA[i];
    if (!a.number) continue;

    for (let j = 0; j < clausesB.length; j++) {
      if (matchedBIndices.has(j)) continue;
      const b = clausesB[j];

      if (a.number.toLowerCase() === b.number?.toLowerCase()) {
        const sim = calculateJaccardSimilarity(a.text, b.text);
        pairs.push({
          type: "modified",
          clauseA: a,
          clauseB: b,
          similarity: sim,
        });
        matchedAIndices.add(i);
        matchedBIndices.add(j);
        break;
      }
    }
  }

  // Pass 3: Remaining high-similarity matches (threshold >= 0.50)
  for (let i = 0; i < clausesA.length; i++) {
    if (matchedAIndices.has(i)) continue;
    const a = clausesA[i];

    let bestSim = 0;
    let bestJ = -1;

    for (let j = 0; j < clausesB.length; j++) {
      if (matchedBIndices.has(j)) continue;
      const sim = calculateJaccardSimilarity(a.text, clausesB[j].text);
      if (sim > bestSim && sim >= 0.5) {
        bestSim = sim;
        bestJ = j;
      }
    }

    if (bestJ !== -1) {
      pairs.push({
        type: i === bestJ ? "modified" : "moved",
        clauseA: a,
        clauseB: clausesB[bestJ],
        similarity: bestSim,
      });
      matchedAIndices.add(i);
      matchedBIndices.add(bestJ);
    }
  }

  // Pass 4: Leftovers in Doc A -> removed
  for (let i = 0; i < clausesA.length; i++) {
    if (!matchedAIndices.has(i)) {
      pairs.push({
        type: "removed",
        clauseA: clausesA[i],
        similarity: 0,
      });
    }
  }

  // Pass 5: Leftovers in Doc B -> added
  for (let j = 0; j < clausesB.length; j++) {
    if (!matchedBIndices.has(j)) {
      pairs.push({
        type: "added",
        clauseB: clausesB[j],
        similarity: 0,
      });
    }
  }

  return pairs;
}
