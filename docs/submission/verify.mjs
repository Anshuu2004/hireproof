import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = join(__dirname, "submission.html");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1160 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
// the architecture section (the one that contains the diagram)
const sec = page.locator("section", { has: page.locator(".diagram") }).first();
await sec.scrollIntoViewIfNeeded();
await sec.screenshot({ path: join(__dirname, "_v-arch.png") });
console.log("done");
await browser.close();
