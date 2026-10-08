import { describe, it, expect } from "vitest";
import { parseClauses } from "@/lib/extract/clause-parse";
import { chunkDocument } from "@/lib/retrieval/chunk";

describe("Phase 2: Extraction, Clause Parsing & Chunking", () => {
  it("parses legal clauses, section headings and nested levels", () => {
    const legalContract = `
MASTER SERVICES AGREEMENT

1. Definitions
In this Agreement, the following terms shall have the following meanings.

2. Services and Deliverables
2.1 Scope of Work
The Supplier shall provide the services described in the Statement of Work.

2.2 Timelines
All milestones shall be met in accordance with Schedule A.

Article 3. Payment and Taxes
Payment is due net thirty (30) days from invoice date.

Section 4. Termination
Either party may terminate for cause immediately upon written notice.
    `.trim();

    const clauses = parseClauses(legalContract);
    expect(clauses.length).toBeGreaterThanOrEqual(4);

    const clause1 = clauses.find((c) => c.number?.startsWith("1"));
    expect(clause1).toBeDefined();
    expect(clause1?.heading).toContain("Definitions");

    const clause2_1 = clauses.find((c) => c.number === "2.1");
    expect(clause2_1).toBeDefined();
    expect(clause2_1?.level).toBe(2);

    const article3 = clauses.find((c) => c.number?.includes("3"));
    expect(article3).toBeDefined();
  });

  it("chunks document with clause awareness without breaking mid-sentence", () => {
    const text = "1. Confidentiality\nEach party shall keep proprietary information secret. Neither party shall disclose without consent.";
    const pages = [{ n: 1, start: 0, end: text.length }];
    const clauses = parseClauses(text);

    const chunks = chunkDocument(text, pages, clauses);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toContain("Confidentiality");
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[0].pageEnd).toBe(1);
  });
});
