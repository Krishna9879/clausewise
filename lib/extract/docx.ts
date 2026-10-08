import mammoth from "mammoth";
import DOMPurify from "isomorphic-dompurify";
import { PageOffset } from "@/lib/text/locate";

export interface DocxExtractionResult {
  text: string;
  html: string;
  pages: PageOffset[];
  pageCount: number;
}

/**
 * Extracts clean HTML and canonical plain text from a DOCX buffer using mammoth.
 * Conforms to PLAN.md Section 5.
 */
export async function extractDocx(buffer: Buffer): Promise<DocxExtractionResult> {
  const result = await mammoth.convertToHtml({ buffer });
  const rawHtml = result.value;
  const cleanHtml = DOMPurify.sanitize(rawHtml);

  const textResult = await mammoth.extractRawText({ buffer });
  const canonicalText = textResult.value.trim();

  // DOCX files do not have fixed physical pages in the file format;
  // we treat every ~3,000 characters as a virtual reference page so navigation and coverage work consistently.
  const pages: PageOffset[] = [];
  const pageSize = 3000;
  const totalVirtualPages = Math.max(1, Math.ceil(canonicalText.length / pageSize));

  for (let i = 0; i < totalVirtualPages; i++) {
    const start = i * pageSize;
    const end = Math.min((i + 1) * pageSize, canonicalText.length);
    pages.push({
      n: i + 1,
      start,
      end,
      charCount: end - start,
    });
  }

  return {
    text: canonicalText,
    html: cleanHtml,
    pages,
    pageCount: totalVirtualPages,
  };
}
