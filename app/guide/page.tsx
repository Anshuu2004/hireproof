import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guide — HireProof",
  description: "How HireProof works, in plain language — for candidates and employers. What it proves, your privacy, and a glossary of every term.",
};

/* inline icons (server-safe) */
const ArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M16 10H5M9 5L4 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Tick = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CANDIDATE_STEPS: [string, string][] = [
  ["Give consent", "Pick your language (English / हिंदी / తెలుగు) and allow camera + mic. Consent is itemised — you see exactly what's captured and nothing is bundled or hidden."],
  ["Prove you're live", "A 2-minute randomised face + voice challenge, generated the instant you start. Because it's random and live, a photo, a recording, a deepfake avatar, or a stand-in can't pre-stage it."],
  ["Show your judgment", "You're handed an AI that is confidently wrong — your task has a hidden, planted mistake. You're scored on whether you catch it and correct it. Ship the AI's flawed answer as-is and your score is capped."],
  ["Mint your credential", "You get a portable, cryptographically-signed credential plus a private holder key — shown once, so save it. The key proves the credential is yours, not just whoever holds the QR."],
  ["Reuse it anywhere", "Share the QR or token with any employer. They verify it in seconds — no account, even offline. Earn it once, reuse it for every application."],
];

const EMPLOYER_STEPS: [string, string][] = [
  ["Verify a credential", "Scan the candidate's QR or paste their token at /v. The Ed25519 signature is checked against our published key — tamper-evident, and it works even if our servers are down."],
  ["Read the evidence", "See a verified-human + AI-judgment record with an explainable breakdown — every score line is anchored, never a black-box number. No emotion or personality is ever inferred."],
  ["Re-verify across rounds", "Run the live check again each round. A cross-round face match flags proxy and seat-swap rings — the person who applied is the person who shows up."],
  ["Govern the lifecycle", "Sign in to the employer console to revoke a credential or read its hash-chained audit trail. Every action is logged and tamper-evident."],
];

const PRIVACY: string[] = [
  "Your camera feed never leaves your device — only a privacy-preserving math fingerprint and derived signals are stored.",
  "No emotion, confidence, age, or personality is ever inferred. Only task judgment is scored — by law and by design (EU AI Act).",
  "Consent is itemised and erasable. Erase everything anytime by revoking your credential (DPDP Section 12).",
];

const PROOF: [boolean, string][] = [
  [true, "A live human passed a randomised liveness check at issuance."],
  [true, "A measured AI-collaboration judgment score — not affect or personality."],
  [true, "The same person, re-verified across interview rounds."],
  [false, "Not a legal-identity or KYC document."],
  [false, "Challenge-response liveness — not a certified anti-deepfake PAD (a certified vendor is the production swap-in)."],
];

const GLOSSARY: [string, string][] = [
  ["Liveness", "Proof you're a real person on camera right now — not a photo, a video, or a deepfake."],
  ["Cross-round match", "Checking it's the same face across interview rounds, so nobody can be swapped in later."],
  ["AI-collaboration judgment", "Whether you can catch and correct an AI when it's wrong — the skill that matters once everyone can prompt one."],
  ["Ed25519 signature", "The cryptographic math that makes the credential impossible to forge — change one field and it breaks."],
  ["did:web", "Where we publish our public key, so anyone can verify a credential offline without trusting us."],
  ["W3C Verifiable Credential", "An open, global standard — so the credential isn't locked to us; it works anywhere."],
  ["Holder key", "Your private secret that proves the credential belongs to you, not just whoever is holding the QR."],
];

function Header() {
  return (
    <header className="lp-nav" data-scrolled="true">
      <div className="lp-container lp-nav-inner">
        <Link href="/" className="lp-back">
          <ArrowLeft /> Back to home
        </Link>
        <Link href="/" className="lp-wordmark" aria-label="HireProof — home">
          <span className="lp-seal" aria-hidden="true"><Tick /></span>
          HireProof
        </Link>
        <Link href="/verify" className="lp-btn lp-btn--primary">Get started <ArrowRight /></Link>
      </div>
    </header>
  );
}

