import Link from "next/link";
import { ShieldCheck, Scale, Bot, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploadZone } from "@/components/upload/file-upload-zone";
import { DocumentLibrary } from "@/components/library/document-library";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">ClauseWise</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Legal Tech
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild size="sm">
              <Link href="/compare">Compare Docs</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="#upload">
                <Upload className="mr-1.5 h-4 w-4" />
                Upload Contract
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-12">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Contract Intelligence with{" "}
              <span className="text-primary underline decoration-primary/30 underline-offset-8">
                Verified Quotes
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground text-lg">
              Never trust hallucinated citations. Every quote is verified against canonical document
              offsets, jump-highlighted in the viewer, and backed by comprehensive coverage honesty.
            </p>
          </div>

          {/* Upload Section */}
          <div id="upload" className="scroll-mt-24">
            <FileUploadZone />
          </div>

          {/* Document Library */}
          <div>
            <DocumentLibrary />
          </div>

          <div className="grid gap-6 md:grid-cols-3 pt-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">Verified Quotes Engine</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Algorithmically located in document text. Whitespace and hyphenation-tolerant.
                Unverified citations are never shown as genuine.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 mb-4">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">Clause & Diff Analysis</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Compare contract revisions with deterministic change detection for caps, currencies,
                dates, and substantive risk changes.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 mb-4">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">Agentic Deep Research</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Multi-step research loop with autonomous tool calls to explore clauses, read sections,
                and provide honest coverage metrics.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
