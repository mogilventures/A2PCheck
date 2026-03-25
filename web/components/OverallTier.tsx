"use client";

import { ScanTier } from "@/lib/types";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";

const config: Record<
  ScanTier,
  {
    label: string;
    sublabel: string;
    bg: string;
    border: string;
    text: string;
    icon: typeof ShieldCheck;
  }
> = {
  GREEN: {
    label: "CLEAR TO SEND",
    sublabel: "No issues detected",
    bg: "bg-[var(--color-tier-green-bg)]",
    border: "border-[var(--color-tier-green)]",
    text: "text-[var(--color-tier-green)]",
    icon: ShieldCheck,
  },
  YELLOW: {
    label: "REVIEW RECOMMENDED",
    sublabel: "Some concerns found",
    bg: "bg-[var(--color-tier-yellow-bg)]",
    border: "border-[var(--color-tier-yellow)]",
    text: "text-[var(--color-tier-yellow)]",
    icon: AlertTriangle,
  },
  RED: {
    label: "NOT READY",
    sublabel: "Critical issues found",
    bg: "bg-[var(--color-tier-red-bg)]",
    border: "border-[var(--color-tier-red)]",
    text: "text-[var(--color-tier-red)]",
    icon: ShieldAlert,
  },
};

export default function OverallTier({
  tier,
  summary,
}: {
  tier: ScanTier;
  summary: string;
}) {
  const c = config[tier];
  const Icon = c.icon;

  return (
    <div
      className={`${c.bg} border-l-4 ${c.border} rounded-xl p-6 flex items-center gap-5`}
    >
      <div className={`${c.text} shrink-0`}>
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <div>
        <div className={`${c.text} text-3xl font-bold tracking-tight`}>
          {c.label}
        </div>
        <p className="text-stone-600 dark:text-stone-400 text-sm mt-1">{summary}</p>
      </div>
    </div>
  );
}
