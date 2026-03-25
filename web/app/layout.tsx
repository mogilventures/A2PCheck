import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#292524",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://a2pcheck.com"),
  title: "A2PCheck - A2P 10DLC Campaign Pre-Scanner",
  description:
    "Pre-scan your A2P 10DLC campaign registration data against known rejection patterns. Get Red/Yellow/Green tier ratings with actionable feedback before you submit.",
  openGraph: {
    title: "A2PCheck - A2P 10DLC Campaign Pre-Scanner",
    description:
      "Catch common A2P 10DLC rejection patterns before you submit. Get actionable fixes with Red/Yellow/Green tier ratings.",
    type: "website",
    siteName: "A2PCheck",
    url: "https://a2pcheck.com",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "A2PCheck - A2P 10DLC Campaign Pre-Scanner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A2PCheck - A2P 10DLC Campaign Pre-Scanner",
    description:
      "Catch common A2P 10DLC rejection patterns before you submit. Get actionable fixes with Red/Yellow/Green tier ratings.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "A2PCheck",
                  url: "https://a2pcheck.com",
                },
                {
                  "@type": "Organization",
                  name: "A2PCheck",
                  url: "https://a2pcheck.com",
                },
              ],
            }),
          }}
        />
        {children}
        <footer className="mt-auto border-t border-stone-200 dark:border-stone-700 bg-stone-100/50 dark:bg-stone-900/50 py-6 px-4 text-center text-xs text-stone-400">
          <p>
            A2PCheck provides guidance only — not legal advice or guaranteed
            carrier approval. Twilio/TCR may apply additional unpublished checks
            beyond this scanner.
          </p>
          <p className="mt-2">
            <Link href="/privacy" className="underline hover:text-stone-600 transition-colors">Privacy Policy</Link>
          </p>
          <p className="mt-1">
            &copy; {new Date().getFullYear()} A2PCheck
          </p>
        </footer>
      </body>
    </html>
  );
}
