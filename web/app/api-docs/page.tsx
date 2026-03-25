import type { Metadata } from "next";
import { Radio, Mail, FileDown } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Documentation | A2PCheck",
  description:
    "Integrate A2P 10DLC pre-scanning into your registration workflows with the A2PCheck API. Endpoints, authentication, request format, and examples.",
};

export default function ApiDocs() {
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
          <span className="text-stone-500 dark:text-stone-400 text-sm">API Docs</span>
        </div>

        <div className="space-y-10">
          <section>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">API Reference</h1>
            <p className="text-stone-500 dark:text-stone-400">
              Integrate A2P 10DLC pre-scanning into your registration workflows.
            </p>
            <a
              href="https://api.a2pcheck.com/api/v1/openapi.yaml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              <FileDown size={14} />
              OpenAPI Spec (YAML)
            </a>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Authentication</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-3">
              API requests require a Bearer token. Include your API key in the Authorization header.
            </p>
            <pre className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-sm font-mono text-stone-700 dark:text-stone-300 overflow-x-auto">
{`Authorization: Bearer a2p_live_your_api_key_here`}
            </pre>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Endpoints</h2>

            <div className="space-y-6">
              {/* Full Scan */}
              <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
                <div className="bg-stone-50 dark:bg-stone-800 px-4 py-3 flex items-center gap-2 border-b border-stone-200 dark:border-stone-700">
                  <span className="bg-[var(--color-tier-green-bg)] text-[var(--color-tier-green)] text-xs font-bold px-2 py-0.5 rounded">POST</span>
                  <code className="text-sm font-mono text-stone-700 dark:text-stone-300">/api/v1/scan</code>
                </div>
                <div className="p-4 text-sm text-stone-600 dark:text-stone-400 space-y-3">
                  <p>Full campaign scan with AI analysis and URL crawling. Takes 15-20 seconds.</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">Rate limit: 10/min, 100/day per API key</p>
                </div>
              </div>

              {/* Quick Scan */}
              <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
                <div className="bg-stone-50 dark:bg-stone-800 px-4 py-3 flex items-center gap-2 border-b border-stone-200 dark:border-stone-700">
                  <span className="bg-[var(--color-tier-green-bg)] text-[var(--color-tier-green)] text-xs font-bold px-2 py-0.5 rounded">POST</span>
                  <code className="text-sm font-mono text-stone-700 dark:text-stone-300">/api/v1/scan/quick</code>
                </div>
                <div className="p-4 text-sm text-stone-600 dark:text-stone-400 space-y-3">
                  <p>Quick scan skipping URL crawling. Takes 5-8 seconds. URL-dependent fields return YELLOW placeholders.</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">Rate limit: 30/min, 300/day per API key</p>
                </div>
              </div>

              {/* Health */}
              <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
                <div className="bg-stone-50 dark:bg-stone-800 px-4 py-3 flex items-center gap-2 border-b border-stone-200 dark:border-stone-700">
                  <span className="bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-bold px-2 py-0.5 rounded">GET</span>
                  <code className="text-sm font-mono text-stone-700 dark:text-stone-300">/api/v1/health</code>
                </div>
                <div className="p-4 text-sm text-stone-600 dark:text-stone-400">
                  <p>Health check endpoint. No authentication required.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Request Body</h2>
            <pre className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-xs font-mono text-stone-700 dark:text-stone-300 overflow-x-auto">
{`{
  "useCaseType": "MARKETING",          // required
  "campaignDescription": "...",         // required
  "sampleMessages": ["msg1", "msg2"],   // required, 2-5 items
  "messageFlow": "...",                 // required
  "businessName": "Acme Inc",           // optional
  "privacyPolicyUrl": "https://...",    // optional
  "websiteUrl": "https://...",          // optional
  "termsOfServiceUrl": "https://...",   // optional
  "optInKeywords": ["START"],           // optional
  "optOutKeywords": ["STOP"],           // optional
  "helpKeywords": ["HELP"],             // optional
  "optInMessage": "...",                // optional
  "optOutMessage": "...",               // optional
  "helpMessage": "...",                 // optional
  "embeddedLinks": true,                // optional
  "embeddedPhoneNumbers": false,        // optional
  "ageGatedContent": false,             // optional
  "directLending": false,               // optional
  "numberPool": false                   // optional
}`}
            </pre>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Example</h2>
            <pre className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-4 text-xs font-mono text-stone-700 dark:text-stone-300 overflow-x-auto">
{`curl -X POST https://api.a2pcheck.com/api/v1/scan \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer a2p_live_your_key" \\
  -d '{
    "useCaseType": "MARKETING",
    "campaignDescription": "Weekly promotional offers...",
    "sampleMessages": [
      "Acme: 20% off this week! Shop at acme.com/sale. Reply STOP to opt out.",
      "Acme: New arrivals just dropped! Browse at acme.com/new. Msg&data rates apply."
    ],
    "messageFlow": "Customers opt in via checkout checkbox at acme.com",
    "optOutKeywords": ["STOP"],
    "helpKeywords": ["HELP"]
  }'`}
            </pre>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3">Error Codes</h2>
            <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 text-left">
                    <th scope="col" className="px-4 py-2 font-medium text-stone-600 dark:text-stone-400">Status</th>
                    <th scope="col" className="px-4 py-2 font-medium text-stone-600 dark:text-stone-400">Code</th>
                    <th scope="col" className="px-4 py-2 font-medium text-stone-600 dark:text-stone-400">Description</th>
                  </tr>
                </thead>
                <tbody className="text-stone-600 dark:text-stone-400">
                  <tr className="border-b border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-2">400</td>
                    <td className="px-4 py-2 font-mono text-xs">VALIDATION_ERROR</td>
                    <td className="px-4 py-2">Invalid request body</td>
                  </tr>
                  <tr className="border-b border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-2">401</td>
                    <td className="px-4 py-2 font-mono text-xs">UNAUTHORIZED</td>
                    <td className="px-4 py-2">Missing or invalid API key</td>
                  </tr>
                  <tr className="border-b border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-2">403</td>
                    <td className="px-4 py-2 font-mono text-xs">FORBIDDEN</td>
                    <td className="px-4 py-2">Inactive API key</td>
                  </tr>
                  <tr className="border-b border-stone-100 dark:border-stone-700">
                    <td className="px-4 py-2">429</td>
                    <td className="px-4 py-2 font-mono text-xs">RATE_LIMITED</td>
                    <td className="px-4 py-2">Rate limit exceeded</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">500</td>
                    <td className="px-4 py-2 font-mono text-xs">INTERNAL_ERROR</td>
                    <td className="px-4 py-2">Server error</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* CTA */}
          <section className="border-2 border-stone-200 dark:border-stone-700 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200 mb-2">
              Get API Access
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              API keys are manually issued during the beta period. Contact us to request access.
            </p>
            <a
              href="mailto:hello@mogilventures.com"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Mail size={16} />
              Contact for API Access
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
