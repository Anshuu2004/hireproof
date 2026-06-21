"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VerificationCard } from "@/components/verification-card";

/* ----------------------------------------------------------------- icons */
const Arrow = () => (
  <svg className="lp-arrow" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Sun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
  </svg>
);
const Moon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Menu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
  </svg>
);
const Cross = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* --------------------------------------------------------------- content */
const STATS = [
  { pre: "1 in ", num: 4, dec: 0, suf: "", label: "candidate profiles will be fake by 2028", src: "Gartner, Jul 2025" },
  { pre: "", num: 100, dec: 0, suf: "+", label: "U.S. firms infiltrated by fake remote workers", src: "U.S. DOJ, Jun 2025" },
  { pre: "", num: 9.46, dec: 2, suf: "%", label: "discrepancy rate in Indian IT/ITeS hiring", src: "AuthBridge, 2025" },
];

const SHIFT = [
  ["Detection arms race", "Forensic detectors chase ever-better deepfakes and flip to wrong under attack."],
  ["Surveillance proctoring", "Spy on every applicant, bury honest candidates in false positives."],
  ["Employer-locked tests", "Verify once, for one employer — nothing the candidate owns or reuses."],
];

const CANDIDATE = [
  ["01", "Prove you're live", "A 2-minute randomised challenge — face + voice liveness with a task generated the instant you start. A proxy, a deepfake avatar, or an earpiece can't pre-stage it."],
  ["02", "Show your judgment", "You're handed an AI openly and scored on how you direct, judge, and correct it on a real task — not on what you memorised. The job in 2026."],
  ["03", "Own your proof", "You mint a portable, cryptographically-signed credential. It's yours — reuse it with every employer. No re-spying each application."],
];
const EMPLOYER = [
  ["01", "Verify in seconds", "Scan the candidate's HireProof. The signature is checked against our published key — tamper-evident, and it works even if our servers are down."],
  ["02", "See the evidence", "A verified-human + AI-judgment record with an auditable, bias-checked trail. No black-box fraud score — every line is explainable."],
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
  ["ISO/IEC 30107-3 · NIST FATE-PAD", "Liveness measured against recognised presentation-attack standards."],
];

