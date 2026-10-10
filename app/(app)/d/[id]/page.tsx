import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { DocumentWorkspaceClient } from "@/components/viewer/workspace-client";
import Link from "next/link";
import { ArrowLeft, Layers, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DocumentWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ docs?: string }>;
}) {
  const { id } = await params;
  const sParams = await searchParams;

  const docIds = [id];
  if (sParams?.docs) {
    const extra = sParams.docs.split(",").map((s) => s.trim()).filter(Boolean);
    for (const d of extra) {
      if (!docIds.includes(d)) docIds.push(d);
    }
  }

  const docRecords = await db.query.documents.findMany({
    where: inArray(documents.id, docIds),
  });

  if (docRecords.length === 0) {
    notFound();
  }

  // Ensure initial primary document comes first
  const sortedDocs = [...docRecords].sort((a, b) => {
    if (a.id === id) return -1;
    if (b.id === id) return 1;
    return 0;
  });

  const viewerDocs = sortedDocs.map((d, idx) => ({
    id: d.id,
    name: d.name,
    mime: d.mime,
    text: d.text,
    html: d.html,
    pageCount: d.pageCount,
    label: `D${idx + 1}`,
  }));

  const isMultiDoc = viewerDocs.length > 1;

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
            {isMultiDoc ? (
              <Layers className="h-4 w-4 text-primary" />
            ) : (
              <FileText className="h-4 w-4 text-primary" />
            )}
            <h2 className="font-semibold text-sm truncate max-w-md">
              {isMultiDoc
                ? `Cross-Analysis (${viewerDocs.length} Contracts)`
                : viewerDocs[0].name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{viewerDocs[0].pageCount ? `${viewerDocs[0].pageCount} pages` : "Document"}</span>
          <span>•</span>
          <span className="font-medium text-emerald-600">Verified Citations Active</span>
        </div>
      </header>

      {/* Main Workspace with Chat + Interactive Document Viewer */}
      <DocumentWorkspaceClient initialDocuments={viewerDocs} />
    </div>
  );
}
