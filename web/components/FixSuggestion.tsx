"use client";

import { FixSuggestion as FixSuggestionType } from "@/lib/types";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export default function FixSuggestion({ suggestion }: { suggestion: FixSuggestionType }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-sm">
      <p className="text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wide mb-1">
        {suggestion.issue}
      </p>
      <p className="text-stone-800 dark:text-stone-200">{suggestion.fix}</p>
      {suggestion.example && (
        <div className="mt-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md p-3 font-mono text-xs text-stone-600 dark:text-stone-300 relative">
          {suggestion.example}
          <button
            onClick={() => handleCopy(suggestion.example!)}
            className="absolute top-2 right-2 p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            aria-label={copied ? "Copied!" : "Copy example to clipboard"}
          >
            {copied ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <Copy size={14} />
            )}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? "Copied to clipboard" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
