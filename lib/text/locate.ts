import { normalizeWithMap, buildStrippedWithMap } from "./normalize";

export interface Occurrence {
  start: number; // original string character start offset
  end: number;   // original string character end offset
  pageStart: number;
  pageEnd: number;
  snippet?: string;
}

export interface PageOffset {
  n: number;
  start: number;
  end: number;
  charCount?: number;
}

export interface LocateOptions {
  pages?: PageOffset[];
  minChars?: number;
  minWords?: number;
  nearMatchThreshold?: number; // default 0.85
}

export interface LocateResult {
  status: "verified" | "near_match" | "unverified";
  reason?: "not_found" | "too_short" | "wrong_document";
  occurrences: Occurrence[];
  matchedText?: string;
}

function computePages(start: number, end: number, pages?: PageOffset[]): { pageStart: number; pageEnd: number } {
  if (!pages || pages.length === 0) {
    return { pageStart: 1, pageEnd: 1 };
  }

  let pageStart = 1;
  let pageEnd = 1;

  for (const p of pages) {
    if (start >= p.start && start <= p.end) {
      pageStart = p.n;
    }
    if (end >= p.start && end <= p.end) {
      pageEnd = p.n;
    }
  }

  // Fallback if beyond boundary
  if (pageEnd < pageStart) pageEnd = pageStart;

  return { pageStart, pageEnd };
}

/**
 * Locates all occurrences of a quote within document text, returning verified exact original character offsets.
 * Conforms strictly to PLAN.md Section 6.2.
 */
export function locateQuote(docText: string, quote: string, options?: LocateOptions): LocateResult {
  const minChars = options?.minChars ?? 20;
  const minWords = options?.minWords ?? 4;
  const rawClean = quote.trim();

  // Reject quotes shorter than 20 characters or 4 words
  const words = rawClean.split(/\s+/).filter(Boolean);
  if (rawClean.length < minChars || words.length < minWords) {
    return {
      status: "unverified",
      reason: "too_short",
      occurrences: [],
    };
  }

  // Handle ellipsis segments: "..." or "…" or "[...]"
  const ellipsisRegex = /\[?\.\.\.\]?|…/g;
  const segments = rawClean.split(ellipsisRegex).map((s) => s.trim()).filter(Boolean);

  if (segments.length > 1) {
    return locateEllipsisQuote(docText, segments, options);
  }

  // Single contiguous quote search
  const docNorm = normalizeWithMap(docText);
  const quoteNorm = normalizeWithMap(quote);

  if (!quoteNorm.norm) {
    return { status: "unverified", reason: "too_short", occurrences: [] };
  }

  // Pass 1: exact normalized match via indexOf
  const occurrences: Occurrence[] = [];
  let searchIdx = 0;

  while (searchIdx < docNorm.norm.length) {
    const foundIdx = docNorm.norm.indexOf(quoteNorm.norm, searchIdx);
    if (foundIdx === -1) break;

    const normEndIdx = foundIdx + quoteNorm.norm.length - 1;
    const origStart = docNorm.map[foundIdx];
    const origEnd = docNorm.map[normEndIdx] + 1;

    const { pageStart, pageEnd } = computePages(origStart, origEnd, options?.pages);
    occurrences.push({
      start: origStart,
      end: origEnd,
      pageStart,
      pageEnd,
      snippet: docText.slice(origStart, origEnd),
    });

    searchIdx = foundIdx + 1; // Find all occurrences
  }

  if (occurrences.length > 0) {
    return {
      status: "verified",
      occurrences,
      matchedText: occurrences[0].snippet,
    };
  }

  // Pass 2: Stripped whitespace and punctuation pass
  const docStripped = buildStrippedWithMap(docText);
  const quoteStripped = buildStrippedWithMap(quote);

  if (quoteStripped.stripped.length >= minChars - 5) {
    let strippedSearch = 0;
    while (strippedSearch < docStripped.stripped.length) {
      const foundIdx = docStripped.stripped.indexOf(quoteStripped.stripped, strippedSearch);
      if (foundIdx === -1) break;

      const strippedEndIdx = foundIdx + quoteStripped.stripped.length - 1;
      const origStart = docStripped.map[foundIdx];
      const origEnd = docStripped.map[strippedEndIdx] + 1;

      const { pageStart, pageEnd } = computePages(origStart, origEnd, options?.pages);
      occurrences.push({
        start: origStart,
        end: origEnd,
        pageStart,
        pageEnd,
        snippet: docText.slice(origStart, origEnd),
      });

      strippedSearch = foundIdx + 1;
    }

    if (occurrences.length > 0) {
      return {
        status: "verified",
        occurrences,
        matchedText: occurrences[0].snippet,
      };
    }
  }

  // Pass 3: Near-match detection (token overlap >= threshold, displayed as amber near_match, NEVER verified)
  const nearMatchResult = checkNearMatch(docText, quote, options);
  if (nearMatchResult) {
    return nearMatchResult;
  }

  return {
    status: "unverified",
    reason: "not_found",
    occurrences: [],
  };
}

