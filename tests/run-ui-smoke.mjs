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
  getHistory: async () => [],
  onDecoded: async (text, opts) => { window.__onDecodedArgs = { text, opts }; return { ok: true }; },
  markSetupComplete: async () => {}, markOnboardingComplete: async () => {},
  shouldShowTutorial: async () => false, markTutorialShown: async () => {},
  restartApp: async () => {},
  checkUpdates: async () => ({ latest: false }),
  getDynamicCodes: async () => [],
  scanWifi: async () => ({ ok: true, networks: [ { ssid: "HomeNet-5G", signal: 82 }, { ssid: "Cafe Guest", signal: 40 } ] }),
  joinWifi: async (p) => { window.__joinWifiArgs = p; return { ok: true }; },
  openContactEvent: async (p) => { window.__contactArgs = p; return { ok: true }; },
  openGeo: async (p) => { window.__geoArgs = p; return { ok: true }; },
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
  openUrl: async (url) => { window.__openUrlArgs = url; return { ok: true }; },
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

// 9. Dynamic (trackable) QR row sits directly under the action buttons, above the style panel.
const dynPos = await page.evaluate(() => {
  const g = document.getElementById("dynamic-group");
  return { prev: g && g.previousElementSibling ? g.previousElementSibling.className : "", beforeStyle: !!g && !!document.getElementById("style-panel") && g.compareDocumentPosition(document.getElementById("style-panel")) & Node.DOCUMENT_POSITION_FOLLOWING };
});
check("dynamic group sits under action buttons", dynPos.prev.includes("generate-buttons"), 'prev="' + dynPos.prev + '"');
check("dynamic group above style panel", !!dynPos.beforeStyle);

// 10. Toggling it on reveals the panel and rotates the chevron (expanded class).
// (The checkbox is visually hidden behind the toggle slider — flip it via JS.)
await page.locator("#gen-dynamic").evaluate((el) => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
await page.waitForTimeout(150);
check("dynamic panel expands on toggle", await page.locator("#gen-dynamic-panel").evaluate((el) => el.getClientRects().length > 0));
check("dynamic chevron rotates (expanded)", await page.locator("#dynamic-group").evaluate((el) => el.classList.contains("expanded")));

// 11. Scanning one of your OWN trackable short links shows the destination UI
//     (Trackable QR badge + "redirects to" + no auto-open), not a blind URL open.
await page.evaluate(() => {
  localStorage.setItem("kuiqr.dynamicCodes", JSON.stringify([
    { code: "abc1234", shortUrl: "http://localhost:3000/abc1234", destination: "https://example.com/landing", createdAt: 0 },
  ]));
});
const scanRes = await page.evaluate(async () => {
  await window.__kuiqrTest.handleDecodedResult({ data: "http://localhost:3000/abc1234" });
  return {
    badge: document.getElementById("result-badge").textContent,
    data: document.getElementById("result-data").textContent,
    sub: (document.querySelector("#result-actions .result-sub") || {}).textContent || "",
    noAutoOpen: !!(window.__onDecodedArgs && window.__onDecodedArgs.opts && window.__onDecodedArgs.opts.noAutoOpen),
    btns: Array.from(document.querySelectorAll("#result-actions .btn-result")).map((b) => b.textContent),
  };
});
check("trackable scan shows Trackable QR badge", scanRes.badge === "Trackable QR", 'got "' + scanRes.badge + '"');
check("trackable scan shows destination", scanRes.sub.includes("https://example.com/landing"), 'sub="' + scanRes.sub + '"');
check("trackable scan skips auto-open", scanRes.noAutoOpen);
check("trackable result offers destination + stats actions", scanRes.btns.length >= 3, "btns=" + JSON.stringify(scanRes.btns));

// 12. A NON-trackable URL still behaves the old way (no noAutoOpen opt).
await page.evaluate(() => { window.__onDecodedArgs = null; });
const urlScan = await page.evaluate(async () => {
  await window.__kuiqrTest.handleDecodedResult({ data: "https://example.org" });
  return { noAutoOpen: !!(window.__onDecodedArgs && window.__onDecodedArgs.opts && window.__onDecodedArgs.opts.noAutoOpen), badge: document.getElementById("result-badge").textContent };
});
check("regular URL scan unaffected", urlScan.noAutoOpen === false && urlScan.badge === "URL");

// 13. Accent color: clicking a swatch re-themes the UI live and marks dirty.
await page.evaluate(() => { if (window.requestSwitchTab) window.requestSwitchTab("settings"); });
await page.waitForTimeout(250);
await page.click('.accent-swatch[data-accent="#dc2626"]');
await page.waitForTimeout(150);
const prim = await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));
check("accent applies live", prim === "#dc2626", "got " + prim);
const selSwatch = await page.locator('.accent-swatch[data-accent="#dc2626"]').getAttribute("class");
check("accent swatch selected state", (selSwatch || "").includes("selected"));
const saveBtnText = await page.locator("#save-settings-btn").textContent();
check("accent change marks settings dirty", (saveBtnText || "").includes("*"), 'btn="' + saveBtnText + '"');

