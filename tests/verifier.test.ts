import { describe, it, expect } from "vitest";
import { normalizeWithMap, buildStrippedWithMap } from "@/lib/text/normalize";
import { locateQuote } from "@/lib/text/locate";
import { verifyQuote, DocumentSource } from "@/lib/verify/quotes";
import { QuoteStreamParser } from "@/lib/verify/stream-parser";

describe("Phase 1: Quote Verifier Core", () => {
  // 1. Exact match
  it("locates exact verbatim quote with correct character offsets", () => {
    const text = "The Supplier shall indemnify the Client against all reasonable direct losses.";
    const quote = "Supplier shall indemnify the Client against all reasonable";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
    expect(result.matchedText).toBe("Supplier shall indemnify the Client against all reasonable");
    expect(text.slice(result.occurrences[0].start, result.occurrences[0].end)).toBe(
      "Supplier shall indemnify the Client against all reasonable"
    );
  });

  // 2. Whitespace differences (multiple spaces, tabs, newlines)
  it("handles whitespace differences: collapsed spaces, tabs, newlines", () => {
    const text = "Section 4.1\n\nPayment   shall be made within   thirty (30) days of invoice receipt.";
    const quote = "Payment shall be made within thirty (30) days of invoice receipt.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
    expect(result.occurrences[0].snippet).toBe(
      "Payment   shall be made within   thirty (30) days of invoice receipt."
    );
  });

  // 3. Line-break hyphenation de-hyphenation
  it("correctly de-hyphenates line breaks (con- \n tractor -> contractor)", () => {
    const text = "The con-\ntractor shall perform all work with standard profess-\r\nional care.";
    const quote = "The contractor shall perform all work with standard professional care.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
  });

  // 4. Curly vs straight quotes and apostrophes
  it("handles curly quotes and apostrophes vs straight quotes", () => {
    const text = "“Company’s liability shall not exceed the fees paid in the preceding twelve months.”";
    const quote = '"Company\'s liability shall not exceed the fees paid in the preceding twelve months."';
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
  });

  // 5. Em-dash, en-dash, minus, hyphens
  it("normalizes en-dash, em-dash, and minus signs", () => {
    const text = "Liability cap — excluding willful misconduct — shall be capped at 100%.";
    const quote = "Liability cap - excluding willful misconduct - shall be capped at 100%.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
  });

  // 6. Ellipsis character vs 3 dots
  it("normalizes unicode ellipsis … to three dots", () => {
    const text = "The agreement shall continue… unless terminated sooner by written notice.";
    const quote = "The agreement shall continue... unless terminated sooner by written notice.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
  });

  // 7. Reject quotes shorter than 20 characters
  it("rejects quotes shorter than 20 characters as too_short", () => {
    const text = "The agreement is valid.";
    const quote = "is valid.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("unverified");
    expect(result.reason).toBe("too_short");
  });

  // 8. Reject quotes with fewer than 4 words
  it("rejects quotes with fewer than 4 words as too_short", () => {
    const text = "Non-disclosure agreement applies to Supercalifragilisticexpialidocious.";
    const quote = "Supercalifragilisticexpialidocious"; // >20 chars but 1 word
    const result = locateQuote(text, quote);
    expect(result.status).toBe("unverified");
    expect(result.reason).toBe("too_short");
  });

  // 9. Completely fabricated quote
  it("rejects completely fabricated quote as not_found", () => {
    const text = "This agreement is governed by the laws of England and Wales.";
    const quote = "The agreement shall be governed strictly by the state laws of California.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("unverified");
    expect(result.reason).toBe("not_found");
  });

  // 10. Multi-segment ellipsis quotes (Q ... Q)
  it("locates multi-segment quotes with ellipsis", () => {
    const text =
      "The total aggregate liability of the Supplier under this Agreement shall not exceed the amounts actually paid by Customer in the six (6) months prior to the incident.";
    const quote =
      "The total aggregate liability ... shall not exceed the amounts actually paid by Customer";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
  });

  // 11. Ellipsis quote failing when second segment is missing
  it("rejects ellipsis quote when one of the segments is missing", () => {
    const text = "The total aggregate liability of the Supplier under this Agreement.";
    const quote = "The total aggregate liability ... under nonexistent section fifty two.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("unverified");
  });

  // 12. Multiple occurrences across document (duplicates)
  it("returns all occurrences when quote appears more than once", () => {
    const text =
      "Confidentiality Obligations: Either party may disclose to affiliates. Some other text. Either party may disclose to affiliates.";
    const quote = "Either party may disclose to affiliates.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(2);
    expect(result.occurrences[0].start).not.toBe(result.occurrences[1].start);
  });

  // 13. Page number calculation from pages offset array
  it("computes correct pageStart and pageEnd from page offsets", () => {
    const page1 = "Page one text here. Introduction and recitals section.";
    const page2 = "Now starting page two: Each party agrees to keep the proprietary data strictly confidential. ";
    const page3 = "Page three follows.";
    const text = page1 + page2 + page3;
    const pages = [
      { n: 1, start: 0, end: page1.length - 1 },
      { n: 2, start: page1.length, end: page1.length + page2.length - 1 },
      { n: 3, start: page1.length + page2.length, end: text.length },
    ];
    const quote = "Each party agrees to keep the proprietary data strictly confidential.";
    const result = locateQuote(text, quote, { pages });
    expect(result.status).toBe("verified");
    expect(result.occurrences[0].pageStart).toBe(2);
    expect(result.occurrences[0].pageEnd).toBe(2);
  });

  // 14. Cross-page quotes spanning boundary
  it("computes cross-page span (e.g. page 1 to page 2)", () => {
    const page1 = "This clause begins on the first page and continues over the break into ";
    const page2 = "the second page where further terms and conditions are specified.";
    const pages = [
      { n: 1, start: 0, end: page1.length - 1 },
      { n: 2, start: page1.length, end: page1.length + page2.length },
    ];
    const text = page1 + page2;
    const quote = "continues over the break into the second page where further terms";
    const result = locateQuote(text, quote, { pages });
    expect(result.status).toBe("verified");
    expect(result.occurrences[0].pageStart).toBe(1);
    expect(result.occurrences[0].pageEnd).toBe(2);
  });

  // 15. Arabic exact match
  it("verifies Arabic contract quotes with accurate normalization", () => {
    const text = "يخضع هذا العقد وتفسيره لقوانين دولة الإمارات العربية المتحدة.";
    const quote = "يخضع هذا العقد وتفسيره لقوانين دولة الإمارات العربية المتحدة.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
  });

  // 16. Arabic tashkeel stripping
  it("matches Arabic text ignoring tashkeel (diacritics)", () => {
    const textWithTashkeel = "يَخْضَعُ هَذَا العَقْدُ لِقَوَانِينِ دَوْلَةِ الإِمَارَاتِ.";
    const quoteNoTashkeel = "يخضع هذا العقد لقوانين دولة الإمارات.";
    const result = locateQuote(textWithTashkeel, quoteNoTashkeel);
    expect(result.status).toBe("verified");
  });

  // 17. Arabic tatweel and alef unification
  it("matches Arabic text with tatweel and varying alef forms", () => {
    const text = "يلـتـزم الـطـرف الأول بـإخـطـار الطرف الآخر خطيا.";
    const quote = "يلتزم الطرف الاول باخطار الطرف الاخر خطيا.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
  });

  // 18. Arabic-Indic numbers conversion
  it("matches Arabic-Indic numerals (١٢٣ -> 123)", () => {
    const text = "تكون مدة الإخطار ثلاثون (٣٠) يوما قبل الإنهاء.";
    const quote = "تكون مدة الإخطار ثلاثون (30) يوما قبل الإنهاء.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
  });

  // 19. Resilient stripped matching for missing spaces in PDF extraction
  it("matches text when PDF dropped spaces between words (Pass 2)", () => {
    const text = "TheServiceProvider shall deliverall deliverablesto the Client on time.";
    const quote = "The Service Provider shall deliver all deliverables to the Client on time.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
    expect(result.occurrences.length).toBe(1);
  });

  // 20. Near-match detection: heavily reworded paraphrase
  it("flags high-overlap paraphrase as near_match instead of verified", () => {
    const text =
      "Either party may terminate this agreement upon thirty days written notice to the other party.";
    const paraphrase =
      "Any party may terminate this agreement upon thirty days official notice to the other party.";
    const result = locateQuote(text, paraphrase);
    expect(result.status).toBe("near_match");
    expect(result.occurrences.length).toBe(0);
  });

  // 21. Multi-document: verifies against correct document
  it("verifies quote against matching document in multi-doc map", () => {
    const docs: DocumentSource[] = [
      { id: "D1", name: "Doc1.pdf", text: "Governing law is Delaware state law." },
      { id: "D2", name: "Doc2.pdf", text: "Governing law is New York state law." },
    ];
    const vQuote = verifyQuote(
      { id: "Q1", doc: "D2", content: "Governing law is New York state law." },
      docs
    );
    expect(vQuote.status).toBe("verified");
    expect(vQuote.docId).toBe("D2");
    expect(vQuote.docName).toBe("Doc2.pdf");
  });

  // 22. Multi-document: flags wrong_document when quote is in D1 but cited as D2
  it("flags wrong_document when quote belongs to another document", () => {
    const docs: DocumentSource[] = [
      { id: "D1", name: "Doc1.pdf", text: "Governing law is Delaware state law." },
      { id: "D2", name: "Doc2.pdf", text: "Governing law is New York state law." },
    ];
    const vQuote = verifyQuote(
      { id: "Q1", doc: "D2", content: "Governing law is Delaware state law." },
      docs
    );
    expect(vQuote.status).toBe("unverified");
    expect(vQuote.reason).toBe("not_found");
  });

  // 23. Stream parser emits text deltas and parses quote tags
  it("stream parser splits prose text and verifies complete quote tag", () => {
    const docs: DocumentSource[] = [
      {
        id: "D1",
        name: "Contract.pdf",
        text: "The Supplier liability shall be limited to one hundred thousand dollars.",
      },
    ];
    const parser = new QuoteStreamParser(docs);

    const chunk1 = "Liability is capped at $100k. [Q1]\n<quote id=\"Q1\" doc=\"D1\">";
    const chunk2 = "The Supplier liability shall be limited to one hundred thousand dollars.</quote>";
    const chunk3 = "\nThis concludes the section.";

    const events1 = parser.feed(chunk1);
    const events2 = parser.feed(chunk2);
    const events3 = parser.feed(chunk3);
    const flushEvents = parser.flush();

    const allEvents = [...events1, ...events2, ...events3, ...flushEvents];
    const quoteEvents = allEvents.filter((e) => e.type === "quote");
    const textEvents = allEvents.filter((e) => e.type === "text");

    expect(quoteEvents.length).toBe(1);
    if (quoteEvents[0].type === "quote") {
      expect(quoteEvents[0].quote.status).toBe("verified");
      expect(quoteEvents[0].quote.id).toBe("Q1");
      expect(quoteEvents[0].quote.docId).toBe("D1");
    }
    expect(textEvents.length).toBeGreaterThan(0);
  });

  // 24. Stream parser handles split tags across multiple small token deltas
  it("stream parser handles tags split across tiny streaming chunks", () => {
    const docs: DocumentSource[] = [
      {
        id: "D1",
        name: "Contract.pdf",
        text: "Notice period is thirty days prior to expiration.",
      },
    ];
    const parser = new QuoteStreamParser(docs);

    // Chunks split arbitrarily
    const stream = [
      "Notice ",
      "rule: ",
      "<qu",
      "ote ",
      'id="Q1" ',
      'doc="D1">',
      "Notice period ",
      "is thirty days ",
      "prior to expiration.",
      "</qu",
      "ote>",
      " Done.",
    ];

    let foundQuote = false;
    for (const chunk of stream) {
      const events = parser.feed(chunk);
      for (const ev of events) {
        if (ev.type === "quote") {
          foundQuote = true;
          expect(ev.quote.status).toBe("verified");
        }
      }
    }
    parser.flush();
    expect(foundQuote).toBe(true);
  });

  // 25. Non-breaking spaces and zero-width spaces
  it("normalizes non-breaking spaces (\u00A0) and removes zero-width characters", () => {
    const text = "Term\u00A0of\u200Bthe\u00A0Agreement\u200Cshall be three years.";
    const quote = "Term of the Agreement shall be three years.";
    const result = locateQuote(text, quote);
    expect(result.status).toBe("verified");
  });

  // 26. Always slices verbatim text from the document, not trusting the model
  it("returns matchedText from document slicing, preserving original formatting", () => {
    const text = "THE SUPPLIER SHALL INDEMNIFY THE CUSTOMER AGAINST ALL CLAIMS.";
    const modelQuote = "The supplier shall indemnify the customer against all claims.";
    const result = locateQuote(text, modelQuote);
    expect(result.status).toBe("verified");
    // Verify matchedText retains original uppercase
    expect(result.matchedText).toBe("THE SUPPLIER SHALL INDEMNIFY THE CUSTOMER AGAINST ALL CLAIMS.");
  });
});
