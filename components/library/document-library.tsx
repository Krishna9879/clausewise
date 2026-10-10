"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

export interface DocItem {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: "uploading" | "queued" | "extracting" | "chunking" | "embedding" | "ready" | "failed";
  statusDetail?: string;
  progress: number;
  errorCode?: string;
  errorMessage?: string;
  pageCount?: number;
  charCount?: number;
  emptyPageCount?: number;
  lang?: string;
  createdAt: string;
}

export function DocumentLibrary() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const { data: documents, isLoading } = useQuery<DocItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
    // Poll every 2 seconds if any document is processing
    refetchInterval: (query) => {
      const docs = query.state.data;
      const isProcessing = docs?.some(
        (d) => d.status !== "ready" && d.status !== "failed"
      );
      return isProcessing ? 2000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Document removed");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete");
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <h4 className="font-semibold text-sm">No documents uploaded yet</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a contract above to begin analysis with citation verification.
        </p>
      </div>
    );
  }

  const multiChatUrl =
    selectedIds.length > 0
      ? `/d/${selectedIds[0]}${
          selectedIds.length > 1 ? `?docs=${selectedIds.slice(1).join(",")}` : ""
        }`
      : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Document Library ({documents.length})</h3>
          {selectedIds.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {selectedIds.length} selected
            </span>
          )}
        </div>

        {selectedIds.length >= 2 && (
          <Button asChild size="sm" className="shadow-xs animate-in fade-in">
            <Link href={multiChatUrl}>
              Multi-Document Chat ({selectedIds.length}) &rarr;
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {documents.map((doc) => {
          const isReady = doc.status === "ready";
          const isFailed = doc.status === "failed";
          const isProcessing = !isReady && !isFailed;
          const isSelected = selectedIds.includes(doc.id);

          return (
            <div
              key={doc.id}
              className={`flex items-center justify-between rounded-xl border bg-card p-4 transition-all hover:shadow-xs ${
                isSelected ? "border-primary/60 ring-1 ring-primary/40 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Multi-select checkbox */}
                {isReady && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(doc.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                    title="Select for multi-document chat"
                  />
                )}

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate max-w-xs">{doc.name}</span>
                    {doc.lang && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-semibold text-muted-foreground">
                        {doc.lang}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                    {doc.pageCount && <span>• {doc.pageCount} pages</span>}
                    {doc.emptyPageCount ? (
                      <span className="text-amber-600 font-medium">
                        • {doc.emptyPageCount} empty page(s)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Stepper / Status Display */}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs text-primary font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>
                      {doc.statusDetail || doc.status} ({doc.progress}%)
                    </span>
                  </div>
                )}

                {isReady && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </span>
                )}

                {isFailed && (
                  <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive max-w-sm truncate">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{doc.errorMessage || "Processing failed"}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {isReady && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/d/${doc.id}`}>
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Analyze
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete ${doc.name}?`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

