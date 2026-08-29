// Alignment audit v2: per-tab measurement while the tab is actually visible.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = "file://" + path.resolve(here, "../desktop-app/renderer/index.html");

const STUB = `
window.qrAPI = new Proxy({
  getPlatform: async () => "darwin", getAppVersion: async () => "0.0.0-test",
  onSwitchTab: () => {}, markRendererReady: () => {}, onDecodeBuffer: () => {},
  onNativeDecoded: () => {}, onShowScanToast: () => {}, notifyTabChanged: () => {},
  getSettings: async () => ({ language: "en", setupDone: true, tutorialShown: true, onboardingComplete: true, extensionPromptShown: true }),
  saveSettings: async () => ({ ok: true }), getHistory: async () => [],
  onDecoded: async () => ({ ok: true }), markSetupComplete: async () => {}, markOnboardingComplete: async () => {},
  shouldShowTutorial: async () => false, markTutorialShown: async () => {}, restartApp: async () => {},
  checkUpdates: async () => ({ latest: false }), getDynamicCodes: async () => [],
  scanWifi: async () => ({ ok: true, networks: [] }), joinWifi: async () => ({ ok: true }),
  openContactEvent: async () => ({ ok: true }), openGeo: async () => ({ ok: true }),
  setQrStyle: async () => ({ ok: true }), getQrStyle: async () => ({ ok: true, style: null }),
  showSaveDialog: async () => null, showOpenDialog: async () => ({ filePaths: [] }),
  writeFile: async () => ({ ok: true }), zipFolder: async () => ({ ok: true }),
  openRegionWatch: async () => ({ ok: true }), stopRegionWatch: async () => ({ ok: true }),
  onRegionWatchStatus: () => {}, startLocalBackend: async () => ({ ok: true }), stopLocalBackend: async () => ({ ok: true }),
  copyQrImage: async () => ({ ok: true }), copyClipboard: () => {}, openUrl: async () => ({ ok: true }),
}, { get(t, k) { return t[k] !== undefined ? t[k] : async () => ({}); } });
`;

const MEASURE = () => {
  const out = [];
  const vis = [...document.querySelectorAll(".tab-content")].find((t) => !t.classList.contains("hidden") && t.offsetParent !== null);
  if (!vis) return { error: "no visible tab" };
  const label = vis.id;

  // A. Row vertical center alignment (>6px delta between siblings' centers)
  const rowIssues = [];
  vis.querySelectorAll(".style-row, .setting-item, .update-row, .stats-refresh-row, .generate-buttons, .history-actions, .drop-actions").forEach((row) => {
    const kids = [...row.children].filter((k) => k.offsetParent !== null);
    if (kids.length < 2) return;
    const centers = kids.map((k) => { const r = k.getBoundingClientRect(); return r.top + r.height / 2; });
    const maxDelta = Math.max(...centers) - Math.min(...centers);
    if (maxDelta > 6) {
      rowIssues.push({ row: row.className.split(" ")[0] + (row.id ? "#" + row.id : ""), delta: Math.round(maxDelta), kids: kids.map((k) => k.tagName + "." + (k.className || "").split(" ")[0] + "@" + Math.round(k.getBoundingClientRect().height)) });
    }
  });
  out.push(["A row center misalignment", rowIssues]);

  // B. Left-edge consistency among panel siblings (groups of >3 visible items)
  const edgeIssues = [];
  vis.querySelectorAll(".generate-group, .settings-section, .about-section, .history-section, .generate-preview, .dynamic-panel").forEach((g) => {
    const items = [...g.children].filter((k) => k.offsetParent !== null);
    if (items.length < 3) return;
    const edges = {};
    items.forEach((k) => {
      const cls = k.tagName + (k.className ? "." + k.className.split(" ")[0] : "") + (k.id ? "#" + k.id : "");
      const e = Math.round(k.getBoundingClientRect().left);
      (edges[e] = edges[e] || []).push(cls);
    });
    const distinct = Object.keys(edges).map(Number).sort((a, b) => a - b);
    if (distinct.length > 1) edgeIssues.push({ group: (g.className || "").split(" ")[0] + (g.id ? "#" + g.id : ""), edges: distinct.map((e) => e + "px [" + edges[e].slice(0, 3).join(", ") + "]").join(" | ") });
  });
  out.push(["B left-edge inconsistency", edgeIssues]);

  // C. Vertical rhythm between consecutive top-level groups
  const rhythm = [];
  const kids = [...vis.children].filter((k) => k.offsetParent !== null);
  for (let i = 0; i < kids.length - 1; i++) {
    const a = kids[i].getBoundingClientRect(), b = kids[i + 1].getBoundingClientRect();
    if (a.height > 0 && b.height > 0) rhythm.push(Math.round(b.top - a.bottom) + "px: " + (kids[i].id || kids[i].className.split(" ")[0]) + "→" + (kids[i + 1].id || kids[i + 1].className.split(" ")[0]));
  }
  out.push(["C vertical rhythm", rhythm]);

  // D. Horizontal overflow
  const ov = [];
  vis.querySelectorAll("*").forEach((el) => {
    if (el.offsetParent === null) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > window.innerWidth + 1)) ov.push(el.tagName + "." + (el.className || "").toString().split(" ")[0] + " right=" + Math.round(r.right));
  });
  out.push(["D h-overflow", ov]);

  // E. Label typography consistency (font-size/weight per label class)
  const fsMap = {};
  vis.querySelectorAll(".setting-label, .style-lbl, .step-title, .setting-desc, .group-title, .setting-info > div:first-child").forEach((el) => {
    if (el.offsetParent === null) return;
    const cs = getComputedStyle(el);
    const k = el.className.toString().split(" ")[0];
    (fsMap[k] = fsMap[k] || new Set()).add(cs.fontSize + "/" + cs.fontWeight + "/" + cs.lineHeight);
  });
  out.push(["E label typography", Object.fromEntries(Object.entries(fsMap).map(([k, v]) => [k, [...v]]))]);

  // F. Input/control height consistency within the tab
  const hMap = {};
  vis.querySelectorAll("input[type=text], input[type=color], select, textarea, .toggle").forEach((el) => {
    if (el.offsetParent === null) return;
    const h = Math.round(el.getBoundingClientRect().height);
    const k = el.tagName.toLowerCase() + (el.type ? "[type=" + el.type + "]" : "");
    (hMap[k] = hMap[k] || new Set()).add(h + "px");
  });
  out.push(["F control heights", Object.fromEntries(Object.entries(hMap).map(([k, v]) => [k, [...v]]))]);

  return { label, out };
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 960, height: 1000 } });
await page.addInitScript(STUB);
await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

for (const t of ["scan", "generate", "history", "settings", "stats"]) {
  await page.evaluate((tt) => { if (window.requestSwitchTab) window.requestSwitchTab(tt); }, t);
  await page.waitForTimeout(350);
  const res = await page.evaluate(MEASURE);
  console.log("\n########## " + res.label + " ##########");
  for (const [name, data] of res.out) {
    const s = JSON.stringify(data, null, 1);
    console.log("--- " + name + (data && data.length === 0 ? ": OK" : ":\n" + s.slice(0, 2200)));
  }
}
await browser.close();
