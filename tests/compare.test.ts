import { describe, it, expect } from "vitest";
import { detectDeterministicChanges } from "@/lib/compare/detectors";
import { alignClauses, segmentTextIntoClauses } from "@/lib/compare/aligner";
import { analyzeComparison } from "@/lib/compare/analyzer";

describe("Phase 6: Contract Redline & Document Comparison", () => {
  it("detects critical currency changes and high-significance duration changes deterministically", () => {
    // 1. Currency amount change (cap AED 100,000 -> 1,000,000)
    const liabilityA = "The total aggregate liability of the Supplier shall not exceed AED 100,000 per claim.";
    const liabilityB = "The total aggregate liability of the Supplier shall not exceed AED 1,000,000 per claim.";

    const currDiff = detectDeterministicChanges(liabilityA, liabilityB);
    expect(currDiff.hasNumberChange).toBe(true);
    expect(currDiff.suggestedSignificance).toBe("critical");
    expect(currDiff.numberDiffs[0].type).toBe("currency");
    expect(currDiff.numberDiffs[0].before).toContain("100,000");
    expect(currDiff.numberDiffs[0].after).toContain("1,000,000");

    // 2. Duration change (notice 30 days -> 14 days)
    const termA = "Either party may terminate this Agreement by giving at least 30 days written notice.";
    const termB = "Either party may terminate this Agreement by giving at least 14 days written notice.";

    const durDiff = detectDeterministicChanges(termA, termB);
    expect(durDiff.hasNumberChange).toBe(true);
    expect(durDiff.suggestedSignificance).toBe("high");
    expect(durDiff.numberDiffs[0].type).toBe("duration");
    expect(durDiff.numberDiffs[0].before).toContain("30 days");
    expect(durDiff.numberDiffs[0].after).toContain("14 days");

    // 3. Obligation modal verb change (shall -> may)
    const modalA = "The Customer shall pay invoices within 15 days.";
    const modalB = "The Customer may pay invoices within 15 days.";

    const modalDiff = detectDeterministicChanges(modalA, modalB);
    expect(modalDiff.hasObligationChange).toBe(true);
    expect(modalDiff.suggestedSignificance).toBe("high");

    // 4. Cosmetic punctuation/casing change
    const cosmeticA = "Governing Law: The courts of Dubai shall have jurisdiction.";
    const cosmeticB = "governing law: the courts of Dubai shall have jurisdiction.";

    const cosDiff = detectDeterministicChanges(cosmeticA, cosmeticB);
    expect(cosDiff.suggestedSignificance).toBe("cosmetic");
  });

  it("aligns clauses accurately, detecting added, removed, unchanged, and modified provisions", () => {
    const docAText = `1. Liability
The total aggregate liability of the Supplier shall not exceed AED 100,000 per claim.

2. Termination
Either party may terminate this Agreement by giving 30 days written notice.

3. Dispute Resolution
Any dispute shall be referred to arbitration in Dubai.`;

    const docBText = `1. Liability
The total aggregate liability of the Supplier shall not exceed AED 1,000,000 per claim.

2. Termination
Either party may terminate this Agreement by giving 14 days written notice.

4. Data Protection
Each party shall comply with applicable UAE data protection laws.`;

    const clausesA = segmentTextIntoClauses(docAText);
    const clausesB = segmentTextIntoClauses(docBText);

    expect(clausesA.length).toBe(3);
    expect(clausesB.length).toBe(3);

    const aligned = alignClauses(clausesA, clausesB);

    const modifiedPairs = aligned.filter((p) => p.type === "modified");
    const addedPairs = aligned.filter((p) => p.type === "added");
    const removedPairs = aligned.filter((p) => p.type === "removed");

    // Clause 1 and Clause 2 should be matched as modified
    expect(modifiedPairs.length).toBe(2);
    // Clause 4 in Doc B is added
    expect(addedPairs.length).toBe(1);
    expect(addedPairs[0].clauseB?.text).toContain("Data Protection");
    // Clause 3 in Doc A is removed
    expect(removedPairs.length).toBe(1);
    expect(removedPairs[0].clauseA?.text).toContain("Dispute Resolution");
  });

  it("generates a comprehensive comparison report with stats and executive summary", async () => {
    const docA = { id: "doc-1", name: "Vendor_Contract_v1.pdf" };
    const docB = { id: "doc-2", name: "Vendor_Contract_v2.docx" };

    const clausesA = [
      { number: "1.0", heading: "Liability", text: "The liability cap shall be AED 100,000." },
      { number: "2.0", heading: "Governing Law", text: "This contract is governed by the laws of DIFC." },
    ];
    const clausesB = [
      { number: "1.0", heading: "Liability", text: "The liability cap shall be AED 1,000,000." },
      { number: "2.0", heading: "Governing Law", text: "This contract is governed by the laws of DIFC." },
    ];

    const aligned = alignClauses(clausesA, clausesB);
    const report = await analyzeComparison(docA, docB, aligned);

    expect(report.docAName).toBe("Vendor_Contract_v1.pdf");
    expect(report.stats.unchanged).toBe(1); // Governing Law
    expect(report.stats.modified).toBe(1); // Liability
    expect(report.stats.critical).toBe(1); // Cap increased
    expect(report.changes.length).toBe(1);
    expect(report.changes[0].category).toBe("liability");
    expect(report.changes[0].significance).toBe("critical");
    expect(report.executiveSummary.length).toBeGreaterThan(0);
  });
});
