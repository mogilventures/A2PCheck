"use client";

import { CriticalIssue } from "@/lib/types";
import { CircleX } from "lucide-react";

export default function CriticalIssues({
  issues,
}: {
  issues: CriticalIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <div className="border-2 border-[var(--color-tier-red-border)] bg-[var(--color-tier-red-bg)] rounded-xl p-5">
      <h3 className="text-[var(--color-tier-red)] font-semibold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
        <CircleX size={16} />
        Critical Issues ({issues.length})
      </h3>
      <ul className="space-y-2">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
            <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-[var(--color-tier-red)]" />
            <span>
              {issue.message}
              {issue.twilioErrorCode && (
                <span className="ml-1.5 text-xs font-mono text-stone-400 dark:text-stone-500">
                  (Error {issue.twilioErrorCode})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
