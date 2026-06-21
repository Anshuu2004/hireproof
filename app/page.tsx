"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MintedCredential } from "@/components/minted-credential";

/* ----------------------------------------------------------------- content */
const STATS = [
  { v: "1 in 4", l: "candidate profiles will be fake by 2028", s: "Gartner, Jul 2025" },
  { v: "100+", l: "U.S. firms infiltrated by fake remote workers", s: "U.S. DOJ, Jun 2025" },
  { v: "9.46%", l: "discrepancy rate in Indian IT/ITeS hiring", s: "AuthBridge, 2025" },
];

const SHIFT = [
  ["Detection arms race", "Forensic detectors chase ever-better deepfakes and flip to wrong under attack."],
  ["Surveillance proctoring", "Spy on every applicant, bury honest candidates in false positives."],
  ["Employer-locked tests", "Verify once, for one employer — nothing the candidate owns or reuses."],
];

const CANDIDATE_STEPS = [
  ["01", "Prove you're live", "A 2-minute randomised challenge — face + voice liveness with a task generated the instant you start. A proxy, a deepfake avatar, or an earpiece can't pre-stage it."],
  ["02", "Show your judgment", "You're handed an AI openly and scored on how you direct, judge, and correct it on a real task — not on what you memorised. The job in 2026."],
  ["03", "Own your proof", "You mint a portable, cryptographically-signed credential. It's yours — reuse it with every employer. No re-spying each application."],
];

const EMPLOYER_STEPS = [
  ["01", "Verify in seconds", "Scan the candidate's HireProof. The signature is checked against our published key — tamper-evident, and it works even if our servers are down."],
  ["02", "See the evidence", "A verified-human + AI-judgment record with an auditable, hash-chained trail. No black-box fraud score — every score line quotes the transcript."],
  ["03", "Catch the swap", "Identity is re-verified each round and at onboarding. The person who applied is the person who shows up — proxy and seat-swap rings get flagged."],
];

const PILLARS = [
  ["Live challenge-response", "A server-issued random action sequence + nonce, verified against real-time landmark dynamics. No chatbot has this loop.", "server.nonce · landmark.dynamics"],
  ["Bound to the moment", "Your voice is tied to a sentence generated <2 min ago. A generic LLM would happily score a pre-recorded proxy.", "utterance.ts < now − 120s"],
  ["Stateful across rounds", "128-D face descriptors compared round-to-round catch seat-swaps. An LLM is stateless per call.", "cosine(descriptor[r], descriptor[r−1])"],
  ["Cryptographically owned", "An employer trusts the issuer key, not a screenshot. ChatGPT can't mint a signed credential against a did:web key.", "Ed25519.verify(vc, did:web)"],
];

