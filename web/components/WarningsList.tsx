"use client";

import { Warning } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

export default function WarningsList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="border-2 border-[var(--color-tier-yellow-border)] bg-[var(--color-tier-yellow-bg)] rounded-xl p-5">
      <h3 className="text-[var(--color-tier-yellow)] font-semibold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
        <AlertTriangle size={16} />
        Warnings ({warnings.length})
      </h3>
      <ul className="space-y-2">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
            <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--color-tier-yellow)]" />
            {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
