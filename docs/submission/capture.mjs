// Best-effort screenshot capture of HireProof's live public pages.
// Camera-gated candidate-flow screens cannot be captured headlessly — those are
// supplied by the user (see screenshots/README.txt). Run: node docs/submission/capture.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "screenshots");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.HP_BASE || "https://hireproof-ecru.vercel.app";

const shot = async (page, path, full = true) => {
  await page.screenshot({ path: join(OUT, path), fullPage: full });
  console.log("  saved", path);
};

const go = async (ctx, url, file, { full = true, wait = 3500, action } = {}) => {
  const page = await ctx.newPage();
  try {
    console.log("capture", url);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(wait);
    if (action) await action(page).catch((e) => console.log("  action skip:", e.message));
    await shot(page, file, full);
  } catch (e) {
    console.log("  FAILED", file, e.message);
  } finally {
    await page.close();
  }
};

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

  await go(ctx, `${BASE}/`, "pub-landing.png", { full: true, wait: 4500 });
  await go(ctx, `${BASE}/metrics`, "pub-metrics.png", { wait: 5000 });
  await go(ctx, `${BASE}/fairness`, "pub-fairness.png", { wait: 5000 });
  await go(ctx, `${BASE}/rings`, "pub-rings.png", { wait: 5000 });
  await go(ctx, `${BASE}/v`, "pub-verify.png", { full: false, wait: 4000 });

  // Employer console — try the one-click demo login, else just capture the sign-in.
  await go(ctx, `${BASE}/employer`, "pub-employer.png", {
    full: true,
    wait: 4000,
    action: async (page) => {
      const demo = page.getByRole("button", { name: /demo/i }).first();
      if (await demo.count()) {
        await demo.click({ timeout: 4000 });
        await page.waitForTimeout(5000);
        await shot(page, "pub-employer-console.png", true);
        // open the first candidate row if present
        const row = page.locator("button, a").filter({ hasText: /HP[·\-]/ }).first();
        if (await row.count()) {
          await row.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(3500);
          await shot(page, "pub-employer-detail.png", true);
        }
      }
    },
  });

  await ctx.close();
  await browser.close();
  console.log("done");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
