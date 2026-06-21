import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Devanagari,
  Bricolage_Grotesque,
  Hanken_Grotesk,
  JetBrains_Mono,
  Tiro_Devanagari_Hindi,
} from "next/font/google";
import "./globals.css";
import GalaxyMount from "@/components/galaxy/galaxy-mount";

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

const plexDevanagari = IBM_Plex_Sans_Devanagari({
  variable: "--font-ibm-deva",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/* ---- Landing identity: a human voice, an interface voice, a machine voice ---- */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

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

const tiroDevanagari = Tiro_Devanagari_Hindi({
  variable: "--font-tiro",
  subsets: ["devanagari"],
  weight: ["400"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${plexDevanagari.variable} ${bricolage.variable} ${hanken.variable} ${jetbrains.variable} ${tiroDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink-950 text-ink-100 font-sans">
        <GalaxyMount />
        {children}
      </body>
    </html>
  );
}
