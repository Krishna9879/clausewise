"use client";

import React, { useState } from "react";
import { Send, Square, ShieldCheck, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { VerifiedQuote } from "@/lib/verify/quotes";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "complete" | "stopped" | "error";
  quotes?: VerifiedQuote[];
  coverage?: {
    mode: string;
    complete: boolean;
    pagesRead: number[];
    totalPages: number;
  };
}

export function ContractChat({
  documentId,
  documentName,
}: {
  documentId: string;
  documentName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userText = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    setAbortController(controller);

    const assistantMsgId = String(Date.now() + 1);
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      quotes: [],
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId],
          message: userText,
          mode: "quick",
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/event:\s*(\w+)/);
          const dataMatch = block.match(/data:\s*(.+)/);

          if (!eventMatch || !dataMatch) continue;
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "text") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content + data.delta }
                  : msg
              )
            );
          } else if (event === "quote") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, quotes: [...(msg.quotes || []), data] }
                  : msg
              )
            );
          } else if (event === "coverage") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, coverage: data }
                  : msg
              )
            );
          } else if (event === "done") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, status: data.stopped ? "stopped" : "complete" }
                  : msg
              )
            );
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error(err.message || "Failed to receive answer");
      }
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsStreaming(false);
      toast.info("Stopped response generation");
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm truncate max-w-sm">{documentName}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">Quick Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 text-primary/40 mb-3" />
            <h4 className="font-semibold text-foreground">Ask any contract question</h4>
            <p className="text-xs max-w-md mt-1">
              Every answer is verified against exact contract text. Quotes are confirmed before
              being highlighted.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-2 ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-card border shadow-sm"
                }`}
              >
                {/* Coverage Badge for Assistant */}
                {msg.role === "assistant" && msg.coverage && (
                  <div className="mb-3 flex items-center gap-2">
                    {msg.coverage.complete ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Full Coverage ({msg.coverage.totalPages} pages)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Partial ({msg.coverage.pagesRead.length} of {msg.coverage.totalPages} pages)
                      </span>
                    )}
                    {msg.status === "stopped" && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-bold text-muted-foreground">
                        Stopped
                      </span>
                    )}
                  </div>
                )}

                <div className="prose dark:prose-invert prose-sm max-w-none leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content || (isStreaming && msg.role === "assistant" ? "Thinking..." : "")}
                  </ReactMarkdown>
                </div>

                {/* Verified Quotes Cards */}
                {msg.quotes && msg.quotes.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Supporting Citations ({msg.quotes.length})
                    </p>
                    <div className="grid gap-2">
                      {msg.quotes.map((q: VerifiedQuote, idx: number) => {
                        const isVerified = q.status === "verified";
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg border p-2.5 text-xs ${
                              isVerified
                                ? "border-emerald-200 bg-emerald-500/5 dark:border-emerald-900"
                                : "border-rose-200 bg-rose-500/5 dark:border-rose-900"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`font-semibold ${
                                  isVerified ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"
                                }`}
                              >
                                {isVerified ? "Verified Citation ✓" : "Unverified ⚠"}
                              </span>
                              {q.occurrences?.[0]?.pageStart && (
                                <span className="text-[10px] text-muted-foreground">
                                  Page {q.occurrences[0].pageStart}
                                </span>
                              )}
                            </div>
                            <p className="font-serif italic text-muted-foreground line-clamp-3">
                              &ldquo;{q.text}&rdquo;
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about liability, termination, payment terms..."
            className="flex-1 rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            disabled={isStreaming}
          />

          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleStop}
              className="rounded-xl shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="rounded-xl shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
