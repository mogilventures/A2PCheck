"use client";

import { ScanResponse } from "@/lib/types";
import { ArrowUp } from "lucide-react";
import OverallTier from "./OverallTier";
import CriticalIssues from "./CriticalIssues";
import WarningsList from "./WarningsList";
import FieldResult from "./FieldResult";

export default function ScanResults({ data }: { data: ScanResponse }) {
  return (
    <div className="space-y-6">
      <OverallTier tier={data.overallTier} summary={data.overallSummary} />

      <CriticalIssues issues={data.criticalIssues} />
      <WarningsList warnings={data.warnings} />

      <div>
        <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wide mb-3">
          Field Results ({data.fieldResults.length})
        </h3>
        <div className="space-y-2">
          {data.fieldResults.map((fr) => (
            <FieldResult key={fr.field} result={fr} />
          ))}
        </div>
      </div>

      <div className="text-xs text-stone-400 border-t border-stone-200 dark:border-stone-700 pt-4 space-y-1">
        <p>
          Scan ID: {data.scanId} | Duration: {data.metadata.scanDurationMs}ms |
          Rules: {data.rulesVersion}
        </p>
        {data.metadata.quickScan && <p>Quick scan mode — URL analysis skipped</p>}
        {data.metadata.partial && (
          <p className="text-amber-600">
            Partial results — scan timed out before all checks completed
          </p>
        )}
        <p className="mt-2 italic">
          This is guidance only — not legal advice or guaranteed carrier
          approval.
        </p>
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowUp size={14} />
          Back to top
        </button>
      </div>
    </div>
  );
}