const STANDARDS = ["DPDP", "EU AI Act", "W3C VC 2.0", "Ed25519", "did:web", "ISO/IEC 30107-3", "NIST FATE-PAD"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ----------------------------------------------------- counting stat number */
function StatNumber({ pre, num, dec, suf }: { pre: string; num: number; dec: number; suf: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = () => {
      if (done) return;
      done = true;
      if (reduced) return setVal(num);
      let raf = 0;
      let start = 0;
      const step = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / 1200);
        setVal(num * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      el.dataset.raf = String(raf);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && run()), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [num]);
  return (
    <p ref={ref} className="lp-stat-num">
      {pre}
      {val.toFixed(dec)}
      {suf}
    </p>
  );
}

/* --------------------------------------------------------------- the page */
export default function Home() {
  const navRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [menuOpen, setMenuOpen] = useState(false);

  // sync toggle state with whatever the no-FOUC script set
  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("hp-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // reveals (once) + nav condense + how-it-works connector rail
  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            reveal.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => reveal.observe(el));

    const steps = Array.from(document.querySelectorAll<HTMLElement>(".lp-steps"));
    let raf = 0;
    const update = () => {
      raf = 0;
      if (navRef.current) navRef.current.dataset.scrolled = String(window.scrollY > 8);
      const vh = window.innerHeight;
      steps.forEach((s) => {
        const r = s.getBoundingClientRect();
        const p = clamp((vh * 0.8 - r.top) / (r.height || 1), 0, 1);
        s.style.setProperty("--rail", `${p * 100}%`);
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      reveal.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp">
      <div className="lp-ambient" aria-hidden="true" />

      {/* ------------------------------------------------------------ nav */}
      <header ref={navRef} className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <Link href="/" className="lp-wordmark" aria-label="HireProof — home">
            <span className="lp-seal" aria-hidden="true"><Check /></span>
            HireProof
          </Link>
          <nav aria-label="Primary" className="lp-nav-links">
            <a href="#how" className="lp-navlink">How it works</a>
            <a href="#shift" className="lp-navlink">Why different</a>
            <a href="#compliance" className="lp-navlink">Compliance</a>
          </nav>
          <div className="lp-row" style={{ gap: "0.55rem" }}>
            <Link href="/v" className="lp-btn lp-btn--ghost lp-cta-desktop">Verify a credential</Link>
            <Link href="/verify" className="lp-btn lp-btn--primary">Prove you&apos;re real</Link>
            <button type="button" className="lp-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button type="button" className="lp-icon-btn lp-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label="Menu">
              {menuOpen ? <Cross /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lp-sheet">
            <a href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#shift" onClick={() => setMenuOpen(false)}>Why different</a>
            <a href="#compliance" onClick={() => setMenuOpen(false)}>Compliance</a>
            <Link href="/v" onClick={() => setMenuOpen(false)}>Verify a credential</Link>
          </div>
        )}
      </header>

      <main>
        {/* -------------------------------------------------------- hero */}
        <section className="lp-section lp-section--tight">
          <div className="lp-container">
            <div className="lp-hero">
              <div className="lp-hero-copy">
                <p className="lp-eyebrow lp-reveal">Hiring-integrity infrastructure · Built for Bharat</p>
                <h1 className="lp-display lp-reveal" style={{ "--d": "60ms" } as React.CSSProperties}>
                  Prove you&apos;re a real <span className="lp-warm">human</span> — with real AI judgment.
                </h1>
                <p className="lp-lead lp-reveal" style={{ "--d": "120ms", maxWidth: "52ch" } as React.CSSProperties}>
                  HireProof is a candidate-owned, cryptographically-signed credential that proves a job
                  applicant is a live human with real AI-collaboration judgment — verifiable by any
                  employer in seconds, re-checked every round. Not surveillance. Not a detection arms race.{" "}
                  <span className="lp-deva" lang="hi" style={{ color: "var(--warm)", whiteSpace: "nowrap" }}>आपका प्रमाण, आपके पास।</span>
                </p>
                <div className="lp-row lp-reveal" style={{ "--d": "180ms", gap: "0.7rem", flexWrap: "wrap" } as React.CSSProperties}>
                  <Link href="/verify" className="lp-btn lp-btn--primary">Prove you&apos;re real <Arrow /></Link>
                  <Link href="/employer" className="lp-btn lp-btn--ghost">Verify in seconds</Link>
                </div>
                <div className="lp-hero-micro lp-mono lp-reveal" style={{ "--d": "240ms" } as React.CSSProperties}>
                  <span className="lp-rule" /> liveness · cross-round biometric match · Ed25519 · W3C VC 2.0
                </div>
              </div>
              <div className="lp-hero-card lp-reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
                <VerificationCard variant="real" startDelay={400} />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ threat band */}
        <section className="lp-section lp-section--tight" aria-label="The problem">
          <div className="lp-container lp-reveal">
            <p className="lp-eyebrow" style={{ marginBottom: "1.4rem" }}>the problem</p>
            <div className="lp-stats">
              {STATS.map((s) => (
                <div key={s.label} className="lp-stat">
                  <StatNumber pre={s.pre} num={s.num} dec={s.dec} suf={s.suf} />
                  <p className="lp-stat-label">{s.label}</p>
                  <p className="lp-eyebrow lp-stat-src">{s.src}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- the shift */}
        <section id="shift" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head lp-measure lp-reveal">
              <p className="lp-eyebrow">the shift</p>
              <h2 className="lp-h2">Stop surveilling everyone. Let real people prove themselves.</h2>
              <p className="lp-lead">
                Today&apos;s tools fight AI use and spy on applicants. HireProof flips the model: the
                candidate owns the proof, and we measure the one skill that actually matters now —
                directing AI well.
              </p>
            </div>
            <div className="lp-cols-3 lp-reveal" style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
              {SHIFT.map(([t, d]) => (
                <div key={t} className="lp-broken">
                  <div className="lp-broken-head"><Cross /><span className="lp-title" style={{ fontSize: "1rem" }}>{t}</span></div>
                  <p className="lp-body" style={{ fontSize: "0.92rem", marginTop: "0.55rem", color: "var(--ink-2)" }}>{d}</p>
                </div>
              ))}
            </div>
            <div className="lp-flip lp-reveal">
              <span className="lp-flip-mark" aria-hidden="true"><Check /></span>
              <p className="lp-body" style={{ maxWidth: "64ch" }}>
                <strong style={{ fontWeight: 600 }}>HireProof</strong> — one candidate-owned token that
                fuses live human-proof, AI-judgment scoring, and cross-round re-verification.{" "}
                <span className="lp-muted">Integration is the innovation.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- how it works */}
        <section id="how" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head lp-measure lp-reveal">
              <p className="lp-eyebrow">how it works</p>
              <h2 className="lp-h2">Two tracks, one credential.</h2>
            </div>
            <div className="lp-tracks">
              {([["candidate", CANDIDATE], ["employer", EMPLOYER]] as const).map(([label, steps]) => (
                <div key={label} className="lp-reveal">
                  <div className="lp-track-label"><span className="lp-eyebrow lp-verify-ink">{label}</span><span className="lp-rule" /></div>
                  <ol className="lp-steps">
                    {steps.map(([k, t, d]) => (
                      <li key={k} className="lp-step">
                        <span className="lp-step-num">{k}</span>
                        <p className="lp-step-t">{t}</p>
                        <p className="lp-step-d">{d}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {/* the can't-be-faked demo: same verification, real vs fake */}
            <div className="lp-section-head lp-measure lp-reveal" style={{ marginTop: "clamp(56px, 7vw, 88px)" }}>
              <p className="lp-eyebrow">real vs fake · same verification</p>
              <h2 className="lp-h2" style={{ fontSize: "clamp(1.4rem, 2.4vw, 2rem)" }}>One passes. One can&apos;t.</h2>
            </div>
            <div className="lp-cols-2 lp-reveal" style={{ marginTop: "clamp(24px, 3vw, 40px)", alignItems: "start", justifyItems: "center" }}>
              <VerificationCard variant="real" startDelay={200} />
              <VerificationCard variant="fake" startDelay={200} credentialId="HP·3A7E-0000-FAKE" issued="2026-06-20 14:41 IST" qrSlug="3a7e0000" reason="PRE-RECORDED · PROXY" />
            </div>
          </div>
        </section>

        {/* --------------------------------------- why it can't be faked */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head lp-measure lp-reveal">
              <p className="lp-eyebrow">why it can&apos;t be faked</p>
              <h2 className="lp-h2">You can&apos;t reproduce this by pasting into ChatGPT.</h2>
              <p className="lp-lead">
                HireProof is a protocol, not a single inference. The proof lives in the
                challenge-response loop, the live binding, and the signature — none of which a chatbot
                can produce.
              </p>
            </div>
            <div className="lp-cols-2 lp-reveal" style={{ marginTop: "clamp(32px, 4vw, 56px)" }}>
              {PILLARS.map(([t, d, code]) => (
                <div key={t} className="lp-pillar lp-card lp-card--hover">
                  <p className="lp-title" style={{ fontSize: "1.1rem" }}>{t}</p>
                  <p className="lp-body" style={{ fontSize: "0.95rem", marginTop: "0.5rem", color: "var(--ink-2)" }}>{d}</p>
                  <p className="lp-pillar-code lp-mono">{code}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* standards marquee */}
        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee-track">
            {[...STANDARDS, ...STANDARDS].map((s, i) => (
              <span key={i} className="lp-marquee-item">{s}</span>
            ))}
          </div>
        </div>

        {/* -------------------------------------------------- compliance */}
        <section id="compliance" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head lp-measure lp-reveal">
              <p className="lp-eyebrow">compliant by design</p>
              <h2 className="lp-h2">Built to what the law requires — and rewards.</h2>
            </div>
            <div className="lp-cols-4 lp-reveal" style={{ marginTop: "clamp(32px, 4vw, 56px)" }}>
              {COMPLIANCE.map(([t, d]) => (
                <div key={t} className="lp-badge">
                  <p className="lp-title" style={{ fontSize: "0.98rem" }}>{t}</p>
                  <p className="lp-body" style={{ fontSize: "0.85rem", marginTop: "0.55rem", lineHeight: 1.5, color: "var(--ink-2)" }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- final CTA */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-card lp-reveal" style={{ padding: "clamp(28px, 5vw, 56px)", textAlign: "center" }}>
              <span className="lp-chip" style={{ marginBottom: "1.1rem" }}>
                <span style={{ color: "var(--verify)", display: "inline-flex" }}><Check /></span>
                <span className="lp-mono" style={{ fontSize: "0.7rem", color: "var(--ink)" }}>Verified Human</span>
              </span>
              <h2 className="lp-h2" style={{ margin: "0 auto", maxWidth: "20ch" }}>Honest candidates win. Fakes can&apos;t.</h2>
              <p className="lp-lead" style={{ margin: "0.9rem auto 0", maxWidth: "44ch" }}>
                Earn your HireProof once. Reuse it everywhere. Let employers trust you in seconds.
              </p>
              <div className="lp-row" style={{ justifyContent: "center", gap: "0.7rem", marginTop: "1.6rem", flexWrap: "wrap" }}>
                <Link href="/verify" className="lp-btn lp-btn--primary">Prove you&apos;re real <Arrow /></Link>
                <Link href="/employer" className="lp-btn lp-btn--ghost">For employers</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- footer */}
        <footer className="lp-footer">
          <div className="lp-container lp-section--tight" style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center", justifyContent: "space-between" }}>
            <Link href="/" className="lp-wordmark" aria-label="HireProof — home">
              <span className="lp-seal" aria-hidden="true"><Check /></span>HireProof
            </Link>
            <nav aria-label="Footer" className="lp-row" style={{ gap: "1.4rem", flexWrap: "wrap" }}>
              <a href="#how" className="lp-ulink">How it works</a>
              <a href="#compliance" className="lp-ulink">Compliance</a>
              <Link href="/v" className="lp-ulink">Verify a credential</Link>
              <Link href="/verify" className="lp-ulink">Prove you&apos;re real</Link>
            </nav>
            <div className="lp-row" style={{ gap: "0.8rem" }}>
              <span className="lp-mono" style={{ fontSize: "0.72rem" }}>Candidate-owned · offline-verifiable hiring proof.</span>
              <button type="button" className="lp-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                {theme === "dark" ? <Sun /> : <Moon />}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
