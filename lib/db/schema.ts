import { pgTable, uuid, text, integer, jsonb, timestamp, pgEnum, customType } from "drizzle-orm/pg-core";

// Vector custom type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    if (Array.isArray(value)) return value;
    return value
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((v) => parseFloat(v));
  },
});

export const documentStatusEnum = pgEnum("document_status", [
  "uploading",
  "queued",
  "extracting",
  "chunking",
  "embedding",
  "ready",
  "failed",
]);

export const conversationModeEnum = pgEnum("conversation_mode", ["quick", "agent"]);

export const messageStatusEnum = pgEnum("message_status", ["complete", "stopped", "error"]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  contentHash: text("content_hash"),
  status: documentStatusEnum("status").notNull().default("uploading"),
  statusDetail: text("status_detail"),
  progress: integer("progress").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  pageCount: integer("page_count"),
  charCount: integer("char_count"),
  emptyPageCount: integer("empty_page_count").default(0),
  text: text("text"),
  pages: jsonb("pages"), // [{n: number, start: number, end: number, charCount: number}]
  html: text("html"),
  lang: text("lang"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  pageStart: integer("page_start").notNull(),
  pageEnd: integer("page_end").notNull(),
  sectionLabel: text("section_label"),
  charStart: integer("char_start").notNull(),
  charEnd: integer("char_end").notNull(),
  text: text("text").notNull(),
  tokenCount: integer("token_count").notNull(),
  embedding: vector("embedding"),
});

export const clauses = pgTable("clauses", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  number: text("number"),
  heading: text("heading"),
  level: integer("level").default(1),
  charStart: integer("char_start").notNull(),
  charEnd: integer("char_end").notNull(),
  text: text("text").notNull(),
});

export const clauseFindings = pgTable("clause_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // termination | liability | governing_law | ...
  status: text("status").notNull(), // found | not_found_full_scan | not_checked
  summary: text("summary"),
  quotes: jsonb("quotes"),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("New Conversation"),
  mode: conversationModeEnum("mode").notNull().default("quick"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conversationDocuments = pgTable("conversation_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // D1, D2, etc.
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  status: messageStatusEnum("status").notNull().default("complete"),
  quotes: jsonb("quotes"),
  coverage: jsonb("coverage"),
  toolTrace: jsonb("tool_trace"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comparisons = pgTable("comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  docA: uuid("doc_a")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  docB: uuid("doc_b")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  summary: text("summary"),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const anonymisations = pgTable("anonymisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  mapping: jsonb("mapping").notNull(),
  derivedDocumentId: uuid("derived_document_id").references(() => documents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