// 14. Rich QR payloads: scanning WIFI / vCard / geo QR codes shows real actions
//     (join network / add contact / show in maps), not just a copy button.
// (Step 13 left Settings dirty — save first so the tab switch isn't blocked by
// the unsaved-changes prompt, then go back to Scan where the result card lives.)
await page.click("#save-settings-btn");
await page.waitForTimeout(200);
await page.evaluate(() => { if (window.requestSwitchTab) window.requestSwitchTab("scan"); });
await page.waitForTimeout(250);
const scanPayload = async (data) => page.evaluate(async (d) => {
  await window.__kuiqrTest.handleDecodedResult({ data: d });
  return {
    badge: document.getElementById("result-badge").textContent,
    badgeCls: document.getElementById("result-badge").className,
    data: document.getElementById("result-data").textContent,
    btns: Array.from(document.querySelectorAll("#result-actions .btn-result")).map((b) => b.textContent),
    sub: (document.querySelector("#result-actions .result-sub") || {}).textContent || "",
  };
}, data);

// WIFI payload with escaped SSID + password (real-world escaping from a phone).
const wifiRes = await scanPayload('WIFI:T:WPA;S:Cafe\\;Guest;P:pa\\,ss;H:false;;');
check("wifi scan shows Wi-Fi badge", wifiRes.badge === "Wi-Fi", 'got "' + wifiRes.badge + '"');
check("wifi scan shows friendly summary", wifiRes.data.includes("Cafe;Guest") && wifiRes.data.includes("WPA"), 'data="' + wifiRes.data + '"');
check("wifi scan offers Connect action", wifiRes.btns.some((b) => b.includes("Connect")), "btns=" + JSON.stringify(wifiRes.btns));

// Clicking Connect calls joinWifi with the UNESCAPED ssid/password.
await page.locator("#result-actions .btn-result", { hasText: "Connect" }).first().click();
await page.waitForTimeout(150);
const joinArgs = await page.evaluate(() => window.__joinWifiArgs);
check("wifi join passes parsed ssid/password", !!joinArgs && joinArgs.ssid === "Cafe;Guest" && joinArgs.password === "pa,ss" && joinArgs.security === "WPA", JSON.stringify(joinArgs));

// vCard payload → Add to Contacts.
const vcardRes = await scanPayload("BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nORG:Acme\nTEL;TYPE=CELL:+1 555 0100\nEMAIL:jane@acme.com\nEND:VCARD");
check("vcard scan shows Contact badge", vcardRes.badge === "Contact", 'got "' + vcardRes.badge + '"');
check("vcard scan shows name summary", vcardRes.data.includes("Jane Doe"), 'data="' + vcardRes.data + '"');
await page.locator("#result-actions .btn-result", { hasText: "Contacts" }).first().click();
await page.waitForTimeout(150);
const contactArgs = await page.evaluate(() => window.__contactArgs);
check("vcard opens with full raw payload", !!contactArgs && contactArgs.kind === "vcard" && contactArgs.content.includes("BEGIN:VCARD") && contactArgs.content.includes("jane@acme.com"));

