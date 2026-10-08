import { DocumentSource, VerifiedQuote, verifyQuote } from "./quotes";

export type StreamParserEvent =
  | { type: "text"; text: string }
  | { type: "quote"; quote: VerifiedQuote };

/**
 * Streaming parser that splits incoming LLM tokens into readable prose text and verified quotes.
 * Supports <quote id="Q1" doc="D1">...</quote> tags even if tags or quotes are chunked across stream boundaries.
 */
export class QuoteStreamParser {
  private buffer = "";
  private inQuoteTag = false;
  private currentQuoteAttrs: { id: string; doc: string } | null = null;
  private currentQuoteContent = "";
  private documents: Map<string, DocumentSource>;
  private verifiedQuotes: VerifiedQuote[] = [];

  constructor(documents: DocumentSource[] | Map<string, DocumentSource>) {
    this.documents = Array.isArray(documents)
      ? new Map(documents.map((d) => [d.id, d]))
      : documents;
  }

  /**
   * Processes a new delta chunk from the LLM stream.
   * Returns parsed events: text deltas for prose and verified quote events on closing tags.
   */
  public feed(chunk: string): StreamParserEvent[] {
    const events: StreamParserEvent[] = [];
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (!this.inQuoteTag) {
        // Look for opening <quote
        const tagStart = this.buffer.indexOf("<quote");
        if (tagStart === -1) {
          // Check if buffer ends with partial "<quote"
          const partialMatch = this.getPartialOpeningTag(this.buffer);
          if (partialMatch > 0) {
            const emitText = this.buffer.slice(0, this.buffer.length - partialMatch);
            if (emitText) events.push({ type: "text", text: emitText });
            this.buffer = this.buffer.slice(this.buffer.length - partialMatch);
            break;
          }

          // No tag, emit all buffer as text
          events.push({ type: "text", text: this.buffer });
          this.buffer = "";
          break;
        }

        // Emit text up to <quote
        if (tagStart > 0) {
          events.push({ type: "text", text: this.buffer.slice(0, tagStart) });
          this.buffer = this.buffer.slice(tagStart);
        }

        // Check if full opening tag is received
        const tagEnd = this.buffer.indexOf(">");
        if (tagEnd === -1) {
          // Waiting for rest of tag
          break;
        }

        const tagStr = this.buffer.slice(0, tagEnd + 1);
        this.buffer = this.buffer.slice(tagEnd + 1);

        // Parse attributes: id="..." doc="..."
        const idMatch = tagStr.match(/id=["']([^"']+)["']/i);
        const docMatch = tagStr.match(/doc=["']([^"']+)["']/i);

        this.currentQuoteAttrs = {
          id: idMatch ? idMatch[1] : "Q1",
          doc: docMatch ? docMatch[1] : "D1",
        };
        this.inQuoteTag = true;
        this.currentQuoteContent = "";
      } else {
        // Look for closing </quote>
        const closeTag = this.buffer.indexOf("</quote>");
        if (closeTag === -1) {
          // Check if buffer ends with partial closing tag "</quote>"
          const partialClose = this.getPartialClosingTag(this.buffer);
          if (partialClose > 0) {
            this.currentQuoteContent += this.buffer.slice(0, this.buffer.length - partialClose);
            this.buffer = this.buffer.slice(this.buffer.length - partialClose);
            break;
          }

          // Entire buffer is part of quote content
          this.currentQuoteContent += this.buffer;
          this.buffer = "";
          break;
        }

        // Found closing tag
        this.currentQuoteContent += this.buffer.slice(0, closeTag);
        this.buffer = this.buffer.slice(closeTag + "</quote>".length);

        // Verify quote
        const vQuote = verifyQuote(
          {
            id: this.currentQuoteAttrs?.id || "Q1",
            doc: this.currentQuoteAttrs?.doc || "D1",
            content: this.currentQuoteContent.trim(),
          },
          this.documents
        );

        this.verifiedQuotes.push(vQuote);
        events.push({ type: "quote", quote: vQuote });

        this.inQuoteTag = false;
        this.currentQuoteAttrs = null;
        this.currentQuoteContent = "";
      }
    }

    return events;
  }

  /**
   * Flush any remaining buffered content at end of stream.
   */
  public flush(): StreamParserEvent[] {
    const events: StreamParserEvent[] = [];
    if (this.buffer) {
      if (this.inQuoteTag) {
        // Tag wasn't closed cleanly
        const vQuote = verifyQuote(
          {
            id: this.currentQuoteAttrs?.id || "Q1",
            doc: this.currentQuoteAttrs?.doc || "D1",
            content: (this.currentQuoteContent + this.buffer).trim(),
          },
          this.documents
        );
        this.verifiedQuotes.push(vQuote);
        events.push({ type: "quote", quote: vQuote });
      } else {
        events.push({ type: "text", text: this.buffer });
      }
      this.buffer = "";
    }
    return events;
  }

  public getQuotes(): VerifiedQuote[] {
    return this.verifiedQuotes;
  }

  private getPartialOpeningTag(str: string): number {
    const tag = "<quote";
    for (let len = tag.length - 1; len >= 1; len--) {
      if (str.endsWith(tag.slice(0, len))) return len;
    }
    return 0;
  }

  private getPartialClosingTag(str: string): number {
    const tag = "</quote>";
    for (let len = tag.length - 1; len >= 1; len--) {
      if (str.endsWith(tag.slice(0, len))) return len;
    }
    return 0;
  }
}
