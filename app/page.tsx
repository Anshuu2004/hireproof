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
const IcPerson = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" strokeLinecap="round" />
  </svg>
);
const IcLive = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="6.5" width="18" height="12.5" rx="2" />
    <circle cx="12" cy="12.5" r="3.1" />
    <path d="M8.2 6.5L9.4 4.5h5.2l1.2 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcBadge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="9" r="6" />
    <path d="M9.2 9l2 2 3.6-3.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 14.4L7 22l5-2.6L17 22l-1.5-7.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcEmployer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 21V6l8-3v18M12 21V9l6 2v10M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 9.5v.01M7 13.5v.01M15 13.5v.01M15 17v.01" strokeLinecap="round" />
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
const Chevron = () => (
  <svg className="lp-faq-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
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
  ["01", "Prove you're live", "A 2-minute face and voice check that proves you are live on camera right now. The task is created the moment you start, so a stand-in, a deepfake, or an earpiece can't prepare for it."],
  ["02", "Show you can out-think the AI", "You're given an AI to use openly and scored on how well you guide it, catch its mistakes, and fix them on a real task. That's the skill that matters now, not memorising answers."],
  ["03", "Own your proof", "You get a tamper-proof badge that's yours to keep. Reuse it with every employer instead of getting screened from scratch each time."],
];
const EMPLOYER = [
  ["01", "Verify in seconds", "Scan the candidate's HireProof. The signature is checked against our published key — tamper-evident, and it works even if our servers are down."],
  ["02", "See the evidence", "A clear record showing the person is real and how well they handled the AI, with every score line explained and a full activity trail. No mystery fraud score."],
  ["03", "Catch the swap", "Identity is re-verified each round and at onboarding. The person who applied is the person who shows up — proxy and seat-swap rings get flagged."],
];

const PILLARS = [
  ["Live challenge-response", "A server-issued random action sequence + nonce, verified against real-time landmark dynamics. No chatbot has this loop.", "server.nonce · landmark.dynamics"],
  ["Bound to the moment", "Your voice is tied to a sentence generated <2 min ago. A generic LLM would happily score a pre-recorded proxy.", "utterance.ts < now − 120s"],
  ["Stateful across rounds", "128-D face descriptors compared round-to-round catch seat-swaps. An LLM is stateless per call.", "cosine(descriptor[r], descriptor[r−1])"],
  ["Cryptographically owned", "An employer trusts the issuer key, not a screenshot. A generic AI assistant can't mint a signed credential against a did:web key.", "Ed25519.verify(vc, did:web)"],
];

const COMPLIANCE = [
  ["India DPDP 2023 + Rules 2025", "Itemised consent · minimisation · candidate-held data · erasure-by-revocation."],
  ["EU AI Act", "No emotion AI — by law and by design. Scores judgment, never affect (Art 5(1)(f))."],
  ["W3C Verifiable Credentials 2.0", "Signed with Ed25519 · did:web issuer · offline-verifiable."],
  ["ISO/IEC 30107-3 · NIST FATE-PAD", "Liveness measured against recognised presentation-attack standards."],
];

const STANDARDS = ["DPDP", "EU AI Act", "W3C VC 2.0", "Ed25519", "did:web", "ISO/IEC 30107-3", "NIST FATE-PAD"];