/**
 * Handles multi-segment ellipsis quotes. Every segment (>= 4 words or >= 15 chars) must occur in order within 2,500 chars window.
 */
function locateEllipsisQuote(docText: string, segments: string[], options?: LocateOptions): LocateResult {
  const docNorm = normalizeWithMap(docText);
  const normSegments = segments.map((s) => normalizeWithMap(s).norm).filter(Boolean);

  if (normSegments.length < 2) {
    return { status: "unverified", reason: "too_short", occurrences: [] };
  }

  // Find all possible beginnings
  const firstSeg = normSegments[0];
  const occurrences: Occurrence[] = [];

  let startSearch = 0;
  while (startSearch < docNorm.norm.length) {
    const firstIdx = docNorm.norm.indexOf(firstSeg, startSearch);
    if (firstIdx === -1) break;

    let curIdx = firstIdx + firstSeg.length;
    let matchedAll = true;

    for (let s = 1; s < normSegments.length; s++) {
      const nextSeg = normSegments[s];
      const nextIdx = docNorm.norm.indexOf(nextSeg, curIdx);
      // Window check: segments must be within 2500 normalized characters of first segment
      if (nextIdx === -1 || nextIdx - firstIdx > 2500) {
        matchedAll = false;
        break;
      }
      curIdx = nextIdx + nextSeg.length;
    }

    if (matchedAll) {
      const normStart = firstIdx;
      const normEnd = curIdx - 1;
      const origStart = docNorm.map[normStart];
      const origEnd = docNorm.map[normEnd] + 1;

      const { pageStart, pageEnd } = computePages(origStart, origEnd, options?.pages);
      occurrences.push({
        start: origStart,
        end: origEnd,
        pageStart,
        pageEnd,
        snippet: docText.slice(origStart, origEnd),
      });
    }

    startSearch = firstIdx + 1;
  }

  if (occurrences.length > 0) {
    return {
      status: "verified",
      occurrences,
      matchedText: occurrences[0].snippet,
    };
  }

  return {
    status: "unverified",
    reason: "not_found",
    occurrences: [],
  };
}

/**
 * Token overlap calculation for near-match labeling
 */
function checkNearMatch(docText: string, quote: string, options?: LocateOptions): LocateResult | null {
  const quoteTokens = quote.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((t) => t.length > 2);
  if (quoteTokens.length < 4) return null;

  const quoteSet = new Set(quoteTokens);
  const docTokens = docText.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((t) => t.length > 2);

  // Sliding window across document tokens
  const windowSize = quoteTokens.length;
  let maxOverlap = 0;
  let bestWindowStartIdx = -1;

  for (let i = 0; i <= docTokens.length - windowSize; i += 2) {
    let overlapCount = 0;
    for (let j = 0; j < windowSize; j++) {
      if (quoteSet.has(docTokens[i + j])) {
        overlapCount++;
      }
    }
    const overlapRatio = overlapCount / quoteTokens.length;
    if (overlapRatio > maxOverlap) {
      maxOverlap = overlapRatio;
      bestWindowStartIdx = i;
    }
  }

  const threshold = options?.nearMatchThreshold ?? 0.85;
  if (maxOverlap >= threshold && bestWindowStartIdx !== -1) {
    return {
      status: "near_match",
      occurrences: [], // not marked with exact verified offsets
      matchedText: undefined,
    };
  }

  return null;
}
