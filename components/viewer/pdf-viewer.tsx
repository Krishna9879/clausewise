"use client";

import React, { useState, useEffect, forwardRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

interface PdfViewerProps {
  documentId: string;
  documentName: string;
  targetPage?: number;
  onPageChange?: (page: number) => void;
  onTextLayerRendered?: () => void;
}

export const PdfViewer = forwardRef<HTMLDivElement, PdfViewerProps>(
  ({ documentId, targetPage, onPageChange, onTextLayerRendered }, ref) => {

    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.1);
    const [pdfError, setPdfError] = useState<string | null>(null);

    useEffect(() => {
      // Configure pdfjs worker to unpkg or reliable CDN
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }, []);

    // When targetPage changes externally (e.g. from citation click), jump to it
    useEffect(() => {
      if (targetPage && targetPage >= 1 && (!numPages || targetPage <= numPages)) {
        setCurrentPage(targetPage);
        onPageChange?.(targetPage);
      }
    }, [targetPage, numPages, onPageChange]);

    const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setPdfError(null);
    };

    const handleDocumentLoadError = (err: Error) => {
      console.error("PDF load error:", err);
      setPdfError("Unable to render PDF binary. You can view the document in clean text mode.");
    };

    const changePage = (offset: number) => {
      setCurrentPage((prev) => {
        const next = Math.max(1, Math.min(prev + offset, numPages || 1));
        onPageChange?.(next);
        return next;
      });
    };

    return (
      <div className="flex h-full w-full flex-col bg-muted/30">
        {/* PDF Viewer Sub-Toolbar */}
        <div className="flex h-11 items-center justify-between border-b bg-card/60 px-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage <= 1}
              onClick={() => changePage(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-muted-foreground px-1">
              Page {currentPage} of {numPages || "..."}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!numPages || currentPage >= numPages}
              onClick={() => changePage(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-12 text-center text-[11px] text-muted-foreground font-mono">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setScale(1.1)}
              title="Reset Zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* PDF Document Canvas & Text Layer Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center select-text">
          <div ref={ref} className="pdf-container relative max-w-full shadow-lg rounded-md bg-white">
            {pdfError ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-destructive max-w-md">
                <p className="font-semibold mb-1">Preview Notice</p>
                <p className="text-xs text-muted-foreground">{pdfError}</p>
              </div>
            ) : (
              <Document
                file={`/api/documents/${documentId}/file`}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={
                  <div className="flex h-96 w-80 md:w-[500px] flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs">Loading PDF document...</span>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  onRenderTextLayerSuccess={() => {
                    onTextLayerRendered?.();
                  }}
                  className="overflow-hidden rounded-md"
                />
              </Document>
            )}
          </div>
        </div>
      </div>
    );
  }
);

PdfViewer.displayName = "PdfViewer";
