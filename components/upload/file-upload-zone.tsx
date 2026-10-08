"use client";

import React, { useState, useRef } from "react";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function FileUploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleUpload = async (file: File) => {
    // 1. Validation
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      toast.error(`Only PDF and DOCX files are supported. '.${ext}' was rejected.`);
      return;
    }

    if (file.size === 0) {
      toast.error("File is empty (0 bytes).");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 50 MB.");
      return;
    }

    setIsUploading(true);
    setProgress(10);
    setStatusMessage("Obtaining secure upload authorization...");

    try {
      // 2. Request direct upload URL
      const res = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          sizeBytes: file.size,
          mime: file.type || (ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to initiate upload");
      }

      const { documentId, signedUrl } = await res.json();
      setProgress(40);
      setStatusMessage("Uploading directly to secure storage...");

      // 3. Direct upload to Supabase Storage via signedUrl
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file bytes to storage");
      }

      setProgress(75);
      setStatusMessage("Queuing document analysis pipeline...");

      // 4. Trigger processing
      const processRes = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      });

      if (!processRes.ok) {
        throw new Error("Failed to enqueue document processing");
      }

      setProgress(100);
      setStatusMessage("Document uploaded successfully! Analysis enqueued.");
      toast.success(`${file.name} uploaded successfully!`);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
        setStatusMessage("");
      }, 2000);
    }
  };

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed p-8 transition-colors text-center ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border bg-card/50 hover:bg-card hover:border-primary/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
          handleUpload(e.dataTransfer.files[0]);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleUpload(e.target.files[0]);
          }
        }}
      />

      {isUploading ? (
        <div className="space-y-4 py-4">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="font-semibold text-sm">{statusMessage}</p>
            <div className="mx-auto h-2 w-64 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Upload contract for analysis</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Drag and drop PDF or DOCX file up to 50 MB, or click to browse
            </p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="shadow-sm"
          >
            <FileUp className="mr-2 h-4 w-4" />
            Select Contract File
          </Button>
        </div>
      )}
    </div>
  );
}
