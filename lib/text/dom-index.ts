import { locateQuote, Occurrence } from "./locate";

export interface TextNodeEntry {
  node: Node;
  startInConcat: number;
  endInConcat: number;
  nodeLength: number;
}

export interface DomIndex {
  fullText: string;
  entries: TextNodeEntry[];
}

export interface HighlightResult {
  matchCount: number;
  activeMatchIndex: number;
  occurrences: Occurrence[];
  ranges: Range[][];
  success: boolean;
}

/**
 * Walks all text nodes in container in DOM order.
 * Inserts a space between text nodes when necessary so that adjacent spans/blocks
 * don't coalesce words (e.g. <span>Hello</span><span>world</span> -> "Hello world").
 */
export function buildTextIndex(container: HTMLElement): DomIndex {
  if (typeof document === "undefined") {
    return { fullText: "", entries: [] };
  }

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const entries: TextNodeEntry[] = [];
  let fullText = "";
  let currentNode = walker.nextNode();

  while (currentNode) {
    const text = currentNode.nodeValue || "";
    if (text.length > 0) {
      // If fullText doesn't end with whitespace and text doesn't start with whitespace,
      // and we are moving to a new node, insert a single space.
      if (
        fullText.length > 0 &&
        !/\s$/.test(fullText) &&
        !/^\s/.test(text)
      ) {
        fullText += " ";
      }

      const startInConcat = fullText.length;
      fullText += text;
      const endInConcat = fullText.length;

      entries.push({
        node: currentNode,
        startInConcat,
        endInConcat,
        nodeLength: text.length,
      });
    }
    currentNode = walker.nextNode();
  }

  return { fullText, entries };
}

/**
 * Converts start and end offsets in fullText to DOM Range objects across the text nodes.
 */
export function offsetsToDomRanges(
  domIndex: DomIndex,
  start: number,
  end: number
): Range[] {
  if (typeof document === "undefined" || start >= end) return [];

  const ranges: Range[] = [];

  for (const entry of domIndex.entries) {
    const segStart = Math.max(start, entry.startInConcat);
    const segEnd = Math.min(end, entry.endInConcat);

    if (segStart < segEnd) {
      const nodeStartOffset = segStart - entry.startInConcat;
      const nodeEndOffset = segEnd - entry.startInConcat;

      const safeStart = Math.max(0, Math.min(nodeStartOffset, entry.nodeLength));
      const safeEnd = Math.max(0, Math.min(nodeEndOffset, entry.nodeLength));

      if (safeStart < safeEnd) {
        try {
          const range = document.createRange();
          range.setStart(entry.node, safeStart);
          range.setEnd(entry.node, safeEnd);
          ranges.push(range);
        } catch {
          // Ignore invalid range boundaries
        }
      }
    }
  }

  return ranges;
}

/**
 * Locates quote in the rendered DOM text of container,
 * builds ranges for all matches, and registers them using the CSS Custom Highlight API.
 */
export function highlightQuoteInDom(
  container: HTMLElement,
  quoteText: string,
  activeMatchIndex: number = 0
): HighlightResult {
  const domIndex = buildTextIndex(container);
  if (!domIndex.fullText.trim()) {
    return {
      matchCount: 0,
      activeMatchIndex: 0,
      occurrences: [],
      ranges: [],
      success: false,
    };
  }

  // Run locateQuote directly against the DOM's rendered concatenated text
  const locateResult = locateQuote(domIndex.fullText, quoteText);

  if (locateResult.status === "unverified" || locateResult.occurrences.length === 0) {
    return {
      matchCount: 0,
      activeMatchIndex: 0,
      occurrences: [],
      ranges: [],
      success: false,
    };
  }

  // Convert each occurrence to an array of DOM Ranges
  const allRanges: Range[][] = locateResult.occurrences.map((occ) =>
    offsetsToDomRanges(domIndex, occ.start, occ.end)
  );

  const safeActiveIdx = Math.max(0, Math.min(activeMatchIndex, allRanges.length - 1));
  paintHighlights(allRanges, safeActiveIdx);

  // Scroll active range into view
  const activeMatchRanges = allRanges[safeActiveIdx];
  if (activeMatchRanges && activeMatchRanges.length > 0) {
    const firstRange = activeMatchRanges[0];
    const parentEl = firstRange.startContainer.parentElement;
    if (parentEl) {
      parentEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return {
    matchCount: allRanges.length,
    activeMatchIndex: safeActiveIdx,
    occurrences: locateResult.occurrences,
    ranges: allRanges,
    success: true,
  };
}

/**
 * Paints ranges using CSS Custom Highlight API with fallback.
 */
export function paintHighlights(allMatchRanges: Range[][], activeIndex: number = 0) {
  if (typeof window === "undefined" || typeof CSS === "undefined" || !("highlights" in CSS)) {
    return;
  }

  try {
    const activeRanges = allMatchRanges[activeIndex] || [];
    const dimRanges: Range[] = [];

    allMatchRanges.forEach((matchRanges, idx) => {
      if (idx !== activeIndex) {
        dimRanges.push(...matchRanges);
      }
    });

    const win = window as unknown as { Highlight: new (...r: Range[]) => unknown };
    const css = CSS as unknown as { highlights: Map<string, unknown> };

    if (win.Highlight) {
      css.highlights.set("cite-active", new win.Highlight(...activeRanges));
      css.highlights.set("cite-dim", new win.Highlight(...dimRanges));
      css.highlights.set("cite", new win.Highlight(...activeRanges, ...dimRanges));
    }
  } catch (err) {
    console.warn("Could not apply CSS Custom Highlight:", err);
  }
}

/**
 * Clears all active citation highlights.
 */
export function clearHighlights() {
  if (typeof CSS !== "undefined" && "highlights" in CSS) {
    try {
      const css = CSS as unknown as { highlights: Map<string, unknown> };
      css.highlights.delete("cite-active");
      css.highlights.delete("cite-dim");
      css.highlights.delete("cite");
    } catch {
      // Ignore
    }
  }
}
