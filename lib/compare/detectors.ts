export interface NumberDiff {
  type: "currency" | "percentage" | "duration" | "date" | "number";
  before: string;
  after: string;
}

export interface DeterministicDiffResult {
  hasNumberChange: boolean;
  hasObligationChange: boolean;
  numberDiffs: NumberDiff[];
  detectedChanges: string[];
  suggestedSignificance: "critical" | "high" | "medium" | "low" | "cosmetic";
}

const CURRENCY_REGEX = /(?:AED|USD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d+)?/gi;
const PERCENT_REGEX = /\b\d+(?:\.\d+)?\s*%/g;
const DURATION_REGEX = /\b\d+\s*(?:day|days|business days|month|months|year|years|week|weeks|hour|hours)\b/gi;
const OBLIGATION_TERMS = ["shall", "shall not", "must", "must not", "may", "may not", "will", "will not"];

/**
 * Extracts and compares deterministic entities (currencies, numbers, durations, obligations)
 * between two clause texts according to PLAN.md Section 9.3.
 */
export function detectDeterministicChanges(beforeText: string, afterText: string): DeterministicDiffResult {
  const detectedChanges: string[] = [];
  const numberDiffs: NumberDiff[] = [];

  // 1. Currencies
  const beforeCurrencies = Array.from(beforeText.matchAll(CURRENCY_REGEX), (m) => m[0].trim());
  const afterCurrencies = Array.from(afterText.matchAll(CURRENCY_REGEX), (m) => m[0].trim());

  if (beforeCurrencies.join(",") !== afterCurrencies.join(",")) {
    detectedChanges.push(`Financial amount changed from [${beforeCurrencies.join(", ") || "none"}] to [${afterCurrencies.join(", ") || "none"}]`);
    numberDiffs.push({
      type: "currency",
      before: beforeCurrencies.join(", ") || "None",
      after: afterCurrencies.join(", ") || "None",
    });
  }

  // 2. Percentages
  const beforePercents = Array.from(beforeText.matchAll(PERCENT_REGEX), (m) => m[0].trim());
  const afterPercents = Array.from(afterText.matchAll(PERCENT_REGEX), (m) => m[0].trim());

  if (beforePercents.join(",") !== afterPercents.join(",")) {
    detectedChanges.push(`Percentage changed from [${beforePercents.join(", ") || "none"}] to [${afterPercents.join(", ") || "none"}]`);
    numberDiffs.push({
      type: "percentage",
      before: beforePercents.join(", ") || "None",
      after: afterPercents.join(", ") || "None",
    });
  }

  // 3. Durations / Time periods
  const beforeDurations = Array.from(beforeText.matchAll(DURATION_REGEX), (m) => m[0].trim());
  const afterDurations = Array.from(afterText.matchAll(DURATION_REGEX), (m) => m[0].trim());

  if (beforeDurations.join(",") !== afterDurations.join(",")) {
    detectedChanges.push(`Duration/time period changed from [${beforeDurations.join(", ") || "none"}] to [${afterDurations.join(", ") || "none"}]`);
    numberDiffs.push({
      type: "duration",
      before: beforeDurations.join(", ") || "None",
      after: afterDurations.join(", ") || "None",
    });
  }

  // 4. Modal verbs / obligations
  const beforeLower = beforeText.toLowerCase();
  const afterLower = afterText.toLowerCase();
  let hasObligationChange = false;

  for (const term of OBLIGATION_TERMS) {
    const beforeHas = new RegExp(`\\b${term}\\b`).test(beforeLower);
    const afterHas = new RegExp(`\\b${term}\\b`).test(afterLower);
    if (beforeHas !== afterHas) {
      hasObligationChange = true;
      detectedChanges.push(`Obligation modal verb changed: "${term}" was ${beforeHas ? "removed" : "added"}`);
    }
  }

  const hasNumberChange = numberDiffs.length > 0;

  // Determine minimum significance based on hard deterministic indicators
  let suggestedSignificance: "critical" | "high" | "medium" | "low" | "cosmetic" = "cosmetic";

  if (numberDiffs.some((d) => d.type === "currency") || (hasObligationChange && hasNumberChange)) {
    suggestedSignificance = "critical";
  } else if (hasNumberChange || hasObligationChange) {
    suggestedSignificance = "high";
  } else {
    // Check if the change is just punctuation or capitalization
    const normBefore = beforeText.toLowerCase().replace(/[^\w]/g, "");
    const normAfter = afterText.toLowerCase().replace(/[^\w]/g, "");
    if (normBefore === normAfter) {
      suggestedSignificance = "cosmetic";
    } else {
      suggestedSignificance = "medium";
    }
  }

  return {
    hasNumberChange,
    hasObligationChange,
    numberDiffs,
    detectedChanges,
    suggestedSignificance,
  };
}
