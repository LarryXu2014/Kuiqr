// Kuiqr QR regression runner.
// Loads desktop-app/renderer/selftest.html in headless Chromium, waits for the
// page to render every QR sample/style combo, decode it, and assert the payload
// matches. The page sets document.title to SELFTEST_OK / SELFTEST_FAIL /
// SELFTEST_ERROR. We fail the process (exit 1) on any non-OK result so CI can't
// silently let a scannability regression through.
//
// Usage:  npm run selftest   (from qr-scanner/tests)
//         node run-selftest.mjs

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "..", "desktop-app", "renderer", "selftest.html");
const url = "file://" + htmlPath;

const TIMEOUT_MS = 120_000;

const logs = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait until the page finishes (it sets one of the SELFTEST_* titles).
  await page.waitForFunction(
    () => /SELFTEST_(OK|FAIL|ERROR)/.test(document.title),
    { timeout: TIMEOUT_MS }
  );

  const title = await page.title();
  const out = (await page.textContent("#out")) || "";
  let result = null;
  try {
    result = await page.evaluate(() => window.__selftest);
  } catch (_) {
    /* ignore — #out already has the info */
  }

  console.log(out);
  if (result) {
    console.log("\n=== Scan matrix (decode assertion) ===");
    for (const d of result.details || []) {
      const mark = d.ok ? "PASS" : "FAIL";
      const extra = d.ok ? "" : `  expected="${d.expected}" got="${d.decoded ?? d.error ?? ""}"`;
      console.log(`  [${mark}] ${d.name}${extra}`);
    }
    console.log("\n=== Format-spec checks (exact payload string) ===");
    for (const c of result.formatChecks || []) {
      const mark = c.ok ? "PASS" : "FAIL";
      const extra = c.ok ? "" : `\n    got:      ${JSON.stringify(c.got)}\n    expected: ${JSON.stringify(c.expected)}`;
      console.log(`  [${mark}] ${c.name}${extra}`);
    }
  }

  if (logs.length) {
    console.log("\n=== Browser logs ===");
    console.log(logs.join("\n"));
  }

  if (title === "SELFTEST_OK") {
    console.log(`\n✅ SELFTEST PASSED (scan ${result?.pass ?? "?"}/${result?.total ?? "?"}, format ${(result?.formatChecks || []).filter((c) => c.ok).length}/${(result?.formatChecks || []).length})`);
    process.exit(0);
  } else {
    console.error(`\n❌ SELFTEST FAILED (title=${title})`);
    process.exit(1);
  }
} catch (e) {
  console.error("\n❌ SELFTEST RUNNER ERROR:", e && e.message ? e.message : e);
  if (logs.length) {
    console.error("\n=== Browser logs ===");
    console.error(logs.join("\n"));
  }
  process.exit(2);
} finally {
  if (browser) await browser.close();
}
