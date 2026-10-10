import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { comparisons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ComparisonView } from "@/components/compare/comparison-view";
import { FullComparisonReport } from "@/lib/compare/analyzer";
import Link from "next/link";
import { ArrowLeft, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const comp = await db.query.comparisons.findFirst({
    where: eq(comparisons.id, id),
  });

  if (!comp || !comp.result) {
    notFound();
  }

  const report = comp.result as unknown as FullComparisonReport;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b px-6 bg-card">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm truncate max-w-md">
              Comparison Analysis
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-emerald-600">Complete</span>
        </div>
      </header>

      {/* Main Comparison View */}
      <ComparisonView report={report} />
    </div>
  );
}
