import { locateQuote, Occurrence, PageOffset } from "../text/locate";

export interface VerifiedQuote {
  id: string; // e.g. "Q1"
  docId: string; // e.g. "D1" or UUID
  docName: string;
  text: string; // the text AS IT APPEARS IN THE DOCUMENT (sliced via offsets), not the model's version
  rawQuote: string; // the model's reported text
  status: "verified" | "near_match" | "unverified";
  reason?: "not_found" | "too_short" | "wrong_document";
  occurrences: Occurrence[];
}

export interface DocumentSource {
  id: string; // internal id or label like "D1"
  name: string;
  text: string;
  pages?: PageOffset[];
}

/**
 * Verifies a single extracted quote against the relevant document text.
 * Multi-document safe: maps doc="D1" to the corresponding document source.
 */
export function verifyQuote(
  rawQuote: { id: string; doc: string; content: string },
  documents: Map<string, DocumentSource> | DocumentSource[]
): VerifiedQuote {
  const docMap = Array.isArray(documents)
    ? new Map(documents.map((d) => [d.id, d]))
    : documents;

  const doc = docMap.get(rawQuote.doc);

  if (!doc) {
    return {
      id: rawQuote.id,
      docId: rawQuote.doc,
      docName: "Unknown Document",
      text: rawQuote.content,
      rawQuote: rawQuote.content,
      status: "unverified",
      reason: "wrong_document",
      occurrences: [],
    };
  }

  const result = locateQuote(doc.text, rawQuote.content, { pages: doc.pages });

  return {
    id: rawQuote.id,
    docId: doc.id,
    docName: doc.name,
    text: result.matchedText ?? rawQuote.content,
    rawQuote: rawQuote.content,
    status: result.status,
    reason: result.reason,
    occurrences: result.occurrences,
  };
}
