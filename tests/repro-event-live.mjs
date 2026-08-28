// Drive the REAL running Kuiqr app via CDP: generate a calendar QR, then
// capture the actual on-screen pixels (like a camera would see) and decode
// them with jsQR to verify scannability end-to-end.
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9229");
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];
console.log("connected:", page.url());

// Skip onboarding if present (fresh profile) and go to Generate tab.
await page.evaluate(() => {
  const wizard = document.getElementById("setup-wizard");
  if (wizard && !wizard.classList.contains("hidden")) {
    // fast-forward: mark all gates done
    window.qrAPI.markSetupComplete();
    window.qrAPI.markOnboardingComplete();
    wizard.classList.add("hidden");
  }
  if (window.requestSwitchTab) window.requestSwitchTab("generate");
});
await page.waitForTimeout(500);

// Select the calendar/event template through the real dropdown.
await page.selectOption("#gen-template", "event");
await page.waitForTimeout(400);

// Fill the fields as a user would (via native input events).
await page.locator("#tpl-event-start").evaluate((el) => {
  el.value = "2026-08-28T14:00";
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.locator("#tpl-event-end").evaluate((el) => {
  el.value = "2026-08-28T15:00";
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.fill("#tpl-event-summary", "Team Meeting");
await page.fill("#tpl-event-location", "Conference Room 3");
await page.waitForTimeout(800);

// Report the generated content + preview state.
const info = await page.evaluate(() => {
  const state = window.QRGen.getState();
  const img = document.getElementById("gen-img");
  const rect = img ? img.getBoundingClientRect() : null;
  return {
    content: window.QRGen.getContent ? window.QRGen.getContent() : "(no getter)",
    values: state.values.event,
    imgRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
    imgNatural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
    cssWidth: img ? getComputedStyle(img).width : null,
  };
});
console.log("GENERATED:", JSON.stringify(info, null, 2));

// Capture the on-screen pixels of the QR area exactly as a camera would see it.
const clip = info.imgRect ? { x: Math.max(0, info.imgRect.x - 4), y: Math.max(0, info.imgRect.y - 4), width: info.imgRect.w + 8, height: info.imgRect.h + 8 } : null;
const shot = await page.screenshot({ clip });
const b64 = shot.toString("base64");

// Decode those pixels with jsQR inside the page.
const decoded = await page.evaluate(async (dataUrl) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext("2d");
  cx.drawImage(img, 0, 0);
  const { data, width, height } = cx.getImageData(0, 0, img.width, img.height);
  const r = window.jsQR(data, width, height);
  return r ? r.data : null;
}, "data:image/png;base64," + b64);
console.log("DECODED FROM SCREEN PIXELS:", JSON.stringify(decoded));

// Also decode the full-window screenshot (phone pointed at whole screen).
const full = await page.screenshot();
const decodedFull = await page.evaluate(async (dataUrl) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext("2d");
  cx.drawImage(img, 0, 0);
  const { data, width, height } = cx.getImageData(0, 0, img.width, img.height);
  const r = window.jsQR(data, width, height);
  return r ? r.data : null;
}, "data:image/png;base64," + full.toString("base64"));
console.log("DECODED FROM FULL WINDOW:", JSON.stringify(decodedFull));

await browser.close();
