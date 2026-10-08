import { getDocumentProxy, extractText } from "unpdf";
import { PageOffset } from "@/lib/text/locate";

export interface PdfExtractionResult {
  text: string;
  pages: PageOffset[];
  pageCount: number;
  emptyPageCount: number;
  isScannedOnly: boolean;
}

/**
 * Extracts text and per-page boundary offsets from a PDF buffer using unpdf.
 * Detects empty/scanned pages conforming to PLAN.md Section 5.
 */
export async function extractPdf(buffer: Uint8Array): Promise<PdfExtractionResult> {
  const pdf = await getDocumentProxy(buffer);
  const totalPages = pdf.numPages;

  const pageTexts: { n: number; text: string }[] = [];
  let emptyPageCount = 0;

  for (let i = 1; i <= totalPages; i++) {
    const pageTextResult = await extractText(pdf, { mergePages: false });
    const pageStr = (pageTextResult?.text?.[i - 1] ?? "").trim();

    // Readable character test: if < 25 readable characters, mark as empty/scanned
    const readableChars = pageStr.replace(/\s+/g, "").length;
    if (readableChars < 25) {
      emptyPageCount++;
    }

    pageTexts.push({ n: i, text: pageStr });
  }

  // Scanned PDF detection: if >= 90% of pages have < 25 chars -> isScannedOnly = true
  const isScannedOnly = totalPages > 0 && emptyPageCount / totalPages >= 0.9;

  let fullText = "";
  const pages: PageOffset[] = [];

  for (let i = 0; i < pageTexts.length; i++) {
    const item = pageTexts[i];
    const start = fullText.length;
    fullText += item.text;
    const end = fullText.length;

    pages.push({
      n: item.n,
      start,
      end,
      charCount: item.text.length,
    });

    if (i < pageTexts.length - 1) {
      fullText += "\n\n";
    }
  }

  return {
    text: fullText,
    pages,
    pageCount: totalPages,
    emptyPageCount,
    isScannedOnly,
  };
}
