/**
 * Character-by-character text normalization with an exact index map back to original offsets.
 * Conforms to PLAN.md Section 6.1.
 */

export interface NormalizedResult {
  norm: string;
  map: number[]; // map[i] is the offset in original of norm[i]
}

export interface RobustStrippedResult {
  stripped: string;
  map: number[]; // map[i] is the offset in original of stripped[i]
}

/**
 * Normalizes text while preserving an exact character index mapping back to original string offsets.
 */
export function normalizeWithMap(original: string): NormalizedResult {
  // Normalize via NFKC first while tracking characters, or step-by-step
  // Because NFKC can decompose/compose characters, we first do a char-level substitution
  // and handle NFKC per cluster.
  const normChars: string[] = [];
  const map: number[] = [];

  let inWhitespace = false;

  for (let i = 0; i < original.length; i++) {
    const ch = original[i];

    // Check for de-hyphenation at line breaks: word-\nword or word-\r\nword
    // word-\n[whitespace]*[a-z]
    if (ch === "-" || ch === "–" || ch === "—" || ch === "\u00AD") {
      // Check if followed by newline and continuing word
      let nextIdx = i + 1;
      let hasNewline = false;
      while (nextIdx < original.length && (original[nextIdx] === " " || original[nextIdx] === "\t" || original[nextIdx] === "\r" || original[nextIdx] === "\n")) {
        if (original[nextIdx] === "\n") hasNewline = true;
        nextIdx++;
      }
      if (hasNewline && nextIdx < original.length && /[a-z]/i.test(original[nextIdx])) {
        // Skip hyphen and line break characters; the next lowercase letter will continue
        i = nextIdx - 1;
        inWhitespace = false;
        continue;
      }
    }

    // Filter zero-width chars, soft hyphen (U+00AD), BOM (U+FEFF), zero-width space (U+200B)
    if (ch === "\uFEFF" || ch === "\u200B" || ch === "\u200C" || ch === "\u200D" || ch === "\u00AD") {
      continue;
    }

    // NFKC normalization for single character
    const nfkc = ch.normalize("NFKC");

    for (let c of nfkc) {
      // Unify quotes
      if (c === "“" || c === "”" || c === "«" || c === "»" || c === "″") {
        c = '"';
      } else if (c === "‘" || c === "’" || c === "‹" || c === "›" || c === "′" || c === "`") {
        c = "'";
      }
      // Unify dashes
      else if (c === "–" || c === "—" || c === "−" || c === "‐" || c === "‑") {
        c = "-";
      }
      // Ellipsis
      else if (c === "…") {
        // Expand to 3 periods, all mapping to original offset i
        for (let p = 0; p < 3; p++) {
          normChars.push(".");
          map.push(i);
        }
        inWhitespace = false;
        continue;
      }
      // Arabic normalizations:
      // Tashkeel stripping: U+064B to U+065F, U+0670
      const code = c.charCodeAt(0);
      if ((code >= 0x064b && code <= 0x065f) || code === 0x0670) {
        continue; // drop diacritics without adding to norm
      }
      // Tatweel U+0640
      if (code === 0x0640) {
        continue; // drop tatweel
      }
      // Alef forms: أ إ آ ٱ -> ا
      if (c === "أ" || c === "إ" || c === "آ" || c === "ٱ") {
        c = "ا";
      }
      // Ya / Alef-maqsura: ى -> ي
      else if (c === "ى") {
        c = "ي";
      }
      // Ta-marbuta: ة -> ه
      else if (c === "ة") {
        c = "ه";
      }
      // Arabic-Indic digits: ٠-٩ -> 0-9
      else if (code >= 0x0660 && code <= 0x0669) {
        c = String.fromCharCode(code - 0x0660 + 48);
      }

      // Check whitespace
      if (/\s/.test(c) || c === "\u00A0") {
        if (!inWhitespace && normChars.length > 0) {
          normChars.push(" ");
          map.push(i);
          inWhitespace = true;
        }
      } else {
        // Case-fold to lowercase
        const lower = c.toLowerCase();
        for (const lc of lower) {
          normChars.push(lc);
          map.push(i);
        }
        inWhitespace = false;
      }
    }
  }

  // Trim trailing whitespace
  while (normChars.length > 0 && normChars[normChars.length - 1] === " ") {
    normChars.pop();
    map.pop();
  }

  return {
    norm: normChars.join(""),
    map,
  };
}

/**
 * Pass 2 variant: whitespace-free and punctuation-free variant with its own map.
 * Used for resilient matching when PDF text drop/insert spaces or punctuation formatting differs.
 */
export function buildStrippedWithMap(original: string): RobustStrippedResult {
  const normResult = normalizeWithMap(original);
  const strippedChars: string[] = [];
  const map: number[] = [];

  for (let i = 0; i < normResult.norm.length; i++) {
    const ch = normResult.norm[i];
    // Keep only alphanumeric chars (letters and digits, including Arabic letters)
    if (/\p{L}|\p{N}/u.test(ch)) {
      strippedChars.push(ch);
      map.push(normResult.map[i]);
    }
  }

  return {
    stripped: strippedChars.join(""),
    map,
  };
}
