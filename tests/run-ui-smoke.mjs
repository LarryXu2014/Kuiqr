// UI smoke test: loads the real index.html with a stubbed window.qrAPI and
// verifies the Generate-tab restructure: collapsible panels, Wi-Fi picker,
// styling persistence (localStorage + setQrStyle sync).
// Run from qr-scanner/tests:  node run-ui-smoke.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = "file://" + path.resolve(here, "../desktop-app/renderer/index.html");

const STUB = `
window.qrAPI = new Proxy({
  // async IPC stubs
  getPlatform: async () => "darwin",
  getAppVersion: async () => "0.0.0-test",
  onSwitchTab: () => {}, markRendererReady: () => {}, onDecodeBuffer: () => {},
  onNativeDecoded: () => {}, onShowScanToast: () => {}, notifyTabChanged: () => {},
  getSettings: async () => ({ language: "en", setupDone: true, tutorialShown: true, onboardingComplete: true, extensionPromptShown: true }),
  saveSettings: async () => ({ ok: true }),
  markSetupComplete: async () => {}, markOnboardingComplete: async () => {},
  shouldShowTutorial: async () => false, markTutorialShown: async () => {},
  restartApp: async () => {},
  checkUpdates: async () => ({ latest: false }),
  getDynamicCodes: async () => [],
  scanWifi: async () => ({ ok: true, networks: [ { ssid: "HomeNet-5G", signal: 82 }, { ssid: "Cafe Guest", signal: 40 } ] }),
  setQrStyle: async (style) => { window.__savedStyle = style; return { ok: true }; },
  getQrStyle: async () => { try { return { ok: true, style: JSON.parse(localStorage.getItem("kuiqr.qrstyle") || "null") }; } catch { return { ok: true, style: null }; } },
  showSaveDialog: async () => null,
  showOpenDialog: async () => ({ filePaths: [] }),
  writeFile: async () => ({ ok: true }),
  zipFolder: async () => ({ ok: true }),
  openRegionWatch: async () => ({ ok: true }),
  stopRegionWatch: async () => ({ ok: true }),
  onRegionWatchStatus: () => {},
  startLocalBackend: async () => ({ ok: true, url: "http://localhost:3000", apiKey: "k" }),
  stopLocalBackend: async () => ({ ok: true }),
  copyQrImage: async () => ({ ok: true }),
  copyClipboard: () => {},
  openUrl: () => {},
}, {
  get(t, k) { return t[k] !== undefined ? t[k] : async () => ({}); }
});
`;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.addInitScript(STUB);

const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok, extra }); console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra ? "  — " + extra : "")); };

await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700); // let app.js + qrgen.js init
// The app defaults to the Scan tab — switch to Generate like a click would.
await page.evaluate(() => { if (window.requestSwitchTab) window.requestSwitchTab("generate"); });
await page.waitForTimeout(250);

// 1. Generate tab present; style/export panels collapsed by default.
check("style panel exists", await page.locator("#style-panel").count() === 1);
check("export panel exists", await page.locator("#export-panel").count() === 1);
const styleBodyHidden = !(await page.locator("#style-body").evaluate((el) => getComputedStyle(el).display !== "none" && el.getClientRects().length > 0));
const exportBodyHidden = !(await page.locator("#export-body").evaluate((el) => getComputedStyle(el).display !== "none" && el.getClientRects().length > 0));
check("style panel collapsed by default", styleBodyHidden);
check("export panel collapsed by default", exportBodyHidden);

// 2. Preview visible WITHOUT expanding panels (the core UX ask).
const previewVisible = await page.locator("#gen-preview").evaluate((el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== "none");
check("QR preview visible immediately", previewVisible);

// 3. Toggle expands style panel.
await page.click("#style-toggle");
const styleBodyVisible = await page.locator("#style-body").evaluate((el) => el.getClientRects().length > 0);
check("style panel expands on click", styleBodyVisible);
check("aria-expanded updated", (await page.locator("#style-toggle").getAttribute("aria-expanded")) === "true");

// 4. WiFi template shows scan picker; scanning lists stub networks; picking fills SSID.
await page.selectOption("#gen-template", "wifi");
await page.waitForTimeout(250);
check("wifi scan button rendered", await page.locator(".wifi-scan-btn").count() === 1);
await page.click(".wifi-scan-btn");
await page.waitForSelector(".wifi-scan-item", { timeout: 5000 });
check("wifi list shows networks", await page.locator(".wifi-scan-item").count() === 2);
await page.locator(".wifi-scan-item").first().click();
const ssidVal = await page.inputValue("#tpl-wifi-ssid");
check("clicking network fills SSID", ssidVal === "HomeNet-5G", 'got "' + ssidVal + '"');
// QR payload reflects it
const st = await page.evaluate(() => window.QRGen.getState());
const content1 = await page.evaluate(() => window.QRGen.getState().values.wifi);
check("state updated", content1 && content1.ssid === "HomeNet-5G");

// 5. Change fg color → saved to localStorage AND synced via setQrStyle.
await page.selectOption("#gen-template", "text"); // back to plain text so #gen-input shows
await page.waitForTimeout(150);
await page.fill("#gen-input", "hello");
await page.locator("#style-fg").evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, "#ff0000");
await page.waitForTimeout(400);
const lsStyle = await page.evaluate(() => JSON.parse(localStorage.getItem("kuiqr.qrstyle") || "null"));
check("fg saved to localStorage", lsStyle && lsStyle.fg === "#ff0000");
const saved = await page.evaluate(() => window.__savedStyle);
check("fg synced to main settings (setQrStyle)", saved && saved.fg === "#ff0000");

// 6. Reload → styling persists (red stays red).
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.evaluate(() => { if (window.requestSwitchTab) window.requestSwitchTab("generate"); });
await page.waitForTimeout(250);
const fgAfter = await page.evaluate(() => window.QRGen.getState().styling.fg);
check("fg persists after reload", fgAfter === "#ff0000", "got " + fgAfter);

// 7. Reset button restores defaults.
const bodyOpen = await page.locator("#style-body").evaluate((el) => el.getClientRects().length > 0);
if (!bodyOpen) await page.click("#style-toggle");
await page.waitForTimeout(150);
await page.click("#style-reset");
await page.waitForTimeout(300);
const fgReset = await page.evaluate(() => window.QRGen.getState().styling.fg);
check("reset restores default fg", fgReset === "#000000", "got " + fgReset);
const lsReset = await page.evaluate(() => JSON.parse(localStorage.getItem("kuiqr.qrstyle") || "null"));
check("reset persisted", lsReset && lsReset.fg === "#000000");

// 8. Panel open/closed state remembered across reload (style was open → stays open).
const openState = await page.evaluate(() => localStorage.getItem("kuiqr.genpanel.style"));
check("panel state persisted", openState !== null, 'state=' + openState);

const failed = results.filter((r) => !r.ok);
if (errors.length) console.log("\nPage errors:\n  " + errors.join("\n  "));
console.log(`\nUI SMOKE: ${results.length - failed.length}/${results.length} pass`);
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