export default function GuidePage() {
  return (
    <div className="lp">
      <Header />
      <main className="lp-container" style={{ paddingBlock: "clamp(40px, 6vw, 72px)", maxWidth: 920 }}>
        {/* intro */}
        <p className="lp-eyebrow">user guide</p>
        <h1 className="lp-display" style={{ fontSize: "clamp(2rem, 4.4vw, 3.2rem)", marginTop: "0.6rem" }}>
          Everything, in plain language.
        </h1>
        <p className="lp-lead" style={{ marginTop: "1rem", maxWidth: "64ch" }}>
          HireProof is a credential you own that proves you&apos;re a real, live human with genuine
          AI-collaboration judgment — verifiable by any employer in seconds. Think of it as a
          tamper-proof badge you earn once and reuse everywhere. Here&apos;s how it works, end to end.
        </p>

        {/* quick nav */}
        <div className="lp-row" style={{ gap: "0.6rem", flexWrap: "wrap", marginTop: "1.4rem" }}>
          <a href="#candidates" className="lp-chip lp-ulink">For candidates</a>
          <a href="#employers" className="lp-chip lp-ulink">For employers</a>
          <a href="#privacy" className="lp-chip lp-ulink">Privacy</a>
          <a href="#glossary" className="lp-chip lp-ulink">Glossary</a>
        </div>

        {/* for candidates — emerald */}
        <section id="candidates" className="lp-guide-card" style={{ "--ga": "var(--verify)", marginTop: "clamp(32px, 4vw, 52px)" } as React.CSSProperties}>
          <p className="lp-guide-eyebrow">for candidates</p>
          <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", marginTop: "0.5rem" }}>Earn your proof — five steps.</h2>
          <div style={{ marginTop: "1rem" }}>
            {CANDIDATE_STEPS.map(([t, d], i) => (
              <div key={t} className="lp-guide-step">
                <span className="lp-guide-num">{i + 1}</span>
                <div>
                  <p className="lp-title" style={{ fontSize: "1.02rem" }}>{t}</p>
                  <p className="lp-body" style={{ fontSize: "0.95rem", marginTop: "0.25rem", color: "var(--ink-2)" }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/verify" className="lp-btn lp-btn--primary" style={{ marginTop: "1.3rem" }}>Prove you&apos;re real <ArrowRight /></Link>
        </section>

        {/* for employers — blue */}
        <section id="employers" className="lp-guide-card" style={{ "--ga": "var(--info)", marginTop: "clamp(20px, 2.6vw, 28px)" } as React.CSSProperties}>
          <p className="lp-guide-eyebrow">for employers</p>
          <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", marginTop: "0.5rem" }}>Verify in seconds — four things.</h2>
          <div style={{ marginTop: "1rem" }}>
            {EMPLOYER_STEPS.map(([t, d], i) => (
              <div key={t} className="lp-guide-step">
                <span className="lp-guide-num">{i + 1}</span>
                <div>
                  <p className="lp-title" style={{ fontSize: "1.02rem" }}>{t}</p>
                  <p className="lp-body" style={{ fontSize: "0.95rem", marginTop: "0.25rem", color: "var(--ink-2)" }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="lp-row" style={{ gap: "0.6rem", flexWrap: "wrap", marginTop: "1.3rem" }}>
            <Link href="/v" className="lp-btn lp-btn--ghost">Verify a credential</Link>
            <Link href="/employer" className="lp-btn lp-btn--ghost">Employer console</Link>
          </div>
        </section>

        {/* privacy — amber */}
        <section id="privacy" className="lp-guide-card" style={{ "--ga": "var(--warm)", marginTop: "clamp(20px, 2.6vw, 28px)" } as React.CSSProperties}>
          <p className="lp-guide-eyebrow">your data &amp; privacy</p>
          <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", marginTop: "0.5rem" }}>What we keep — and never keep.</h2>
          <ul style={{ marginTop: "1rem", display: "grid", gap: "0.7rem" }}>
            {PRIVACY.map((t) => (
              <li key={t} className="lp-row" style={{ alignItems: "flex-start", gap: "0.6rem" }}>
                <span style={{ color: "var(--warm)", display: "inline-flex", marginTop: "0.15rem" }}><Tick /></span>
                <span className="lp-body" style={{ fontSize: "0.95rem", color: "var(--ink-2)" }}>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* what it proves — neutral */}
        <section className="lp-guide-card" style={{ "--ga": "var(--ink-2)", marginTop: "clamp(20px, 2.6vw, 28px)" } as React.CSSProperties}>
          <p className="lp-guide-eyebrow">honest scope</p>
          <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", marginTop: "0.5rem" }}>What it proves — and doesn&apos;t.</h2>
          <ul style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}>
            {PROOF.map(([ok, t]) => (
              <li key={t} className="lp-row" style={{ alignItems: "flex-start", gap: "0.6rem" }}>
                <span style={{ color: ok ? "var(--verify)" : "var(--alert)", fontFamily: "var(--lp-mono)", fontWeight: 700, marginTop: "0.05rem" }}>{ok ? "✓" : "✗"}</span>
                <span className="lp-body" style={{ fontSize: "0.95rem", color: "var(--ink-2)" }}>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* glossary — blue accent, two columns */}
        <section id="glossary" className="lp-guide-card" style={{ "--ga": "var(--info)", marginTop: "clamp(20px, 2.6vw, 28px)" } as React.CSSProperties}>
          <p className="lp-guide-eyebrow">plain-english glossary</p>
          <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)", marginTop: "0.5rem" }}>Every term, decoded.</h2>
          <dl className="lp-cols-2" style={{ marginTop: "1rem", gap: "1rem 2rem" }}>
            {GLOSSARY.map(([term, def]) => (
              <div key={term}>
                <dt className="lp-title" style={{ fontSize: "0.98rem" }}>{term}</dt>
                <dd className="lp-body" style={{ fontSize: "0.92rem", marginTop: "0.2rem", marginLeft: 0, color: "var(--ink-2)" }}>{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* closing CTA */}
        <div style={{ textAlign: "center", marginTop: "clamp(40px, 6vw, 72px)" }}>
          <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 2rem)" }}>Ready to earn yours?</h2>
          <div className="lp-row" style={{ justifyContent: "center", gap: "0.7rem", flexWrap: "wrap", marginTop: "1.2rem" }}>
            <Link href="/verify" className="lp-btn lp-btn--primary">Prove you&apos;re real <ArrowRight /></Link>
            <Link href="/" className="lp-back"><ArrowLeft /> Back to home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
