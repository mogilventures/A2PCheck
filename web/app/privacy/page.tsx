import type { Metadata } from "next";
import { Radio } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | A2PCheck",
  description:
    "How A2PCheck handles your data — what we collect, what we don't store, and which third-party services process your scan inputs.",
};

export default function Privacy() {
  return (
    <main className="flex-1">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <Radio size={24} className="text-[var(--accent)]" />
            <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              A2PCheck
            </span>
          </Link>
          <span className="text-stone-300 dark:text-stone-600 mx-2">/</span>
          <span className="text-stone-500 dark:text-stone-400 text-sm">Privacy Policy</span>
        </div>

        <div className="space-y-10">
          <section>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">Privacy Policy</h1>
            <p className="text-stone-500 dark:text-stone-400">
              A2PCheck is designed to collect as little data as possible. Here&apos;s what we do and don&apos;t store.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">What We Collect</h2>
            <div className="space-y-3 text-sm text-stone-600 dark:text-stone-400">
              <p>
                <strong className="text-stone-700 dark:text-stone-300">IP addresses</strong> — stored temporarily in Cloudflare KV for rate limiting. These entries auto-expire within hours to days and are not used for any other purpose.
              </p>
              <p>
                <strong className="text-stone-700 dark:text-stone-300">API key usage stats</strong> — if you use the API, we record <code className="text-xs bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">last_used_at</code> and <code className="text-xs bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">total_scans</code> in Cloudflare D1 to enforce rate limits.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">What We Don&apos;t Store</h2>
            <div className="space-y-3 text-sm text-stone-600 dark:text-stone-400">
              <p>
                Scan inputs, scan results, and crawled website content are processed in-memory only and are never persisted to any database or file system. Once your scan completes, that data exists only in your browser.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Third-Party Services</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-3">
              To perform scans, your inputs are sent to the following services for processing. They are not stored by A2PCheck, but are subject to each provider&apos;s own privacy policy.
            </p>
            <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 text-left">
                    <th scope="col" className="px-4 py-2 font-medium text-stone-600 dark:text-stone-400">Service</th>
                    <th scope="col" className="px-4 py-2 font-medium text-stone-600 dark:text-stone-400">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-stone-600 dark:text-stone-400">
                  <tr className="border-b border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-2">Cloudflare</td>
                    <td className="px-4 py-2">Hosting, KV (rate limiting), D1 (API key stats)</td>
                  </tr>
                  <tr className="border-b border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-2">Firecrawl</td>
                    <td className="px-4 py-2">Website crawling (privacy policy, terms, opt-in pages)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">OpenRouter</td>
                    <td className="px-4 py-2">AI analysis of campaign content</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Cookies</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              A2PCheck does not use cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Data Retention</h2>
            <div className="space-y-3 text-sm text-stone-600 dark:text-stone-400">
              <p>
                Rate limit counters (IP-based) expire automatically within hours to days. API key records persist for the lifetime of the key.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Contact</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Questions about this policy? Reach us at{" "}
              <a
                href="mailto:hello@mogilventures.com"
                className="text-[var(--accent)] underline hover:opacity-80 transition-opacity"
              >
                hello@mogilventures.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