const COMPLIANCE = [
  ["India DPDP 2023 + Rules 2025", "Itemised consent · minimisation · candidate-held data · erasure-by-revocation."],
  ["EU AI Act", "No emotion AI — by law and by design. Scores judgment, never affect (Art 5(1)(f))."],
  ["W3C Verifiable Credentials 2.0", "Signed with Ed25519 · did:web issuer · offline-verifiable."],
  ["ISO/IEC 30107-3 · NIST FATE-PAD", "The PAD benchmarks we build toward — challenge-response liveness today, not certified PAD; iProov/Incode is the production swap-in."],
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" className="hp-arrow" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Track({ label, steps }: { label: string; steps: string[][] }) {
  return (
    <div className="hp-reveal">
      <div className="hp-track-label">
        <span className="hp-eyebrow hp-gold">{label}</span>
        <span className="hp-track-label-line" />
      </div>
      <ol className="hp-steps">
        {steps.map(([k, t, d]) => (
          <li key={k} className="hp-step">
            <span className="hp-step-num">{k}</span>
            <h3 className="hp-title" style={{ fontSize: "1.05rem" }}>{t}</h3>
            <p className="hp-body hp-muted" style={{ fontSize: "0.95rem", marginTop: "0.4rem" }}>{d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Home() {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const supportsIO = typeof IntersectionObserver !== "undefined";

    let reveal: IntersectionObserver | undefined;
    let glitch: IntersectionObserver | undefined;

    if (!supportsIO) {
      // JS on but no IntersectionObserver: never leave content stuck at opacity:0
      document.querySelectorAll(".hp-reveal").forEach((el) => el.classList.add("is-revealed"));
    } else {
      // reveal once per element
      reveal = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-revealed");
              reveal!.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
      );
      document.querySelectorAll(".hp-reveal").forEach((el) => reveal!.observe(el));

      // the one "fake" that doesn't survive the loop
      glitch = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-glitching");
              glitch!.unobserve(e.target);
            }
          });
        },
        { threshold: 0.6 }
      );
      document.querySelectorAll("[data-glitch]").forEach((el) => glitch!.observe(el));
    }

    // nav condense + scroll-linked rail fill (the credential minted along the path)
    const steps = Array.from(document.querySelectorAll<HTMLElement>(".hp-steps"));
    let raf = 0;
    const update = () => {
      raf = 0;
      if (header) header.dataset.scrolled = String(window.scrollY > 8);
      const vh = window.innerHeight;
      steps.forEach((s) => {
        const r = s.getBoundingClientRect();
        const p = clamp((vh * 0.82 - r.top) / (r.height || 1), 0, 1);
        s.style.setProperty("--hp-rail", `${p * 100}%`);
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      reveal?.disconnect();
      glitch?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hp">
      <a href="#main" className="hp-skip">Skip to content</a>
      {/* no-JS: never trap content behind the reveal animation */}
      <noscript>
        <style>{`.hp-reveal{opacity:1 !important;transform:none !important;}`}</style>
      </noscript>

      {/* ---------------------------------------------------------- nav ---- */}
      <header ref={headerRef} className="hp-nav">
        <div className="hp-container hp-nav-inner">
          <Link href="/" className="hp-wordmark" aria-label="HireProof — home">
            <span className="hp-wordmark-seal" aria-hidden="true" />
            HireProof
          </Link>
          <nav aria-label="Primary" className="hp-nav-links">
            <Link href="#how" className="hp-navlink">How it works</Link>
            <Link href="#shift" className="hp-navlink">Why different</Link>
            <Link href="#compliance" className="hp-navlink">Compliance</Link>
          </nav>
          <div className="hp-row" style={{ gap: "0.6rem" }}>
            <Link href="/v" className="hp-btn hp-btn--ghost hp-cta-desktop">
              Verify a credential
            </Link>
            <Link href="/verify" className="hp-btn hp-btn--primary">
              Prove you&apos;re real
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* -------------------------------------------------------- hero ---- */}
        <section className="hp-section hp-section--tight" aria-labelledby="hero-h1">
          <div className="hp-container">
            <div className="hp-hero">
              <div className="a-eyebrow hp-reveal">
                <span className="hp-chip">
                  <span className="hp-wordmark-seal" aria-hidden="true" style={{ width: 8, height: 8 }} />
                  <span className="hp-eyebrow">Hiring-integrity infrastructure · Built for Bharat</span>
                </span>
              </div>

              <h1 id="hero-h1" className="a-headline hp-hero-h1 hp-reveal" style={{ "--hp-delay": "60ms" } as React.CSSProperties}>
                Prove you&apos;re a real human — with real <span className="hp-gold">AI judgment</span>.
              </h1>

              <div className="a-card hp-reveal" style={{ "--hp-delay": "120ms" } as React.CSSProperties}>
                <MintedCredential />
              </div>

              <p className="a-sub hp-body hp-lead hp-reveal" style={{ "--hp-delay": "150ms" } as React.CSSProperties}>
                HireProof is a candidate-owned, cryptographically-signed credential that proves a job
                applicant is a live human with real AI-collaboration judgment — verifiable by any
                employer in seconds, re-checked every round. Not surveillance. Not a detection arms
                race.{" "}
                <span className="hp-deva" lang="hi" style={{ color: "var(--gold-core)", whiteSpace: "nowrap" }}>
                  आपका प्रमाण, आपके पास।
                </span>
              </p>

              <div className="a-cta hp-row hp-reveal" style={{ "--hp-delay": "210ms" } as React.CSSProperties}>
                <Link href="/verify" className="hp-btn hp-btn--primary">
                  Prove you&apos;re real <ArrowIcon />
                </Link>
                <Link href="/employer" className="hp-btn hp-btn--ghost">
                  Verify in seconds
                </Link>
              </div>

              <div className="a-micro hp-reveal" style={{ "--hp-delay": "260ms" } as React.CSSProperties}>
                <p className="hp-mono" style={{ color: "var(--haze)" }}>
                  liveness · cross-round biometric match · Ed25519 · W3C VC 2.0
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- threat band ---- */}
        <section className="hp-section hp-section--tight" aria-label="The problem">
          <div className="hp-container hp-reveal">
            <p className="hp-eyebrow" style={{ marginBottom: "1.5rem" }}>The problem · signal from the void</p>
            <div className="hp-threat-grid hp-glass" style={{ overflow: "hidden" }}>
              {STATS.map((s) => (
                <div key={s.l} className="hp-threat-node">
                  <p className="hp-threat-num">{s.v}</p>
                  <p className="hp-body" style={{ fontSize: "0.95rem", marginTop: "0.5rem" }}>{s.l}</p>
                  <p className="hp-mono" style={{ color: "var(--haze)", marginTop: "0.5rem", fontSize: "0.7rem" }}>{s.s}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- the shift ---- */}
        <section id="shift" className="hp-section" aria-labelledby="shift-h">
          <div className="hp-container">
            <div className="hp-section-head hp-measure hp-reveal">
              <span className="hp-eyebrow">The shift</span>
              <h2 id="shift-h" className="hp-h2">Stop surveilling everyone. Let real people prove themselves.</h2>
              <p className="hp-body hp-muted hp-lead">
                Today&apos;s tools fight AI use and spy on applicants. HireProof flips the model: the
                candidate owns the proof, and we measure the one skill that actually matters now —
                directing AI well.
              </p>
            </div>

            <div className="hp-cols-3 hp-reveal" style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
              {SHIFT.map(([t, d]) => (
                <div key={t} className="hp-broken">
                  <div className="hp-row" style={{ gap: "0.5rem" }}>
                    <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="var(--haze)" strokeWidth={2} aria-hidden="true">
                      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
                    </svg>
                    <h3 className="hp-title" style={{ fontSize: "1rem", color: "var(--bone)" }}>{t}</h3>
                  </div>
                  <p className="hp-body" style={{ fontSize: "0.92rem", marginTop: "0.6rem", color: "var(--haze)" }}>{d}</p>
                </div>
              ))}
            </div>

            <div className="hp-flip hp-reveal" style={{ marginTop: "clamp(16px, 2.5vw, 22px)" }}>
              <div className="hp-row" style={{ gap: "0.8rem", alignItems: "flex-start" }}>
                <span aria-hidden="true" style={{ flex: "none", width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: "var(--gold)", color: "var(--void)" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="hp-body" style={{ maxWidth: "62ch" }}>
                  <span className="hp-gold" style={{ fontWeight: 600 }}>HireProof</span> — one
                  candidate-owned token that fuses live human-proof, AI-judgment scoring, and
                  cross-round re-verification.{" "}
                  <span className="hp-muted">Integration is the innovation.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------- how it works ---- */}
        <section id="how" className="hp-section" aria-labelledby="how-h">
          <div className="hp-container">
            <div className="hp-section-head hp-measure hp-reveal">
              <span className="hp-eyebrow">How it works</span>
              <h2 id="how-h" className="hp-h2">Two tracks, one credential — minted along the path.</h2>
            </div>
            <div className="hp-cols-2" style={{ marginTop: "clamp(40px, 6vw, 64px)", gap: "clamp(40px, 6vw, 72px)" }}>
              <Track label="candidate" steps={CANDIDATE_STEPS} />
              <Track label="employer" steps={EMPLOYER_STEPS} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------ why it can't be faked ---- */}
        <section className="hp-section" aria-labelledby="fake-h">
          <div className="hp-container">
            <div className="hp-section-head hp-measure hp-reveal">
              <span className="hp-eyebrow">Why it can&apos;t be faked</span>
              <h2 id="fake-h" className="hp-h2">You can&apos;t reproduce this by pasting into ChatGPT.</h2>
              <p className="hp-body hp-muted hp-lead">
                HireProof is a protocol, not a single inference. The proof lives in the
                challenge-response loop, the live binding, and the signature — none of which a
                chatbot can produce.
              </p>
              <p aria-hidden="true" style={{ marginTop: "0.2rem" }}>
                <span className="hp-fake hp-mono" data-glitch style={{ fontSize: "0.78rem" }}>
                  ✕ pasted-into-chatgpt.png — flat copy, does not survive the loop
                </span>
              </p>
            </div>

            <div className="hp-cols-2 hp-reveal" style={{ marginTop: "clamp(32px, 5vw, 56px)" }}>
              {PILLARS.map(([t, d, code]) => (
                <div key={t} className="hp-pillar hp-glass hp-glass--hover">
                  <h3 className="hp-title" style={{ fontSize: "1.1rem" }}>{t}</h3>
                  <p className="hp-body hp-muted" style={{ fontSize: "0.95rem", marginTop: "0.5rem" }}>{d}</p>
                  <p className="hp-mono" style={{ marginTop: "0.85rem", fontSize: "0.72rem" }}>{code}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ compliance ---- */}
        <section id="compliance" className="hp-section" aria-labelledby="comp-h">
          <div className="hp-container">
            <div className="hp-section-head hp-measure hp-reveal">
              <span className="hp-eyebrow">Compliant by design</span>
              <h2 id="comp-h" className="hp-h2">Built to what the law requires — and rewards.</h2>
            </div>
            <div className="hp-cols-4 hp-reveal" style={{ marginTop: "clamp(32px, 5vw, 56px)" }}>
              {COMPLIANCE.map(([t, d]) => (
                <div key={t} className="hp-badge">
                  <h3 className="hp-title" style={{ fontSize: "0.98rem" }}>{t}</h3>
                  <p className="hp-body hp-muted" style={{ fontSize: "0.85rem", marginTop: "0.6rem", lineHeight: 1.5 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- final CTA ---- */}
        <section className="hp-section" aria-labelledby="cta-h">
          <div className="hp-container">
            <div className="hp-cols-2" style={{ alignItems: "center", gap: "clamp(40px, 6vw, 72px)" }}>
              <div className="hp-section-head hp-reveal">
                <h2 id="cta-h" className="hp-h2">Honest candidates win. Fakes can&apos;t.</h2>
                <p className="hp-body hp-muted hp-lead">
                  Earn your HireProof once. Reuse it everywhere. Let employers trust you in seconds.
                </p>
                <div className="hp-row" style={{ marginTop: "0.6rem" }}>
                  <Link href="/verify" className="hp-btn hp-btn--primary">
                    Prove you&apos;re real <ArrowIcon />
                  </Link>
                  <Link href="/employer" className="hp-btn hp-btn--ghost">
                    For employers
                  </Link>
                </div>
              </div>
              <div className="hp-reveal" style={{ display: "flex", justifyContent: "center" }}>
                <MintedCredential mint={false} compact />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------- footer ---- */}
      <footer className="hp-footer">
        <div className="hp-container" style={{ paddingBlock: "clamp(36px, 5vw, 52px)" }}>
          <div className="hp-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
            <Link href="/" className="hp-wordmark" aria-label="HireProof — home">
              <span className="hp-wordmark-seal" aria-hidden="true" />
              HireProof
            </Link>
            <nav aria-label="Footer" className="hp-row" style={{ gap: "1.4rem" }}>
              <Link href="#how" className="hp-navlink">How it works</Link>
              <Link href="#shift" className="hp-navlink">Why different</Link>
              <Link href="#compliance" className="hp-navlink">Compliance</Link>
              <Link href="/v" className="hp-navlink">Verify a credential</Link>
              <Link href="/verify" className="hp-navlink">Prove you&apos;re real</Link>
            </nav>
          </div>
          <p className="hp-mono" style={{ color: "var(--haze)", marginTop: "1.6rem", fontSize: "0.72rem" }}>
            Prototype — see honest limitations in the demo.
          </p>
        </div>
      </footer>
    </div>
  );
}
