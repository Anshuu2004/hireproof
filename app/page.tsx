import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { CredentialCard } from "@/components/credential-card";

const STATS = [
  { v: "1 in 4", l: "candidate profiles will be fake by 2028", s: "Gartner, Jul 2025" },
  { v: "100+", l: "U.S. firms infiltrated by fake remote workers", s: "U.S. DOJ, Jun 2025" },
  { v: "9.46%", l: "discrepancy rate in Indian IT/ITeS hiring", s: "AuthBridge, 2025" },
];

const CANDIDATE_STEPS = [
  {
    k: "01",
    t: "Prove you're live",
    d: "A 2-minute randomised challenge — face + voice liveness with a task generated the instant you start. A proxy, a deepfake avatar, or an earpiece can't pre-stage it.",
  },
  {
    k: "02",
    t: "Show your judgment",
    d: "You're handed an AI openly and scored on how you direct, judge, and correct it on a real task — not on what you memorised. The job in 2026.",
  },
  {
    k: "03",
    t: "Own your proof",
    d: "You mint a portable, cryptographically-signed credential. It's yours — reuse it with every employer. No re-spying each application.",
  },
];

const EMPLOYER_STEPS = [
  {
    k: "01",
    t: "Verify in seconds",
    d: "Scan the candidate's HireProof. The signature is checked against our published key — tamper-evident, and it works even if our servers are down.",
  },
  {
    k: "02",
    t: "See the evidence",
    d: "A verified-human + AI-judgment record with an auditable, bias-checked trail. No black-box fraud score — every line is explainable.",
  },
  {
    k: "03",
    t: "Catch the swap",
    d: "Identity is re-verified each round and at onboarding. The person who applied is the person who shows up — proxy and seat-swap rings get flagged.",
  },
];

const SHIFT = [
  {
    bad: "Detection arms race",
    badd: "Forensic detectors chase ever-better deepfakes and flip to wrong under attack.",
  },
  {
    bad: "Surveillance proctoring",
    badd: "Spy on every applicant, bury honest candidates in false positives.",
  },
  {
    bad: "Employer-locked tests",
    badd: "Verify once, for one employer — nothing the candidate owns or reuses.",
  },
];

