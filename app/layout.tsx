import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Hanken_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

/* ---- Functional routes (/verify · /v · /employer) keep the Plex superfamily ---- */
const plexSans = IBM_Plex_Sans({
  variable: "--font-ibm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* ---- Landing voices: body (Hanken), machine/data (JetBrains Mono).
       Display = General Sans (Fontshare), loaded via <link> below — Fontshare is
       not in next/font/google, so we link its swap-display stylesheet directly. ---- */
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jet",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HireProof — Prove you're a real human with real AI judgment",
  description:
    "A candidate-owned, cryptographically-signed credential that proves a job applicant is a real, live human with real AI-collaboration judgment — verifiable by any employer in seconds, re-checked every round. Privacy-first for DPDP and the EU AI Act.",
  applicationName: "HireProof",
  keywords: [
    "hiring integrity",
    "deepfake hiring fraud",
    "proxy interview",
    "verifiable credential",
    "AI collaboration skill",
    "liveness",
    "DPDP",
    "EU AI Act",
  ],
};

// Set the landing theme before first paint (no flash). Functional routes ignore
// data-theme; only the landing's tokens read it.
const themeInit = `(function(){try{var t=localStorage.getItem('hp-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${hanken.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* General Sans (landing display only) — loaded NON-render-blocking so it
            never delays first paint on any route. media="print" keeps it off the
            critical path; the script flips it to "all" once loaded. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          id="gs-font"
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=general-sans@500,600,700&display=swap"
          media="print"
        />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var l=document.getElementById('gs-font');if(!l)return;l.onload=function(){l.media='all';l.onload=null;};setTimeout(function(){l.media='all';},1500);})();` }} />
        <noscript>
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f%5B%5D=general-sans@500,600,700&display=swap" />
        </noscript>
      </head>
      <body className="min-h-full flex flex-col bg-ink-950 text-ink-100 font-sans">
        {children}
      </body>
    </html>
  );
}
