"use client";

import { useRef, useState, useEffect } from "react";
import { FieldResult as FieldResultType, ScanTier } from "@/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import FixSuggestion from "./FixSuggestion";

const tierBadge: Record<ScanTier, { bg: string; text: string; label: string; border: string }> = {
  RED: { bg: "bg-[var(--color-tier-red-bg)]", text: "text-[var(--color-tier-red)]", label: "FAIL", border: "border-l-[var(--color-tier-red)]" },
  YELLOW: { bg: "bg-[var(--color-tier-yellow-bg)]", text: "text-[var(--color-tier-yellow)]", label: "WARN", border: "border-l-[var(--color-tier-yellow)]" },
  GREEN: { bg: "bg-[var(--color-tier-green-bg)]", text: "text-[var(--color-tier-green)]", label: "PASS", border: "border-l-[var(--color-tier-green)]" },
};

export default function FieldResult({ result }: { result: FieldResultType }) {
  const [open, setOpen] = useState(result.tier !== "GREEN");
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(
    result.tier !== "GREEN" ? undefined : 0
  );
  const badge = tierBadge[result.tier];

  useEffect(() => {
    if (!contentRef.current) return;
    if (open) {
      setHeight(contentRef.current.scrollHeight);
      // After transition, switch to auto so content can reflow
      const timer = setTimeout(() => setHeight(undefined), 200);
      return () => clearTimeout(timer);
    } else {
      // Set explicit height first so transition works from a known value
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [open]);

  return (
    <div className={`border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden border-l-[3px] ${badge.border}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
      >
        <span className="text-stone-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="flex-1 text-sm font-medium text-stone-800 dark:text-stone-200">
          {result.displayName}
        </span>
        <span
          className={`${badge.bg} ${badge.text} text-xs font-bold px-2 py-0.5 rounded`}
        >
          {badge.label}
        </span>
      </button>

      <div
        ref={contentRef}
        style={{ height: height !== undefined ? `${height}px` : "auto" }}
        className="transition-[height] duration-200 ease-in-out overflow-hidden"
      >
        <div className="border-t border-stone-100 dark:border-stone-700 px-4 py-4 space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">{result.rationale}</p>

          {result.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                Suggestions
              </h4>
              {result.suggestions.map((s, i) => (
                <FixSuggestion key={i} suggestion={s} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span>Source: {result.evidence.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