const FAQS: [string, string][] = [
  [
    "What exactly is HireProof?",
    "A credential the candidate owns and carries. In one short verification it proves three things at once: that you're a real, live human (not a deepfake or a stand-in), that you can actually direct and correct an AI on a real task, and — across interview rounds — that you're still the same person. It's cryptographically signed, so any employer can check it in seconds, even offline.",
  ],
  [
    "What makes it different from a coding test or a proctoring tool?",
    "Most tools either watch every applicant (surveillance) or chase fakes after the fact (an endless detection arms race). HireProof flips the model: the candidate owns the proof, and instead of asking “did you use an AI,” we measure “can you out-judge one.” Liveness, judgment scoring, and cross-round identity are fused into one portable credential — and that fusion is the part nothing else ships today.",
  ],
  [
    "How do you measure “AI judgment” and not just AI usage?",
    "We hand you an AI that is confidently wrong: your task contains a hidden, planted mistake. You're scored on whether you catch it, steer the AI to the right approach, and ship a correct answer. Submit the AI's flawed answer as-is and your score is hard-capped — because knowing how to prompt isn't the skill anymore; knowing when the AI is wrong is.",
  ],
  [
    "Why can't an employer just reproduce this with a chatbot?",
    "Because it's a protocol, not a single question. The proof lives in a live challenge-response loop, a voice-and-face binding to a moment generated seconds ago, and a signature checked against a published key. A generic AI assistant has none of that — it can't prove the actions happened live and in order, it can't remember you across rounds, and it can't mint a tamper-evident credential.",
  ],
  [
    "How does an employer trust and verify it?",
    "Every credential is signed with the issuer's Ed25519 key, published openly via did:web — so anyone can verify it offline in seconds, with no login and no call to our servers. Change a single field and the signature breaks. If a credential is revoked, the check shows it. The employer trusts the math, not a screenshot.",
  ],
  [
    "Is it private and compliant?",
    "Raw video never leaves your device — only a privacy-preserving math fingerprint and the derived signals are stored, and consent is itemised and erasable. It's built to India's DPDP Act and the EU AI Act by design: no emotion or personality is ever inferred, only task judgment — and the result is an explainable signal for a human to weigh, never an automated hire/reject verdict.",
  ],
  [
    "Why is this the right approach in 2026?",
    "Everyone can prompt an AI now, fake profiles and deepfake interviews are documented at scale, and a polished résumé says little about whether someone can ship under real conditions. The signal that matters has moved to execution under constraint — catching the AI when it's wrong — which is exactly what this verifies, and ties to an identity that can't be swapped mid-process.",
  ],
];

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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
            <a href="#faq" className="lp-navlink">FAQ</a>
            <Link href="/guide" className="lp-navlink">Guide</Link>
          </nav>
          <div className="lp-row" style={{ gap: "0.55rem" }}>
            <Link href="/v" className="lp-btn lp-btn--ghost lp-cta-desktop">Verify a credential</Link>
            <Link href="/employer" className="lp-btn lp-btn--ghost lp-cta-desktop">For employers</Link>
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
            <Link href="/guide" onClick={() => setMenuOpen(false)}>Guide</Link>
            <Link href="/v" onClick={() => setMenuOpen(false)}>Verify a credential</Link>
            <Link href="/employer" onClick={() => setMenuOpen(false)}>For employers</Link>
          </div>
        )}
      </header>

      <main>
        {/* -------------------------------------------------------- hero */}
        <section className="lp-section lp-section--tight">
          <div className="lp-container">
            <div className="lp-hero">
              <div className="lp-hero-copy">
                <p className="lp-eyebrow lp-reveal">Trusted hiring checks · proof, not guesswork</p>
                <h1 className="lp-display lp-words">
                  <span className="w" style={{ "--wd": "0ms" } as React.CSSProperties}>Prove</span>{" "}
                  <span className="w" style={{ "--wd": "50ms" } as React.CSSProperties}>you&apos;re</span>{" "}
                  <span className="w" style={{ "--wd": "100ms" } as React.CSSProperties}>a</span>{" "}
                  <span className="w" style={{ "--wd": "150ms" } as React.CSSProperties}>real</span>{" "}
                  <span className="w lp-warm" style={{ "--wd": "200ms" } as React.CSSProperties}>person</span>{" "}
                  <span className="w" style={{ "--wd": "260ms" } as React.CSSProperties}>who</span>{" "}
                  <span className="w" style={{ "--wd": "320ms" } as React.CSSProperties}>can</span>{" "}
                  <span className="w" style={{ "--wd": "370ms" } as React.CSSProperties}>put</span>{" "}
                  <span className="w" style={{ "--wd": "420ms" } as React.CSSProperties}>AI</span>{" "}
                  <span className="w" style={{ "--wd": "470ms" } as React.CSSProperties}>to</span>{" "}
                  <span className="w" style={{ "--wd": "520ms" } as React.CSSProperties}>work.</span>
                </h1>
                <p className="lp-lead lp-reveal" style={{ "--d": "120ms", maxWidth: "52ch" } as React.CSSProperties}>
                  HireProof is a tamper-proof badge a candidate owns. It proves they are a real, live
                  person who can spot and fix an AI&apos;s mistakes, and any employer can check it in
                  seconds. No spyware, no guessing games.
                </p>
                <div className="lp-row lp-reveal" style={{ "--d": "180ms", gap: "0.7rem", flexWrap: "wrap" } as React.CSSProperties}>
                  <Link href="/verify" className="lp-btn lp-btn--primary">Prove you&apos;re real <Arrow /></Link>
                  <Link href="/employer" className="lp-btn lp-btn--ghost">Verify in seconds</Link>
                </div>
                <div className="lp-hero-micro lp-mono lp-reveal" style={{ "--d": "240ms" } as React.CSSProperties}>
                  <span className="lp-rule" /> live person check · same face across rounds · tamper-proof · open standard
                </div>
              </div>
              <div className="lp-hero-card lp-reveal" style={{ "--d": "120ms" } as React.CSSProperties}>
                <VerificationCard variant="real" startDelay={400} />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------ the whole thing, at a glance */}
        <section className="lp-section lp-section--tight" aria-label="How it works at a glance">
          <div className="lp-container lp-reveal">
            <ol className="lp-flow">
              <li className="lp-flow-step">
                <span className="lp-flow-ic"><IcPerson /></span>
                <p className="lp-flow-t">Real person</p>
                <p className="lp-flow-d">A candidate. No account needed.</p>
              </li>
              <span className="lp-flow-sep" aria-hidden="true"><Arrow /></span>
              <li className="lp-flow-step">
                <span className="lp-flow-ic"><IcLive /></span>
                <p className="lp-flow-t">Live + AI check</p>
                <p className="lp-flow-d">A quick face check, then a real AI task.</p>
              </li>
              <span className="lp-flow-sep" aria-hidden="true"><Arrow /></span>
              <li className="lp-flow-step">
                <span className="lp-flow-ic"><IcBadge /></span>
                <p className="lp-flow-t">Signed badge</p>
                <p className="lp-flow-d">Tamper-proof. The candidate owns it.</p>
              </li>
              <span className="lp-flow-sep" aria-hidden="true"><Arrow /></span>
              <li className="lp-flow-step">
                <span className="lp-flow-ic"><IcEmployer /></span>
                <p className="lp-flow-t">Any employer</p>
                <p className="lp-flow-d">Checks it in seconds.</p>
              </li>
            </ol>
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
                <strong style={{ fontWeight: 600 }}>HireProof</strong> is one badge the candidate owns:
                it proves they&apos;re a live person, scores how they handle AI, and confirms it&apos;s the
                same person each round.{" "}
                <span className="lp-muted">Doing all three together is the hard part.</span>
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
              <h2 className="lp-h2">You can&apos;t reproduce this by pasting into a chatbot.</h2>
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

        {/* --------------------------------------------------------- FAQ */}
        <section id="faq" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head lp-measure lp-reveal">
              <p className="lp-eyebrow">questions</p>
              <h2 className="lp-h2">What teams ask before they trust it.</h2>
            </div>
            <div className="lp-faq lp-reveal" style={{ marginTop: "clamp(28px, 4vw, 48px)" }}>
              {FAQS.map(([q, a], i) => {
                const open = openFaq === i;
                return (
                  <div key={i} className="lp-faq-item" data-open={open}>
                    <button
                      type="button"
                      className="lp-faq-q"
                      aria-expanded={open}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      <span>{q}</span>
                      <Chevron />
                    </button>
                    <div className="lp-faq-a" id={`faq-a-${i}`} role="region" aria-label={q}>
                      <div>
                        <p>{a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          <div className="lp-container">
            <div className="lp-foot-grid">
              {/* brand */}
              <div className="lp-foot-brandcol">
                <Link href="/" className="lp-wordmark" aria-label="HireProof — home">
                  <span className="lp-seal" aria-hidden="true"><Check /></span>HireProof
                </Link>
                <p className="lp-foot-tagline">
                  A candidate-owned, cryptographically-signed credential — proof you&apos;re a real, live
                  human with real AI judgment, verifiable by any employer in seconds.
                </p>
              </div>

              {/* explore */}
              <nav className="lp-foot-col" aria-label="Explore">
                <p className="lp-foot-h">Explore</p>
                <a href="#how" className="lp-foot-link">How it works</a>
                <a href="#shift" className="lp-foot-link">Why different</a>
                <a href="#compliance" className="lp-foot-link">Compliance</a>
                <a href="#faq" className="lp-foot-link">FAQ</a>
                <Link href="/guide" className="lp-foot-link">Guide</Link>
              </nav>

              {/* use it */}
              <nav className="lp-foot-col" aria-label="Use HireProof">
                <p className="lp-foot-h">Use it</p>
                <Link href="/verify" className="lp-foot-link">Prove you&apos;re real</Link>
                <Link href="/v" className="lp-foot-link">Verify a credential</Link>
                <Link href="/employer" className="lp-foot-link">For employers</Link>
              </nav>

              {/* built on */}
              <div className="lp-foot-col">
                <p className="lp-foot-h">Built on open standards</p>
                <div className="lp-foot-stds">
                  {["Ed25519", "did:web", "W3C VC 2.0", "DPDP 2023", "EU AI Act"].map((s) => (
                    <span key={s} className="lp-foot-std">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* bottom bar */}
            <div className="lp-foot-bottom">
              <p className="lp-mono" style={{ fontSize: "0.7rem" }}>
                Prototype — calibrated claims over absolutes. See the honest-status notes in the demo.
              </p>
              <div className="lp-row" style={{ gap: "0.7rem" }}>
                <span className="lp-mono" style={{ fontSize: "0.7rem", color: "var(--ink-2)" }}>Theme</span>
                <button type="button" className="lp-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                  {theme === "dark" ? <Sun /> : <Moon />}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
