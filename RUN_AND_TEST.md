# HireProof — Run & Test Guide

A plain, step-by-step guide to start the app and check that **every part works**,
with the exact output you should expect.

---

## 1. Start it (one command)

From the `hireproof/` folder:

```bash
python setup.py
```

This installs everything, checks your `.env.local`, starts the dev server, and
prints the link. When you see Next.js print `Local: http://localhost:3000`, open
that in **Chrome or Edge** (the camera/voice step needs a Chromium browser).

Flags:
- `python setup.py --no-run` — install + check only (don't start the server)
- `python setup.py --build` — production build, then start
- `python setup.py --migrate` — also apply database migrations (needs `SUPABASE_DB_PASSWORD`)

**Manual alternative:**
```bash
npm install
npm run dev      # then open http://localhost:3000
```

> If `.env.local` is missing, the app still starts but AI + database features
> won't work. The 5 required keys are listed when `setup.py` runs; pull them with
> `vercel env pull .env.local` if the project is linked to Vercel.

---

## 2. What to test, and what you should see

Use **two browser tabs** — one as the candidate, one as the employer.

### A. Landing page — `/`
- **Do:** open `http://localhost:3000`.
- **Expect:** the homepage loads with no layout breaking; resize the window
  narrow (phone width) and wide — nothing should overflow or overlap.

### B. Candidate: prove + get a certificate — `/verify`
- **Do:** open `/verify`, allow **camera + microphone**, follow the on-screen
  steps: face check (turn head / blink), read the numbers aloud, then the short
  AI task (you chat with the AI helper and fix its mistake).
- **Expect:**
  - Face step shows a green **"Face detected"** dot and a confirm tick per action.
  - Voice step: the mic bar moves when you speak. If it says *"Catching your voice
    by sound…"* that's **fine** — your speaking still counts.
  - AI helper replies with a **full** answer (no cut-off mid-sentence).
  - At the end you get a **certificate** with a score and a QR/token. Copy it.
- **Working = ** you reach the certificate screen with a real score.

### C. Employer: review candidates — `/employer`
- **Do:** open `/employer`. Click **"Sign in as demo employer"**
  (or use `demo@hireproof.app` / `demo1234`). You can also try **Continue with
  Google** (only allow-listed emails get in; others see "access pending").
- **Expect:** the console opens with a list of verified candidates. Click one to
  see their score, a **Re-verify** button, **Revoke**, **Fairness audit**, and a
  **hash-chained audit trail** (a timeline of events).
- **Working = ** you see at least the demo/your just-created candidate and can
  open their record.

### D. Public check of a certificate — `/v`
- **Do:** open `/v`, paste the token from step B (or scan the QR).
- **Expect:** within ~1 second it shows **"Real human · verified"**, the score,
  and an honest **"what this does NOT prove"** note. Tamper with one character of
  the token and it should show **invalid**.
- **Working = ** valid token → verified; edited token → rejected.

### E. Supporting pages
- `/metrics` — live counts (sessions, credentials). Should load with numbers.
- `/fairness` — the bias/fairness report. Loads with a pass/fail summary.
- `/guide` — the how-it-works explainer.

---

## 3. How data is saved (so you know it's real)

Everything is stored in **Supabase (Postgres)**:

| Table | What it holds |
|---|---|
| `sessions` | every verification attempt |
| `ai_tasks`, `ai_transcript_turns` | the task + the full candidate↔AI chat (saved server-side, can't be faked) |
| `scores` | the score breakdown |
| `face_descriptors` | the face "fingerprint" (hashed, not a photo) — used to match across rounds |
| `credentials` | the signed certificate |
| `audit_log` | a tamper-evident chain of events |
| `employers`, `employer_allowlist` | console logins |

To confirm a test saved: open the Supabase dashboard → Table editor → `sessions`
→ you should see a new row per attempt. The candidate has **no account** by
design — they own their certificate via a private holder secret.

---

## 4. Quick health checks (commands)

```bash
npm run typecheck                 # no TypeScript errors
npm run build                     # production build passes (all routes compile)
node scripts/check-gemini-keys.mjs   # confirms each AI key works (OK/FAIL per key)
node scripts/check-allowlist.mjs     # confirms the employer allow-list rows
```
Expected: `typecheck`/`build` finish with no errors; the key check prints `OK`
for working keys (a transient "high demand" just means Google was busy — rotation
retries the next key).

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| Camera/mic not working | Use Chrome/Edge, allow permissions, only one tab using the camera. |
| "Catching your voice by sound" | Not an error — browser speech-to-text is optional; your live voice still passes. |
| AI helper doesn't reply | Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local` (free Gemini). For best code answers add `AI_GATEWAY_API_KEY` and set `LLM_PRIMARY=claude`. |
| AI sometimes slow / "high demand" | Free Gemini is busy; rotation tries your other keys. Add more keys or a Vercel AI Gateway key. |
| Employer Google login says "pending" | That email isn't on `employer_allowlist`. Add it: `insert into employer_allowlist (email, note) values ('you@x.com','owner');` |
| Page looks cramped on phone | Hard-refresh; if it persists, note the page — responsive fixes are ongoing. |
