import { inngest } from "./client";
import { db } from "@/lib/db/client";
import { documents, chunks, clauses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { extractPdf } from "@/lib/extract/pdf";
import { extractDocx } from "@/lib/extract/docx";
import { parseClauses } from "@/lib/extract/clause-parse";
import { chunkDocument } from "@/lib/retrieval/chunk";
import { getEmbeddings } from "@/lib/ai/embeddings";

export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    name: "Process Uploaded Contract",
    triggers: [{ event: "document/uploaded" }],
  },
  async ({
    event,
    step,
  }: {
    event: { data: { documentId: string } };
    step: {
      run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => {
    const { documentId } = event.data;

    // 1. Validate & download file
    const docMeta = await step.run("validate-download", async () => {
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, documentId),
      });

      if (!doc) throw new Error(`Document ${documentId} not found`);

      await db
        .update(documents)
        .set({ status: "extracting", statusDetail: "Downloading and inspecting file", progress: 10 })
        .where(eq(documents.id, documentId));

      const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(env.SUPABASE_BUCKET)
        .download(doc.storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download storage object: ${downloadError?.message}`);
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate magic bytes
      const isPdf = buffer.subarray(0, 4).toString() === "%PDF";
      const isDocx =
        buffer.subarray(0, 2).toString("hex") === "504b"; // PK ZIP signature

      if (!isPdf && !isDocx) {
        await db
          .update(documents)
          .set({
            status: "failed",
            errorCode: "INVALID_MAGIC_BYTES",
            errorMessage: "Corrupt or invalid document file header",
          })
          .where(eq(documents.id, documentId));
        throw new Error("Invalid document signature");
      }

      return {
        id: doc.id,
        name: doc.name,
        mime: doc.mime,
        storagePath: doc.storagePath,
        isPdf,
      };
    });

    // 2. Extract text and page offsets
    const extraction = await step.run("extract-text", async () => {
      const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: fileData } = await supabase.storage
        .from(env.SUPABASE_BUCKET)
        .download(docMeta.storagePath);

      const arrayBuffer = await fileData!.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (docMeta.isPdf) {
        const result = await extractPdf(new Uint8Array(buffer));

        if (result.isScannedOnly) {
          await db
            .update(documents)
            .set({
              status: "failed",
              errorCode: "NO_TEXT_LAYER",
              errorMessage:
                "This looks like a scanned PDF with no readable text. Please upload a text-based PDF or run OCR first.",
            })
            .where(eq(documents.id, documentId));
          throw new Error("Scanned PDF rejected");
        }

        await db
          .update(documents)
          .set({
            status: "chunking",
            statusDetail: `Extracted ${result.pageCount} pages (${result.text.length} characters)`,
            progress: 40,
            pageCount: result.pageCount,
            charCount: result.text.length,
            emptyPageCount: result.emptyPageCount,
            text: result.text,
            pages: result.pages,
          })
          .where(eq(documents.id, documentId));

        return {
          text: result.text,
          pages: result.pages,
          pageCount: result.pageCount,
          html: null,
        };
      } else {
        const result = await extractDocx(buffer);

        await db
          .update(documents)
          .set({
            status: "chunking",
            statusDetail: `Extracted DOCX document (${result.text.length} characters)`,
            progress: 40,
            pageCount: result.pageCount,
            charCount: result.text.length,
            text: result.text,
            pages: result.pages,
            html: result.html,
          })
          .where(eq(documents.id, documentId));

        return {
          text: result.text,
          pages: result.pages,
          pageCount: result.pageCount,
          html: result.html,
        };
      }
    });

    // 3. Clause parsing
    const parsedClauses = await step.run("parse-clauses", async () => {
      const clauseList = parseClauses(extraction.text);

      if (clauseList.length > 0) {
        await db.insert(clauses).values(
          clauseList.map((c) => ({
            documentId,
            number: c.number,
            heading: c.heading,
            level: c.level,
            charStart: c.charStart,
            charEnd: c.charEnd,
            text: c.text,
          }))
        );
      }

      await db
        .update(documents)
        .set({
          statusDetail: `Identified ${clauseList.length} legal clauses`,
          progress: 60,
        })
        .where(eq(documents.id, documentId));

      return clauseList;
    });

    // 4. Chunking
    const rawChunks = await step.run("chunk-document", async () => {
      const generatedChunks = chunkDocument(extraction.text, extraction.pages, parsedClauses);

      await db
        .update(documents)
        .set({
          status: "embedding",
          statusDetail: `Created ${generatedChunks.length} search sections`,
          progress: 75,
        })
        .where(eq(documents.id, documentId));

      return generatedChunks;
    });

    // 5. Embedding & indexing
    await step.run("embed-chunks", async () => {
      const chunkTexts = rawChunks.map((c: { text: string }) => c.text);
      const embeddings = await getEmbeddings(chunkTexts);

      const chunkRows = rawChunks.map(
        (
          c: {
            idx: number;
            pageStart: number;
            pageEnd: number;
            sectionLabel?: string;
            charStart: number;
            charEnd: number;
            text: string;
            tokenCount: number;
          },
          i: number
        ) => ({
          documentId,
          idx: c.idx,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          sectionLabel: c.sectionLabel,
          charStart: c.charStart,
          charEnd: c.charEnd,
          text: c.text,
          tokenCount: c.tokenCount,
          embedding: embeddings[i],
        })
      );

      // Insert in chunks of 50
      for (let i = 0; i < chunkRows.length; i += 50) {
        await db.insert(chunks).values(chunkRows.slice(i, i + 50));
      }

      // Detect language (Arabic vs Latin)
      const arabicMatches = extraction.text.match(/[\u0600-\u06FF]/g) || [];
      const lang = arabicMatches.length > extraction.text.length * 0.15 ? "ar" : "en";

      await db
        .update(documents)
        .set({
          status: "ready",
          statusDetail: "Analysis index ready",
          progress: 100,
          lang,
        })
        .where(eq(documents.id, documentId));
    });

    return { success: true, documentId };
  }
);