const COMPLIANCE = [
  { t: "India DPDP 2023 + Rules 2025", d: "Itemised consent · minimisation · candidate-held data · erasure-by-revocation" },
  { t: "EU AI Act", d: "No emotion AI — by law and by design. Scores judgment, never affect (Art 5(1)(f))." },
  { t: "W3C Verifiable Credentials 2.0", d: "Signed with Ed25519 · did:web issuer · offline-verifiable" },
  { t: "ISO/IEC 30107-3 · NIST FATE-PAD", d: "Liveness measured against recognised presentation-attack standards" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow text-indigo-bright">{children}</p>;
}

export default function Home() {
  return (
    <main className="flex-1">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-50 border-b border-ink-700/80 bg-ink-950/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <div className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
            <Link href="#how" className="transition-colors hover:text-ink-50">How it works</Link>
            <Link href="#shift" className="transition-colors hover:text-ink-50">Why different</Link>
            <Link href="#compliance" className="transition-colors hover:text-ink-50">Compliance</Link>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/v"
              className="hidden rounded-control px-3.5 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-800 sm:block"
            >
              Verify a credential
            </Link>
            <Link
              href="/verify"
              className="rounded-control bg-indigo px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-deep"
            >
              Prove you&apos;re real
            </Link>
          </div>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-ink-700/60">
        <div aria-hidden className="grid-paper absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-proof pulse-soft" />
              <span className="eyebrow text-ink-300">Hiring-integrity infrastructure · Built for Bharat</span>
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-ink-50 sm:text-5xl lg:text-[3.4rem]">
              Prove you&apos;re a real human — with real{" "}
              <span className="text-proof">AI judgment</span>.
            </h1>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-ink-300 sm:text-lg">
              HireProof is a candidate-owned, cryptographically-signed credential that proves an
              applicant is a live human with real AI-collaboration skill — verifiable by any
              employer in seconds, re-checked every round. Not surveillance. Not a detection arms
              race. <span className="font-deva text-ink-200">आपका प्रमाण, आपके पास।</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/verify"
                className="group inline-flex items-center gap-2 rounded-control bg-indigo px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-deep"
              >
                Prove you&apos;re real
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/employer"
                className="inline-flex items-center gap-2 rounded-control border border-ink-600 px-5 py-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-400 hover:bg-ink-900"
              >
                Verify in seconds
              </Link>
            </div>
            <div className="flex items-center gap-2 pt-2 font-data text-xs text-ink-400">
              <span className="h-px w-6 bg-ink-600" />
              <span>liveness · cross-round biometric match · Ed25519 · W3C VC 2.0</span>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            {/* the signature artifact, shown as proof the product is real */}
            <div className="relative">
              <div aria-hidden className="absolute -inset-6 -z-10 rounded-[28px] bg-indigo/10 blur-2xl" />
              <CredentialCard className="rotate-[1.2deg]" />
            </div>
          </div>
        </div>

        {/* stat band */}
        <div className="relative border-t border-ink-700/60 bg-ink-900/40">
          <div className="mx-auto grid max-w-6xl divide-ink-700/60 px-5 sm:grid-cols-3 sm:divide-x">
            {STATS.map((s) => (
              <div key={s.l} className="flex flex-col gap-1 py-6 sm:px-6 sm:first:pl-0">
                <span className="font-data text-2xl font-semibold text-ink-50">{s.v}</span>
                <span className="text-sm text-ink-300">{s.l}</span>
                <span className="eyebrow text-ink-500">{s.s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- The shift ---------- */}
      <section id="shift" className="border-b border-ink-700/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl space-y-4">
            <Eyebrow>The shift</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink-50 sm:text-4xl">
              Stop surveilling everyone. Let real people prove themselves.
            </h2>
            <p className="text-ink-300">
              Today&apos;s tools fight AI use and spy on applicants. HireProof flips the model:
              the candidate owns the proof, and we measure the one skill that actually matters now —
              directing AI well.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-ink-700 bg-ink-700 md:grid-cols-3">
            {SHIFT.map((c) => (
              <div key={c.bad} className="bg-ink-900 p-6">
                <div className="flex items-center gap-2 text-danger">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm font-medium text-ink-100">{c.bad}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{c.badd}</p>
              </div>
            ))}
          </div>

          <div className="mt-px flex items-center gap-3 rounded-card border border-proof/30 bg-proof-wash-dark/40 p-6">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-proof text-ink-950">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-sm text-ink-100">
              <span className="font-medium text-ink-50">HireProof</span> — one candidate-owned token
              that fuses live human-proof, AI-judgment scoring, and cross-round re-verification.
              <span className="text-ink-400"> Integration is the innovation.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="border-b border-ink-700/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>How it works · end to end</Eyebrow>
          <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="mb-7 flex items-center gap-2 text-lg font-semibold text-ink-50">
                <span className="font-data text-sm text-indigo-bright">candidate</span>
                <span className="h-px flex-1 bg-ink-700" />
              </h3>
              <ol className="space-y-7">
                {CANDIDATE_STEPS.map((s) => (
                  <li key={s.k} className="flex gap-4">
                    <span className="font-data text-sm text-ink-500">{s.k}</span>
                    <div className="space-y-1.5">
                      <p className="font-medium text-ink-50">{s.t}</p>
                      <p className="text-sm leading-relaxed text-ink-400">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="mb-7 flex items-center gap-2 text-lg font-semibold text-ink-50">
                <span className="font-data text-sm text-indigo-bright">employer</span>
                <span className="h-px flex-1 bg-ink-700" />
              </h3>
              <ol className="space-y-7">
                {EMPLOYER_STEPS.map((s) => (
                  <li key={s.k} className="flex gap-4">
                    <span className="font-data text-sm text-ink-500">{s.k}</span>
                    <div className="space-y-1.5">
                      <p className="font-medium text-ink-50">{s.t}</p>
                      <p className="text-sm leading-relaxed text-ink-400">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Value beyond a generic LLM ---------- */}
      <section className="border-b border-ink-700/60 bg-ink-900/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="space-y-4">
              <Eyebrow>Why it can&apos;t be faked</Eyebrow>
              <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink-50">
                You can&apos;t reproduce this by pasting into ChatGPT.
              </h2>
              <p className="text-ink-300">
                HireProof is a protocol, not a single inference. The proof lives in the
                challenge-response loop, the live binding, and the signature — none of which a
                chatbot can produce.
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-card border border-ink-700 bg-ink-700 sm:grid-cols-2">
              {[
                ["Live challenge-response", "A server-issued random action sequence + nonce, verified against real-time landmark dynamics. No chatbot has this loop."],
                ["Bound to the moment", "Your voice is tied to a sentence generated <2 min ago. A generic LLM would happily score a pre-recorded proxy."],
                ["Stateful across rounds", "128-D face descriptors compared round-to-round catch seat-swaps. An LLM is stateless per call."],
                ["Cryptographically owned", "An employer trusts the issuer key, not a screenshot. ChatGPT can't mint a signed credential against a did:web key."],
              ].map(([t, d]) => (
                <li key={t} className="bg-ink-900 p-5">
                  <p className="text-sm font-medium text-ink-50">{t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Compliance ---------- */}
      <section id="compliance" className="border-b border-ink-700/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Compliant by design</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-ink-50">
            Built to what the law requires — and rewards.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-card border border-ink-700 bg-ink-700 sm:grid-cols-2 lg:grid-cols-4">
            {COMPLIANCE.map((c) => (
              <div key={c.t} className="bg-ink-900 p-5">
                <p className="text-sm font-medium text-ink-50">{c.t}</p>
                <p className="mt-2 text-xs leading-relaxed text-ink-400">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-b border-ink-700/60">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-ink-50 sm:text-4xl">
            Honest candidates win. Fakes can&apos;t.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-300">
            Earn your HireProof once. Reuse it everywhere. Let employers trust you in seconds.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 rounded-control bg-indigo px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-deep"
            >
              Prove you&apos;re real
            </Link>
            <Link
              href="/employer"
              className="inline-flex items-center gap-2 rounded-control border border-ink-600 px-6 py-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-400 hover:bg-ink-900"
            >
              For employers
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="bg-ink-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <p className="font-data text-xs text-ink-500">
            Team DOMINATORS · InnovateZ 2026 · prototype — see honest limitations in the demo
          </p>
        </div>
      </footer>
    </main>
  );
}
