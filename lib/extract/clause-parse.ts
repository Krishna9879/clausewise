export interface ParsedClause {
  number?: string;
  heading?: string;
  level: number;
  charStart: number;
  charEnd: number;
  text: string;
}

/**
 * Detects numbered clauses, sections, and legal articles with regex.
 * Conforms to PLAN.md Section 5.
 */
export function parseClauses(text: string): ParsedClause[] {
  // Regex pattern matching legal clause structures:
  // e.g. "1. Definitions", "1.1 General", "Article 2", "Section 3.1", "(a) Obligation", etc.
  const clauseRegex = /(?:^|\n)\s*((?:Section|Article)\s+\d+(?:\.\d+)*|\d+(?:\.\d+)*[.)]?|\([a-z0-9]+\))\s*([^\n]+)/gi;

  const matches: { index: number; number: string; heading: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = clauseRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      number: match[1].trim(),
      heading: match[2].trim(),
    });
  }

  const clauses: ParsedClause[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const charStart = current.index;
    const charEnd = next ? next.index : text.length;
    const clauseText = text.slice(charStart, charEnd).trim();

    // Determine nesting level: e.g. "1." -> 1, "1.1" -> 2, "1.1.2" -> 3
    const dotCount = (current.number.match(/\./g) || []).length;
    const level = Math.min(4, Math.max(1, dotCount + 1));

    clauses.push({
      number: current.number,
      heading: current.heading,
      level,
      charStart,
      charEnd,
      text: clauseText,
    });
  }

  return clauses;
}
