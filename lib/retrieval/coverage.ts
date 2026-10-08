export interface CoverageState {
  mode: "complete" | "partial";
  pagesRead: number[];
  totalPages: number;
  complete: boolean;
  note?: string;
}

/**
 * Validates whether an LLM answer violates the absence rule under partial coverage.
 * Conforms to PLAN.md Section 8.
 */
export function enforceAbsenceRule(
  answer: string,
  coverage: CoverageState
): { sanitizedAnswer: string; appendedNotice?: string } {
  if (coverage.complete) {
    return { sanitizedAnswer: answer };
  }

  // Absence indicator patterns: "does not contain", "no clause", "is absent", "there are no", etc.
  const absencePattern = /(does not contain|there is no (clause|provision|mention|term)|is not mentioned|absent from the document|no evidence of|found no)/i;

  if (absencePattern.test(answer)) {
    const pagesList = coverage.pagesRead.sort((a, b) => a - b);
    const pageRangeStr =
      pagesList.length > 0
        ? `pages ${pagesList[0]}–${pagesList[pagesList.length - 1]}`
        : "a subset of pages";

    const notice = `\n\n> ⚠️ **Coverage Notice:** I only examined passages from ${pageRangeStr} of ${coverage.totalPages} that matched your question. This does not prove the clause is absent.`;

    return {
      sanitizedAnswer: answer,
      appendedNotice: notice,
    };
  }

  return { sanitizedAnswer: answer };
}