// Calendar payload (VCALENDAR-wrapped, CRLF — what iOS/Android cameras emit
// and what our generator now produces) → Add to Calendar.
await page.evaluate(() => { window.__contactArgs = null; });
const eventRes = await scanPayload("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Kuiqr//EN\r\nBEGIN:VEVENT\r\nDTSTART:20260828T140000\r\nDTEND:20260828T150000\r\nSUMMARY:Team Meeting\r\nLOCATION:Room 3\r\nEND:VEVENT\r\nEND:VCALENDAR");
check("event scan shows Event badge", eventRes.badge === "Event", 'got "' + eventRes.badge + '"');
check("event scan shows summary", eventRes.data.includes("Team Meeting"), 'data="' + eventRes.data + '"');
check("event scan offers Calendar action", eventRes.btns.some((b) => b.includes("Calendar")), "btns=" + JSON.stringify(eventRes.btns));
await page.locator("#result-actions .btn-result", { hasText: "Calendar" }).first().click();
await page.waitForTimeout(150);
const eventArgs = await page.evaluate(() => window.__contactArgs);
check("event opens with full VCALENDAR payload", !!eventArgs && eventArgs.kind === "event" && eventArgs.content.includes("BEGIN:VCALENDAR") && eventArgs.content.includes("Team Meeting") && eventArgs.content.includes("END:VCALENDAR"));

// Legacy bare VEVENT payload (old Kuiqr codes) must still classify as an event.
const legacyEventRes = await scanPayload("BEGIN:VEVENT\nDTSTART:20260828T140000\nDTEND:20260828T150000\nSUMMARY:Old Code\nEND:VEVENT");
check("legacy bare VEVENT still classified as event", legacyEventRes.badge === "Event", 'got "' + legacyEventRes.badge + '"');

// geo payload → Show in Maps.
const geoRes = await scanPayload("geo:37.7749,-122.4194");
check("geo scan shows Location badge", geoRes.badge === "Location", 'got "' + geoRes.badge + '"');
await page.locator("#result-actions .btn-result", { hasText: "Maps" }).first().click();
await page.waitForTimeout(150);
const geoArgs = await page.evaluate(() => window.__geoArgs);
check("geo opens coordinates in maps", !!geoArgs && Math.abs(geoArgs.lat - 37.7749) < 1e-6 && Math.abs(geoArgs.lon + 122.4194) < 1e-6, JSON.stringify(geoArgs));

// tel payload → Call button, no joinWifi side effects.
const telRes = await scanPayload("tel:+1-555-0100");
check("tel scan shows Phone badge + Call action", telRes.badge === "Phone" && telRes.btns.some((b) => b === "Call"), "btns=" + JSON.stringify(telRes.btns));

// mailto payload → Open email draft.
const mailtoRes = await scanPayload("mailto:jane@acme.com?subject=Hello&body=Meeting%20at%203");
check("mailto scan shows Email badge + Send Email action", mailtoRes.badge === "Email" && mailtoRes.btns.some((b) => b.includes("Email")), "btns=" + JSON.stringify(mailtoRes.btns));
await page.locator("#result-actions .btn-result", { hasText: "Email" }).first().click();
await page.waitForTimeout(150);
const mailtoUrl = await page.evaluate(() => window.__openUrlArgs);
check("mailto opens mailto: draft URL", typeof mailtoUrl === "string" && mailtoUrl.startsWith("mailto:jane@acme.com") && mailtoUrl.includes("body="));

// Rich payloads must not be auto-opened/blown away: opts.noAutoOpen is passed.
await page.evaluate(() => { window.__onDecodedArgs = null; });
await page.evaluate(async () => { await window.__kuiqrTest.handleDecodedResult({ data: "geo:10,20" }); });
const richOpts = await page.evaluate(() => window.__onDecodedArgs);
check("rich payload recorded with noAutoOpen", !!(richOpts && richOpts.opts && richOpts.opts.noAutoOpen));

const failed = results.filter((r) => !r.ok);
if (errors.length) console.log("\nPage errors:\n  " + errors.join("\n  "));
console.log(`\nUI SMOKE: ${results.length - failed.length}/${results.length} pass`);
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
