// Reproduction: generate a calendar (event) QR via the real Generate UI, then
// decode the preview image with jsQR to check whether it is actually scannable.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = "file://" + path.resolve(here, "../desktop-app/renderer/index.html");

const STUB = `
window.qrAPI = new Proxy({
  getPlatform: async () => "darwin",
  getAppVersion: async () => "0.0.0-test",
  onSwitchTab: () => {}, markRendererReady: () => {}, onDecodeBuffer: () => {},
  onNativeDecoded: () => {}, onShowScanToast: () => {}, notifyTabChanged: () => {},
  getSettings: async () => ({ language: "en", setupDone: true, tutorialShown: true, onboardingComplete: true, extensionPromptShown: true }),
  saveSettings: async () => ({ ok: true }),
  getHistory: async () => [],
  onDecoded: async () => ({ ok: true }),
  markSetupComplete: async () => {}, markOnboardingComplete: async () => {},
  shouldShowTutorial: async () => false, markTutorialShown: async () => {},
  restartApp: async () => {},
  checkUpdates: async () => ({ latest: false }),
  getDynamicCodes: async () => [],
  scanWifi: async () => ({ ok: true, networks: [] }),
  joinWifi: async () => ({ ok: true }),
  openContactEvent: async () => ({ ok: true }),
  openGeo: async () => ({ ok: true }),
  setQrStyle: async () => ({ ok: true }),
  getQrStyle: async () => ({ ok: true, style: null }),
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
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text()); });
await page.addInitScript(STUB);

await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.evaluate(() => { if (window.requestSwitchTab) window.requestSwitchTab("generate"); });
await page.waitForTimeout(250);

// Select the event (calendar) template via the real dropdown.
await page.selectOption("#gen-template", "event");
await page.waitForTimeout(300);

// Inspect the rendered form fields.
const fields = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("#tpl-form input")).map((el) => ({
    id: el.id, type: el.type, value: el.value,
  }));
});
console.log("EVENT FORM FIELDS:", JSON.stringify(fields, null, 2));

// Fill fields like a user would.
await page.evaluate(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set("tpl-event-start", "2026-08-28T14:00");
  set("tpl-event-end", "2026-08-28T15:00");
  set("tpl-event-summary", "Team Meeting");
  set("tpl-event-location", "Conference Room 3");
});
await page.waitForTimeout(600);

// Grab state content + preview image, decode with jsQR.
const res = await page.evaluate(async () => {
  const state = window.QRGen.getState();
  const img = document.getElementById("gen-img");
  const errEl = document.getElementById("gen-error");
  const out = {
    template: state.template,
    values: state.values.event,
    styling: state.styling,
    imgSrcLen: img && img.src ? img.src.length : 0,
    imgDisplayed: img ? getComputedStyle(img).display : "n/a",
    imgW: img ? img.naturalWidth : 0,
    errVisible: errEl ? !errEl.classList.contains("hidden") : null,
    errText: errEl ? errEl.textContent : null,
    decoded: null,
  };
  if (img && img.src && img.src.startsWith("data:")) {
    const image = new Image();
    image.src = img.src;
    await image.decode();
    const cv = document.createElement("canvas");
    cv.width = image.width; cv.height = image.height;
    const cx = cv.getContext("2d");
    cx.drawImage(image, 0, 0);
    const { data, width, height } = cx.getImageData(0, 0, image.width, image.height);
    const r = window.jsQR ? window.jsQR(data, width, height) : null;
    out.jsqrAvailable = typeof window.jsQR === "function";
    out.decoded = r ? r.data : null;
  }
  return out;
});
console.log("RESULT:", JSON.stringify(res, null, 2));

await browser.close();
