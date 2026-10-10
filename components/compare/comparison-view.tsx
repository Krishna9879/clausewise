"use client";

import React, { useState } from "react";
import {
  GitCompare,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  Filter,
  ArrowUpDown,
  PlusCircle,
  MinusCircle,
  MoveRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FullComparisonReport, ClauseChangeAnalysis, SignificanceLevel } from "@/lib/compare/analyzer";

interface ComparisonViewProps {
  report: FullComparisonReport;
}

export function ComparisonView({ report }: ComparisonViewProps) {
  const [selectedSignificance, setSelectedSignificance] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [hideCosmetic, setHideCosmetic] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"significance" | "order">("significance");
  const [diffMode, setDiffMode] = useState<"inline" | "side_by_side">("inline");

  const significancePriority: Record<SignificanceLevel, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    cosmetic: 1,
  };

  // Filter changes
  const filteredChanges = report.changes.filter((c) => {
    if (hideCosmetic && c.significance === "cosmetic") return false;
    if (selectedSignificance !== "all" && c.significance !== selectedSignificance) return false;
    if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
    return true;
  });

  // Sort changes
  const sortedChanges = [...filteredChanges].sort((a, b) => {
    if (sortBy === "significance") {
      return significancePriority[b.significance] - significancePriority[a.significance];
    }
    return 0; // retain document order
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Top Hero & Executive Summary */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <GitCompare className="h-4 w-4" />
              Contract Redline & Substantive Diff
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Comparing {report.docAName} &rarr; {report.docBName}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/d/${report.docAId}?docs=${report.docBId}`}>
                Open in Workspace &rarr;
              </Link>
            </Button>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Executive Summary (Key Legal Takeaways)
          </div>
          <ul className="grid gap-2 text-sm text-foreground/90 bg-muted/30 rounded-xl p-4 border">
            {report.executiveSummary.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-bold text-primary mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Stat Chips */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t">
          {report.stats.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {report.stats.critical} Critical
            </span>
          )}
          {report.stats.high > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {report.stats.high} High
            </span>
          )}
          {report.stats.medium > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Info className="h-3.5 w-3.5" />
              {report.stats.medium} Medium
            </span>
          )}
          {report.stats.added > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
              <PlusCircle className="h-3.5 w-3.5" />
              {report.stats.added} Added
            </span>
          )}
          {report.stats.removed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600">
              <MinusCircle className="h-3.5 w-3.5" />
              {report.stats.removed} Removed
            </span>
          )}
          {report.stats.modified > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600">
              <MoveRight className="h-3.5 w-3.5" />
              {report.stats.modified} Modified
            </span>
          )}
          {report.stats.unchanged > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {report.stats.unchanged} Unchanged
            </span>
          )}
        </div>
      </div>

      {/* Filter & View Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filters:
          </div>

          <select
            value={selectedSignificance}
            onChange={(e) => setSelectedSignificance(e.target.value)}
            className="rounded-lg border bg-background px-2.5 py-1 text-xs outline-none"
          >
            <option value="all">All Significance</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="cosmetic">Cosmetic</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border bg-background px-2.5 py-1 text-xs outline-none"
          >
            <option value="all">All Categories</option>
            <option value="liability">Liability & Indemnity</option>
            <option value="payment">Payment & Fees</option>
            <option value="termination">Termination</option>
            <option value="term">Term & Renewal</option>
            <option value="confidentiality">Confidentiality</option>
            <option value="governing_law">Governing Law</option>
            <option value="IP">Intellectual Property</option>
            <option value="other">Other</option>
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={hideCosmetic}
              onChange={(e) => setHideCosmetic(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary cursor-pointer"
            />
            Hide Cosmetic Changes
          </label>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "significance" | "order")}
              className="rounded-lg border bg-background px-2.5 py-1 text-xs outline-none"
            >
              <option value="significance">Sort by Significance</option>
              <option value="order">Sort by Document Order</option>
            </select>
          </div>

          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <button
              onClick={() => setDiffMode("inline")}
              className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                diffMode === "inline" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Inline
            </button>
            <button
              onClick={() => setDiffMode("side_by_side")}
              className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                diffMode === "side_by_side" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Side-by-Side
            </button>
          </div>
        </div>
      </div>

      {/* Changes List */}
      <div className="space-y-4">
        {sortedChanges.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
            No changes match the selected filter criteria.
          </div>
        ) : (
          sortedChanges.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              diffMode={diffMode}
              docAId={report.docAId}
              docBId={report.docBId}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ChangeCard({
  change,
  diffMode,
  docAId,
  docBId,
}: {
  change: ClauseChangeAnalysis;
  diffMode: "inline" | "side_by_side";
  docAId: string;
  docBId: string;
}) {
  const getBadgeStyle = (sig: SignificanceLevel) => {
    switch (sig) {
      case "critical":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900";
      case "high":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900";
      case "medium":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900";
      case "low":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900";
      case "cosmetic":
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs transition-all space-y-4">
      {/* Change Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-foreground">
            {change.clauseNumber}
            {change.heading ? ` • ${change.heading}` : ""}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getBadgeStyle(
              change.significance
            )}`}
          >
            {change.significance}
          </span>
          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
            {change.category}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {change.textBefore && (
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={`/d/${docAId}`} target="_blank">
                Doc A <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
          {change.textAfter && (
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={`/d/${docBId}`} target="_blank">
                Doc B <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Plain Language Summary & Impact */}
      <div className="space-y-1.5 text-sm">
        <p className="font-semibold text-foreground/95">{change.summary}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground/80">Legal Impact: </span>
          {change.whyItMatters}
        </p>
      </div>

      {/* Entity/Number Diff Badges */}
      {change.numbersChanged.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {change.numbersChanged.map((num, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300 font-mono"
            >
              <span className="line-through opacity-70">{num.before}</span>
              <span>&rarr;</span>
              <span className="font-bold">{num.after}</span>
            </span>
          ))}
        </div>
      )}

      {/* Diff Rendering */}
      <div className="rounded-lg border bg-muted/20 p-4 text-xs font-serif leading-relaxed">
        {diffMode === "inline" || change.changeType === "added" || change.changeType === "removed" ? (
          <div className="whitespace-pre-wrap leading-6">
            {change.diffWords?.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-0.5 font-medium rounded-xs"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-rose-500/20 text-rose-800 dark:text-rose-300 line-through px-0.5 rounded-xs"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>
        ) : (
          /* Side by side comparison */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="space-y-1 pr-2">
              <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                Before (Doc A)
              </span>
              <p className="whitespace-pre-wrap text-foreground/80 leading-5">
                {change.textBefore}
              </p>
            </div>
            <div className="space-y-1 pt-2 md:pt-0 md:pl-4">
              <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                After (Doc B)
              </span>
              <p className="whitespace-pre-wrap text-foreground/90 leading-5">
                {change.textAfter}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
