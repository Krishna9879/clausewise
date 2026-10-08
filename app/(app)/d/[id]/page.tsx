import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ContractChat } from "@/components/chat/contract-chat";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DocumentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  });

  if (!doc) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm truncate max-w-md">{doc.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{doc.pageCount ? `${doc.pageCount} pages` : "Document"}</span>
          <span>•</span>
          <span className="font-medium text-emerald-600">Ready</span>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left / Center Chat Column */}
        <div className="w-full md:w-1/2 border-r flex flex-col h-full">
          <ContractChat documentId={doc.id} documentName={doc.name} />
        </div>

        {/* Right Document Preview Column */}
        <div className="hidden md:flex md:w-1/2 flex-col h-full bg-muted/20 overflow-y-auto p-6 font-serif leading-relaxed text-sm">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="border-b pb-4">
              <h1 className="text-xl font-bold font-sans">{doc.name}</h1>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Canonical Document Text &bull; {doc.charCount || doc.text?.length || 0} characters
              </p>
            </div>
            <div className="whitespace-pre-wrap text-foreground/90 leading-7">
              {doc.text || "No text available."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
