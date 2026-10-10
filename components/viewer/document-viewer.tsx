"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FileText, ChevronLeft, ChevronRight, Search, Eye, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { PdfViewer } from "./pdf-viewer";
import { DocxViewer } from "./docx-viewer";
import { highlightQuoteInDom, clearHighlights, HighlightResult } from "@/lib/text/dom-index";
import { VerifiedQuote } from "@/lib/verify/quotes";
import { toast } from "sonner";

export interface ViewerDocument {
  id: string;
  name: string;
  mime: string;
  text?: string | null;
  html?: string | null;
  pageCount?: number | null;
  label?: string; // e.g. "D1", "D2"
}

interface DocumentViewerProps {
  documents: ViewerDocument[];
  activeDocumentId: string;
  onSelectDocument?: (docId: string) => void;
  activeQuote?: VerifiedQuote | null;
}

export function DocumentViewer({
  documents,
  activeDocumentId,
  onSelectDocument,
  activeQuote,
}: DocumentViewerProps) {
  const [currentDocId, setCurrentDocId] = useState(activeDocumentId);
  const [viewMode, setViewMode] = useState<"render" | "text">("render");
  const [targetPage, setTargetPage] = useState<number | undefined>(undefined);
  const [highlightState, setHighlightState] = useState<HighlightResult | null>(null);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Sync internal document id when activeDocumentId prop updates
  useEffect(() => {
    if (activeDocumentId && activeDocumentId !== currentDocId) {
      setCurrentDocId(activeDocumentId);
    }
  }, [activeDocumentId, currentDocId]);

  const currentDoc = documents.find((d) => d.id === currentDocId) || documents[0];

  const applyDomHighlight = useCallback(
    (quoteText: string, matchIdx = 0) => {
      if (!viewerContainerRef.current) return;

      const result = highlightQuoteInDom(
        viewerContainerRef.current,
        quoteText,
        matchIdx
      );

      if (result.success) {
        setHighlightState(result);
        setCurrentMatchIdx(result.activeMatchIndex);
      } else {
        setHighlightState(null);
        toast.info("Passage is verified, jumping to citation page", {
          description: "Visual text layer could not highlight inline.",
        });
      }
    },
    []
  );

  // When activeQuote arrives from chat click:
  useEffect(() => {
    if (!activeQuote) {
      clearHighlights();
      setHighlightState(null);
      return;
    }

    // If quote specifies a document ID or doc label like "D1", "D2", switch to it
    if (activeQuote.docId) {
      const targetDoc = documents.find(
        (d, idx) =>
          d.id === activeQuote.docId ||
          `D${idx + 1}` === activeQuote.docId ||
          d.label === activeQuote.docId
      );
      if (targetDoc && targetDoc.id !== currentDocId) {
        setCurrentDocId(targetDoc.id);
        onSelectDocument?.(targetDoc.id);
      }
    }

    // Page jump if available
    const pageNum = activeQuote.occurrences?.[0]?.pageStart;
    if (pageNum) {
      setTargetPage(pageNum);
    }

    // Give DOM time to settle or render text layer
    const timer = setTimeout(() => {
      applyDomHighlight(activeQuote.text, 0);
    }, 250);

    return () => clearTimeout(timer);
  }, [activeQuote, currentDocId, documents, onSelectDocument, applyDomHighlight]);

  const handleNextMatch = () => {
    if (!highlightState || highlightState.matchCount <= 1) return;
    const nextIdx = (currentMatchIdx + 1) % highlightState.matchCount;
    if (activeQuote?.text) {
      applyDomHighlight(activeQuote.text, nextIdx);
    }
  };

  const handlePrevMatch = () => {
    if (!highlightState || highlightState.matchCount <= 1) return;
    const prevIdx =
      (currentMatchIdx - 1 + highlightState.matchCount) % highlightState.matchCount;
    if (activeQuote?.text) {
      applyDomHighlight(activeQuote.text, prevIdx);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    applyDomHighlight(searchQuery.trim(), 0);
  };

  if (!currentDoc) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No document selected.
      </div>
    );
  }

  const isPdf = currentDoc.mime === "application/pdf" || currentDoc.name.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex h-full w-full flex-col bg-background select-text">
      {/* Viewer Header / Document Tabs */}
      <div className="flex h-14 items-center justify-between border-b px-4 bg-card">
        {/* Document Tabs Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[55%] py-1">
          {documents.map((doc, idx) => {
            const label = doc.label || `D${idx + 1}`;
            const isSelected = doc.id === currentDoc.id;
            return (
              <button
                key={doc.id}
                onClick={() => {
                  setCurrentDocId(doc.id);
                  onSelectDocument?.(doc.id);
                  clearHighlights();
                  setHighlightState(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <span
                  className={`rounded px-1 text-[10px] font-bold ${
                    isSelected ? "bg-primary-foreground/20 text-white" : "bg-card text-foreground"
                  }`}
                >
                  {label}
                </span>
                <span className="truncate max-w-[140px]">{doc.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls & Match Navigator */}
        <div className="flex items-center gap-2">
          {/* Duplicate Match Navigator */}
          {highlightState && highlightState.matchCount > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              <span className="font-semibold text-[11px]">
                Match {currentMatchIdx + 1} of {highlightState.matchCount}
              </span>
              {highlightState.matchCount > 1 && (
                <div className="flex items-center ml-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={handlePrevMatch}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={handleNextMatch}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Quick Search */}
          <form onSubmit={handleManualSearch} className="relative hidden xl:flex items-center">
            <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find in document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-36 rounded-md border bg-background pl-7 pr-2 text-xs outline-none focus:w-48 transition-all focus:border-primary"
            />
          </form>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs rounded-md ${
                viewMode === "render" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground"
              }`}
              onClick={() => setViewMode("render")}
              title="Rendered Layout"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs rounded-md ${
                viewMode === "text" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground"
              }`}
              onClick={() => setViewMode("text")}
              title="Canonical Text"
            >
              <FileCode2 className="h-3.5 w-3.5 mr-1" />
              Text
            </Button>
          </div>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === "render" ? (
          isPdf ? (
            <PdfViewer
              ref={viewerContainerRef}
              documentId={currentDoc.id}
              documentName={currentDoc.name}
              targetPage={targetPage}
              onTextLayerRendered={() => {
                if (activeQuote?.text) {
                  applyDomHighlight(activeQuote.text, currentMatchIdx);
                }
              }}
            />
          ) : (
            <DocxViewer
              ref={viewerContainerRef}
              document={{
                id: currentDoc.id,
                name: currentDoc.name,
                html: currentDoc.html,
                text: currentDoc.text,
              }}
            />
          )
        ) : (
          /* Canonical Text View */
          <div className="h-full w-full overflow-y-auto bg-muted/20 p-6 md:p-10 select-text">
            <div
              ref={viewerContainerRef}
              className="mx-auto max-w-3xl rounded-xl bg-card border p-8 md:p-12 shadow-sm font-serif text-sm leading-relaxed space-y-4"
            >
              <div className="border-b pb-4 mb-6 font-sans">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Canonical Text</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">{currentDoc.name}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Extracted text &bull; {currentDoc.text?.length || 0} characters &bull; {currentDoc.pageCount || 1} pages
                </p>
              </div>

              <div className="whitespace-pre-wrap text-foreground/90 leading-7">
                {currentDoc.text || "No canonical text available."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
