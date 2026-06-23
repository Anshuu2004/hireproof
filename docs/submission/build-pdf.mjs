// Render submission.html → a print-ready PDF. Local only (no network).
// Run: node docs/submission/build-pdf.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = join(__dirname, "submission.html");
const OUT = join(__dirname, "HireProof_InnovateZ_2026_Submission.pdf");

const main = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle", timeout: 60000 });
  // make sure every screenshot has decoded before we paginate
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => {}))));
  });
  await page.waitForTimeout(600);

  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "14mm", left: "0mm", right: "0mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate:
      '<div style="width:100%;font-family:Segoe UI,Arial,sans-serif;font-size:7pt;color:#94a3b8;padding:0 16mm;display:flex;justify-content:space-between;">' +
      '<span>HireProof · InnovateZ 2026 · Team DOMINATORS</span>' +
      '<span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>' +
      "</div>",
  });

  await browser.close();
  const kb = Math.round(statSync(OUT).size / 1024);
  console.log(`PDF written: ${OUT} (${kb} KB)`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
