"use client";

import { useState, useRef, useEffect } from "react";
import { ScanRequest, ScanResponse } from "@/lib/types";
import { submitScan, ApiError } from "@/lib/api";
import ScanForm from "@/components/ScanForm";
import ScanResults from "@/components/ScanResults";
import LoadingState from "@/components/LoadingState";
import { Radio, Clock, AlertTriangle, Github } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [results, setResults] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<{
    message: string;
    isRateLimit: boolean;
    retryAfterSeconds?: number;
  } | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results when they appear
  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [results]);

  async function handleSubmit(data: ScanRequest, quick: boolean) {
    setLoading(true);
    setQuickMode(quick);
    setResults(null);
    setError(null);

    try {
      const response = await submitScan(data, quick);
      setResults(response);
    } catch (err) {
      if (err instanceof ApiError) {
        const message = err.details
          ? `${err.message}: ${err.details.map((d) => `${d.field ? d.field + " — " : ""}${d.issue}`).join("; ")}`
          : err.message;
        setError({
          message,
          isRateLimit: err.status === 429,
          retryAfterSeconds: err.retryAfterSeconds,
        });
      } else {
        setError({
          message: "Failed to connect to the scanner API. Make sure the worker is running.",
          isRateLimit: false,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="flex-1">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12 pb-8 border-b border-stone-200 dark:border-stone-700">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-[var(--accent)] bg-[var(--accent-subtle)] px-3 py-1 rounded-full mb-4">
            A2P 10DLC Pre-Scanner
          </span>
          <div className="flex items-center justify-between w-full mb-3">
            <div className="flex items-center gap-3">
              <Radio size={28} className="text-[var(--accent)]" />
              <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                A2PCheck
              </h1>
            </div>
            <a
              href="https://github.com/mogilventures/A2PCheck"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
            >
              <Github size={22} />
            </a>
          </div>
          <p className="text-stone-500 dark:text-stone-400 text-base max-w-xl">
            Pre-scan your A2P 10DLC campaign registration before submitting.
            Catch common rejection patterns and get actionable fixes.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl p-6 sm:p-10 shadow-sm">
          <ScanForm onSubmit={handleSubmit} loading={loading} />
        </div>

        {/* API Access CTA */}
        <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
          Need to integrate into your workflow?{" "}
          <Link href="/api-docs" className="text-blue-600 hover:underline">
            Contact us for API access
          </Link>
        </p>

        {/* Loading */}
        {loading && (
          <div className="mt-8">
            <LoadingState quick={quickMode} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className={`mt-8 border-2 rounded-xl p-5 ${
              error.isRateLimit
                ? "border-[var(--color-tier-yellow-border)] bg-[var(--color-tier-yellow-bg)]"
                : "border-[var(--color-tier-red-border)] bg-[var(--color-tier-red-bg)]"
            }`}
          >
            <div className="flex items-start gap-3">
              {error.isRateLimit ? (
                <Clock size={18} className="text-amber-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p
                  className={`text-sm font-medium ${
                    error.isRateLimit ? "text-amber-800" : "text-red-700"
                  }`}
                >
                  {error.isRateLimit
                    ? `Rate limit reached. Try again in ${
                        error.retryAfterSeconds
                          ? error.retryAfterSeconds >= 60
                            ? `${Math.ceil(error.retryAfterSeconds / 60)} minute${Math.ceil(error.retryAfterSeconds / 60) > 1 ? "s" : ""}`
                            : `${error.retryAfterSeconds} second${error.retryAfterSeconds > 1 ? "s" : ""}`
                          : "a few minutes"
                      }.`
                    : error.message}
                </p>
                {error.isRateLimit && (
                  <p className="text-xs text-amber-600 mt-1">
                    This limit resets automatically. No action needed.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} aria-live="polite">
          {results && (
            <div className="mt-8">
              <ScanResults data={results} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
