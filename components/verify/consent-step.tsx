"use client";

import { useState } from "react";
import { Camera, Microphone, ArrowsClockwise, Trash, Check, Scales } from "@phosphor-icons/react";
import type { Language } from "@/lib/liveness/challenge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ConsentValue {
  face: boolean;
  voice: boolean;
  crossStage: boolean;
  demographicsForAudit?: boolean;
}

/** Opt-in, aggregate-only fairness-audit fields. Never affects the score. */
export interface Demographics {
  gender: string;
  age_band: string;
  region: string;
  category: string;
}

const DEMO_FIELDS: { key: keyof Demographics; label: string; options: { v: string; l: string }[] }[] = [
  {
    key: "gender",
    label: "Gender",
    options: [
      { v: "undisclosed", l: "Prefer not to say" },
      { v: "female", l: "Female" },
      { v: "male", l: "Male" },
      { v: "nonbinary", l: "Non-binary" },
    ],
  },
  {
    key: "age_band",
    label: "Age band",
    options: [
      { v: "undisclosed", l: "Prefer not to say" },
      { v: "18-24", l: "18–24" },
      { v: "25-34", l: "25–34" },
      { v: "35-44", l: "35–44" },
      { v: "45-54", l: "45–54" },
      { v: "55+", l: "55+" },
    ],
  },
  {
    key: "region",
    label: "Region",
    options: [
      { v: "undisclosed", l: "Prefer not to say" },
      { v: "north", l: "North" },
      { v: "south", l: "South" },
      { v: "east", l: "East" },
      { v: "west", l: "West" },
    ],
  },
  {
    key: "category",
    label: "Category",
    options: [
      { v: "undisclosed", l: "Prefer not to say" },
      { v: "general", l: "General" },
      { v: "obc", l: "OBC" },
      { v: "sc", l: "SC" },
      { v: "st", l: "ST" },
      { v: "ews", l: "EWS" },
    ],
  },
];

const LANGS: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
];

const ITEMS = [
  {
    key: "face" as const,
    icon: Camera,
    title: "Face liveness",
    desc: "We check you are a live person on camera right now — never your emotions, age, or any other trait.",
    required: true,
  },
  {
    key: "voice" as const,
    icon: Microphone,
    title: "Voice liveness",
    desc: "You read a short phrase generated this instant, so a recording or a stand-in can't pass for you.",
    required: true,
  },
  {
    key: "crossStage" as const,
    icon: ArrowsClockwise,
    title: "Cross-round match",
    desc: "We match your face across interview rounds so a proxy can't swap in later. Optional.",
    required: false,
  },
];

function Toggle({
  on,
  onClick,
  disabled,
  label,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 active:scale-[0.97]",
        on ? "border-proof/40 bg-proof/25" : "border-ink-600 bg-ink-800",
        disabled && "opacity-40"
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-all duration-200",
          on ? "left-[22px] bg-proof" : "left-1 bg-ink-300"
        )}
      />
    </button>
  );
}

export function ConsentStep({
  onProceed,
}: {
  onProceed: (language: Language, consent: ConsentValue, demographics?: Demographics) => void;
}) {
  const [language, setLanguage] = useState<Language>("en");
  const [consent, setConsent] = useState<ConsentValue>({
    face: false,
    voice: false,
    crossStage: true,
    demographicsForAudit: false,
  });
  const [demographics, setDemographics] = useState<Demographics>({
    gender: "undisclosed",
    age_band: "undisclosed",
    region: "undisclosed",
    category: "undisclosed",
  });
  const ready = consent.face && consent.voice;
  const demoOn = consent.demographicsForAudit === true;

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* language selector */}
      <div className="mb-8 flex items-center justify-between">
        <p className="eyebrow text-indigo-bright">Before we begin</p>
        <div className="flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900 p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                language === l.code ? "bg-ink-700 text-ink-50" : "text-ink-400 hover:text-ink-200",
                l.code !== "en" && "font-deva"
              )}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink-50 sm:text-3xl">
        This proof is yours.
      </h1>
      <p className="mt-3 text-pretty leading-relaxed text-ink-300">
        You&apos;ll do a short live check, then own a portable credential you reuse with any employer.
        Here is exactly what we capture — and what we never keep.
      </p>

      {/* itemised consent — DPDP affirmative action, nothing pre-bundled */}
      <div className="mt-8 divide-y divide-ink-700/70 overflow-hidden rounded-card border border-ink-700 bg-ink-900">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const on = consent[item.key];
          return (
            <div key={item.key} className="flex items-start gap-4 p-4">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control border border-ink-700 bg-ink-800 text-ink-200">
                <Icon size={18} weight="regular" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink-50">{item.title}</p>
                  {item.required ? (
                    <span className="eyebrow text-ink-400">Required</span>
                  ) : (
                    <span className="eyebrow text-ink-400">Optional</span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{item.desc}</p>
              </div>
              <Toggle
                on={on}
                label={`Consent to ${item.title}`}
                onClick={() => setConsent((c) => ({ ...c, [item.key]: !c[item.key] }))}
              />
            </div>
          );
        })}
      </div>

      {/* Opt-in fairness-audit demographics — separate consent, aggregate-only,
          never used in scoring. This is what makes an NYC LL144 / EU AI Act
          adverse-impact audit possible without compromising the score. */}
      <div className="mt-4 overflow-hidden rounded-card border border-ink-700 bg-ink-900">
        <div className="flex items-start gap-4 p-4">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control border border-ink-700 bg-ink-800 text-ink-200">
            <Scales size={18} weight="regular" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink-50">Fairness-audit demographics</p>
              <span className="eyebrow text-ink-400">Optional</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-400">
              Help us prove the scoring is unbiased. Used only in aggregate for a published
              fairness audit — <span className="text-ink-200">never tied to your credential and never used to score you.</span>
            </p>
          </div>
          <Toggle
            on={demoOn}
            label="Share demographics for fairness auditing"
            onClick={() => setConsent((c) => ({ ...c, demographicsForAudit: !c.demographicsForAudit }))}
          />
        </div>
        {demoOn && (
          <div className="grid grid-cols-2 gap-3 border-t border-ink-700/70 p-4">
            {DEMO_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="eyebrow text-ink-400">{f.label}</span>
                <select
                  value={demographics[f.key]}
                  onChange={(e) => setDemographics((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="mt-1 w-full rounded-control border border-ink-700 bg-ink-950 px-2.5 py-2 text-sm text-ink-100 focus:border-indigo focus:outline-none"
                >
                  {f.options.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* what we never do — the DPDP / EU-AI-Act guarantees, stated plainly */}
      <ul className="mt-5 space-y-2">
        {[
          "Your camera feed never leaves your device — only a math fingerprint does.",
          "No emotion, confidence, or personality is ever inferred. By law and by design.",
          "Delete everything anytime by revoking your credential.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-2.5 text-sm text-ink-300">
            <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-proof" />
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        disabled={!ready}
        onClick={() => onProceed(language, consent, demoOn ? demographics : undefined)}
        className="mt-8 w-full"
      >
        {ready ? "I'm ready — start the live check" : "Turn on face & voice to continue"}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-500">
        <Trash size={13} /> You can stop anytime. Nothing is stored until you mint.
      </p>
    </div>
  );
}
