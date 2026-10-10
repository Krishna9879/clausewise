import { diffWords } from "diff";
import { AlignedClausePair, ChangeType } from "./aligner";
import { detectDeterministicChanges } from "./detectors";
import { llmModel } from "../ai/client";
import { generateText } from "ai";

export type ClauseCategory =
  | "liability"
  | "payment"
  | "term"
  | "termination"
  | "IP"
  | "confidentiality"
  | "governing_law"
  | "other";

export type SignificanceLevel = "critical" | "high" | "medium" | "low" | "cosmetic";

export interface WordDiffChunk {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface ClauseChangeAnalysis {
  id: string;
  clauseNumber: string;
  heading: string | null;
  changeType: ChangeType;
  category: ClauseCategory;
  significance: SignificanceLevel;
  summary: string;
  whyItMatters: string;
  textBefore?: string;
  textAfter?: string;
  diffWords?: WordDiffChunk[];
  numbersChanged: Array<{ before: string; after: string; type: string }>;
}


export interface FullComparisonReport {
  docAId: string;
  docAName: string;
  docBId: string;
  docBName: string;
  executiveSummary: string[];
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    cosmetic: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    moved: number;
  };
  changes: ClauseChangeAnalysis[];
}

/**
 * Heuristically classifies clause category based on keywords
 */
function classifyCategory(text: string): ClauseCategory {
  const lower = text.toLowerCase();
  if (/liabilit|indemnif|cap\b|damages|limitation/i.test(lower)) return "liability";
  if (/payment|price|fee|invoice|interest|cost|aed|usd|\$/i.test(lower)) return "payment";
  if (/terminat|breach|cancel|default|expir/i.test(lower)) return "termination";
  if (/term\b|duration|renewal|commence|period/i.test(lower)) return "term";
  if (/confidenti|non-disclosure|secret|proprietary/i.test(lower)) return "confidentiality";
  if (/intellectual property|\bip\b|copyright|trademark|patent/i.test(lower)) return "IP";
  if (/governing law|jurisdiction|dispute|arbitrat|court/i.test(lower)) return "governing_law";
  return "other";
}

/**
 * Performs deep semantic and word-level diff analysis on aligned clause pairs.
 */
export async function analyzeComparison(
  docA: { id: string; name: string },
  docB: { id: string; name: string },
  pairs: AlignedClausePair[]
): Promise<FullComparisonReport> {
  const changes: ClauseChangeAnalysis[] = [];

  const stats = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    cosmetic: 0,
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    moved: 0,
  };

  for (let idx = 0; idx < pairs.length; idx++) {
    const pair = pairs[idx];
    const { type, clauseA, clauseB } = pair;

    if (type === "unchanged") {
      stats.unchanged++;
      continue;
    }

    const clauseNum = clauseB?.number || clauseA?.number || `Section ${idx + 1}`;
    const heading = clauseB?.heading || clauseA?.heading || null;
    const textA = clauseA?.text || "";
    const textB = clauseB?.text || "";
    const category = classifyCategory(textB || textA);

    if (type === "added") {
      stats.added++;
      stats.high++;
      changes.push({
        id: `change-${idx}`,
        clauseNumber: clauseNum,
        heading,
        changeType: "added",
        category,
        significance: "high",
        summary: `New clause introduced: ${heading || clauseNum}`,
        whyItMatters: "Adds new obligations, rights, or terms not present in the earlier version.",
        textBefore: undefined,
        textAfter: textB,
        diffWords: [{ value: textB, added: true }],
        numbersChanged: [],
      });
      continue;
    }

    if (type === "removed") {
      stats.removed++;
      stats.high++;
      changes.push({
        id: `change-${idx}`,
        clauseNumber: clauseNum,
        heading,
        changeType: "removed",
        category,
        significance: "high",
        summary: `Clause removed: ${heading || clauseNum}`,
        whyItMatters: "Removes previous contractual obligations or rights entirely.",
        textBefore: textA,
        textAfter: undefined,
        diffWords: [{ value: textA, removed: true }],
        numbersChanged: [],
      });
      continue;
    }

    if (type === "moved") {
      stats.moved++;
      stats.low++;
      changes.push({
        id: `change-${idx}`,
        clauseNumber: clauseNum,
        heading,
        changeType: "moved",
        category,
        significance: "low",
        summary: `Clause relocated in document order`,
        whyItMatters: "Clause wording remains substantially identical but location was shifted.",
        textBefore: textA,
        textAfter: textB,
        diffWords: diffWords(textA, textB),
        numbersChanged: [],
      });
      continue;
    }

    // Type === 'modified'
    stats.modified++;
    const diff = diffWords(textA, textB);
    const deterministic = detectDeterministicChanges(textA, textB);

    const significance: SignificanceLevel = deterministic.suggestedSignificance;
    let summary = "";
    let whyItMatters = "";


    if (deterministic.detectedChanges.length > 0) {
      summary = deterministic.detectedChanges.join("; ");
      whyItMatters = deterministic.hasNumberChange
        ? "Substantive financial or operational limits were altered."
        : "Legal obligations or discretion modal verbs were modified.";
    } else {
      summary = `Updated language in ${heading || clauseNum}`;
      whyItMatters = significance === "cosmetic"
        ? "Stylistic clarification with negligible legal risk alteration."
        : "Wording variation affecting contractual interpretation.";
    }

    // Optional LLM enrichment for critical or high changes if provider is live
    if (significance === "critical" || significance === "high") {
      try {
        const prompt = `Analyze this legal contract clause change:
BEFORE: ${textA.slice(0, 500)}
AFTER: ${textB.slice(0, 500)}

Respond in 2 lines:
Line 1: Plain-language summary (1 sentence, e.g. "Liability cap increased tenfold from AED 100,000 to AED 1,000,000.")
Line 2: Why it matters (1 sentence legal impact explanation)`;

        const res = await generateText({
          model: llmModel,
          prompt,
        });


        const lines = res.text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines[0]) summary = lines[0].replace(/^(Line 1:|\*|Summary:)/i, "").trim();
        if (lines[1]) whyItMatters = lines[1].replace(/^(Line 2:|\*|Why it matters:)/i, "").trim();
      } catch {
        // Deterministic analysis provides guaranteed fallback
      }
    }

    stats[significance]++;

    changes.push({
      id: `change-${idx}`,
      clauseNumber: clauseNum,
      heading,
      changeType: "modified",
      category,
      significance,
      summary,
      whyItMatters,
      textBefore: textA,
      textAfter: textB,
      diffWords: diff,
      numbersChanged: deterministic.numberDiffs,
    });
  }

  // Executive summary generation
  const nonCosmeticChanges = changes.filter((c) => c.significance !== "cosmetic");
  const executiveSummary: string[] = [];

  if (nonCosmeticChanges.length === 0) {
    executiveSummary.push("The compared documents have identical legal terms with only minor cosmetic or formatting variations.");
  } else {
    for (const c of nonCosmeticChanges.slice(0, 6)) {
      executiveSummary.push(`[${c.significance.toUpperCase()}] ${c.clauseNumber}: ${c.summary}`);
    }
  }

  return {
    docAId: docA.id,
    docAName: docA.name,
    docBId: docB.id,
    docBName: docB.name,
    executiveSummary,
    stats,
    changes,
  };
}
