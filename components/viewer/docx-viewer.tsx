"use client";

import React, { forwardRef } from "react";

interface DocxViewerProps {
  document: {
    id: string;
    name: string;
    html?: string | null;
    text?: string | null;
  };
}

export const DocxViewer = forwardRef<HTMLDivElement, DocxViewerProps>(
  ({ document }, ref) => {
    return (
      <div className="h-full w-full overflow-y-auto bg-card/50 p-6 md:p-10 select-text">
        <div
          ref={ref}
          className="mx-auto max-w-3xl rounded-xl bg-card border p-8 md:p-12 shadow-sm font-serif text-sm leading-relaxed space-y-4"
        >
          <div className="border-b pb-4 mb-6 font-sans">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{document.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">Word Document &bull; Verified Text</p>
          </div>

          {document.html ? (
            <div
              className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-sans prose-p:my-2 prose-li:my-1"
              dangerouslySetInnerHTML={{ __html: document.html }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-foreground/90 leading-7">
              {document.text || "No text available for this document."}
            </div>
          )}
        </div>
      </div>
    );
  }
);

DocxViewer.displayName = "DocxViewer";
