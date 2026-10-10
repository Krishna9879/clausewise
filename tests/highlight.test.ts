import { describe, it, expect } from "vitest";
import { offsetsToDomRanges, DomIndex } from "@/lib/text/dom-index";
import { locateQuote } from "@/lib/text/locate";
import { QuoteStreamParser } from "@/lib/verify/stream-parser";

describe("Phase 4 & 5: Highlight Engine & Multi-Document Verification", () => {
  it("converts concatenated text offsets accurately into node slices", () => {
    // Mock text nodes
    const node1 = { nodeValue: "The liability of Supplier ", length: 26 } as unknown as Node;
    const node2 = { nodeValue: "shall not exceed AED 100,000.", length: 29 } as unknown as Node;

    const domIndex: DomIndex = {
      fullText: "The liability of Supplier shall not exceed AED 100,000.",
      entries: [
        { node: node1, startInConcat: 0, endInConcat: 26, nodeLength: 26 },
        { node: node2, startInConcat: 26, endInConcat: 55, nodeLength: 29 },
      ],
    };

    // Locate quote spanning across both nodes
    const quote = "Supplier shall not exceed AED 100,000.";
    const result = locateQuote(domIndex.fullText, quote);

    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);

    const occ = result.occurrences[0];
    expect(occ.start).toBe(17);
    expect(occ.end).toBe(55);

    // Test offset conversion without real browser Range (mock DOM Range)
    const mockCreatedRanges: Array<{ node: Node; start: number; end: number }> = [];
    // @ts-ignore
    globalThis.document = {
      createRange: () => {
        const r = {
          startContainer: null as unknown as Node,
          startOffset: 0,
          endContainer: null as unknown as Node,
          endOffset: 0,
          setStart(n: Node, o: number) {
            this.startContainer = n;
            this.startOffset = o;
          },
          setEnd(n: Node, o: number) {
            this.endContainer = n;
            this.endOffset = o;
            mockCreatedRanges.push({ node: this.startContainer, start: this.startOffset, end: this.endOffset });
          },
        };
        return r;
      },
    } as unknown as Document;

    const ranges = offsetsToDomRanges(domIndex, occ.start, occ.end);
    expect(ranges.length).toBe(2);
    // Slice in node1: 17 to 26 (9 chars)
    expect(mockCreatedRanges[0].start).toBe(17);
    expect(mockCreatedRanges[0].end).toBe(26);
    // Slice in node2: 0 to 29 (29 chars)
    expect(mockCreatedRanges[1].start).toBe(0);
    expect(mockCreatedRanges[1].end).toBe(29);
  });

  it("verifies quotes against correct document in multi-document mode", () => {
    const docSources = [
      {
        id: "D1",
        name: "Service_Agreement_v1.pdf",
        text: "The total aggregate liability of the Supplier shall not exceed AED 100,000 per claim.",
      },
      {
        id: "D2",
        name: "Service_Agreement_v2.docx",
        text: "The total aggregate liability of the Supplier shall not exceed AED 1,000,000 per claim.",
      },
    ];

    const parser = new QuoteStreamParser(docSources);

    // Model emits quote with D2
    const chunk =
      'Agreement v2 increased the liability cap to AED 1,000,000. <quote id="Q1" doc="D2">The total aggregate liability of the Supplier shall not exceed AED 1,000,000 per claim.</quote>';
    const events = parser.feed(chunk);
    const quoteEvents = events.filter((e) => e.type === "quote");

    expect(quoteEvents.length).toBe(1);
    const q1 = quoteEvents[0].quote;
    expect(q1.status).toBe("verified");
    expect(q1.docId).toBe("D2");
    expect(q1.text).toContain("1,000,000");

    // Attributing completely absent quote to D1 should fail verification (not_found)
    const badChunk =
      'Agreement v1 governing law clause. <quote id="Q2" doc="D1">This Agreement shall be governed exclusively by the laws of England and Wales.</quote>';
    const badEvents = parser.feed(badChunk);
    const badQuoteEvents = badEvents.filter((e) => e.type === "quote");

    expect(badQuoteEvents.length).toBe(1);
    expect(badQuoteEvents[0].quote.status).toBe("unverified");
    expect(badQuoteEvents[0].quote.reason).toBe("not_found");

    // Attributing quote to non-existent document D9 should return wrong_document
    const invalidDocChunk =
      'Agreement v9 quote. <quote id="Q3" doc="D9">The total aggregate liability of the Supplier shall not exceed AED 100,000 per claim.</quote>';
    const invalidDocEvents = parser.feed(invalidDocChunk);
    const invalidQuoteEvents = invalidDocEvents.filter((e) => e.type === "quote");

    expect(invalidQuoteEvents.length).toBe(1);
    expect(invalidQuoteEvents[0].quote.status).toBe("unverified");
    expect(invalidQuoteEvents[0].quote.reason).toBe("wrong_document");
  });

});
