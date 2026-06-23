// Measures each top-level page block's height vs A4 usable content height,
// to flag pages that would print near-empty or overflow. Local only.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = join(__dirname, "submission.html");

const USABLE = 994; // A4 height 297mm - (18mm top + 16mm bottom) margins, in CSS px @96dpi

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
await page.emulateMedia({ media: "print" });
await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await Promise.all(Array.from(document.images).map((i) => (i.complete ? 0 : i.decode().catch(() => {}))));
});
await page.waitForTimeout(400);

const rows = await page.evaluate(() => {
  const blocks = Array.from(document.querySelectorAll(".cover, .wrap.page"));
  return blocks.map((b) => {
    const h2 = b.querySelector("h2");
    const fl = b.querySelector(".figlabel");
    const label = b.classList.contains("cover") ? "COVER" : (h2 ? h2.textContent : (fl ? fl.textContent : "(figures)"));
    return { label: label.slice(0, 42), h: Math.round(b.getBoundingClientRect().height) };
  });
});

console.log("usable content height per A4 page:", USABLE, "px\n");
for (const r of rows) {
  const pages = Math.max(1, Math.ceil(r.h / USABLE));
  const lastFill = Math.round(((r.h - (pages - 1) * USABLE) / USABLE) * 100);
  let flag = "";
  if (lastFill < 50) flag = "  <-- last page <50% full";
  if (r.h > USABLE && r.h - (pages - 1) * USABLE < USABLE * 0.4) flag = "  <-- OVERFLOW leaves a near-empty page";
  console.log(`${String(r.h).padStart(5)}px  ${pages}pg  last ${String(lastFill).padStart(3)}%  ${r.label}${flag}`);
}
await browser.close();
