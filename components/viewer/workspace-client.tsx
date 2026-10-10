"use client";

import React, { useState } from "react";
import { ContractChat } from "@/components/chat/contract-chat";
import { DocumentViewer, ViewerDocument } from "@/components/viewer/document-viewer";
import { VerifiedQuote } from "@/lib/verify/quotes";

interface DocumentWorkspaceClientProps {
  initialDocuments: ViewerDocument[];
}

export function DocumentWorkspaceClient({
  initialDocuments,
}: DocumentWorkspaceClientProps) {
  const [activeDocId, setActiveDocId] = useState(initialDocuments[0]?.id || "");
  const [activeQuote, setActiveQuote] = useState<VerifiedQuote | null>(null);

  const handleQuoteClick = (quote: VerifiedQuote) => {
    setActiveQuote(quote);

    // If the citation belongs to a specific document label (e.g. "D1", "D2")
    if (quote.docId) {
      const targetDoc = initialDocuments.find(
        (d, idx) =>
          d.id === quote.docId ||
          `D${idx + 1}` === quote.docId ||
          d.label === quote.docId
      );
      if (targetDoc) {
        setActiveDocId(targetDoc.id);
      }
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* Left Chat Column */}
      <div className="w-full md:w-1/2 border-r flex flex-col h-full bg-background">
        <ContractChat
          documents={initialDocuments.map((d, i) => ({
            id: d.id,
            name: d.name,
            label: d.label || `D${i + 1}`,
          }))}
          onQuoteClick={handleQuoteClick}
        />
      </div>

      {/* Right Interactive Viewer Column with Citation Highlights */}
      <div className="hidden md:flex md:w-1/2 flex-col h-full overflow-hidden bg-muted/10">
        <DocumentViewer
          documents={initialDocuments}
          activeDocumentId={activeDocId}
          onSelectDocument={setActiveDocId}
          activeQuote={activeQuote}
        />
      </div>
    </div>
  );
}
