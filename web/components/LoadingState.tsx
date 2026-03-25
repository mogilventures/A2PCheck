"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const phases = [
  { label: "Validating input...", duration: 500 },
  { label: "Running compliance checks...", duration: 3000 },
  { label: "Analyzing with AI...", duration: 8000 },
  { label: "Crawling URLs...", duration: 5000 },
  { label: "Computing results...", duration: 2000 },
];

const quickPhases = [
  { label: "Validating input...", duration: 500 },
  { label: "Running compliance checks...", duration: 2000 },
  { label: "Analyzing with AI...", duration: 5000 },
  { label: "Computing results...", duration: 1000 },
];

export default function LoadingState({ quick }: { quick: boolean }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const currentPhases = quick ? quickPhases : phases;

  useEffect(() => {
    if (phaseIndex >= currentPhases.length - 1) return;
    const timer = setTimeout(() => {
      setPhaseIndex((i) => Math.min(i + 1, currentPhases.length - 1));
    }, currentPhases[phaseIndex].duration);
    return () => clearTimeout(timer);
  }, [phaseIndex, currentPhases]);

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16 gap-4">
      <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
      <p className="text-sm text-stone-500">{currentPhases[phaseIndex].label}</p>
      <div className="w-64 bg-stone-200 dark:bg-stone-700 rounded-full h-1.5">
        <div
          className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${((phaseIndex + 1) / currentPhases.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
