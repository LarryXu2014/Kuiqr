// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// Kuiqr — Background Service Worker (v2.4.2.1)
// Features:
//   1. Right-click image → "Scan QR Code" (direct decode)
//   2. Keyboard shortcut Cmd/Ctrl+Shift+Y → capture screen + inject overlay
//   3. Popup "Scan Current Screen" → same capture + overlay
//   4. Overlay drag-to-select → crop → decode → open URL/copy text
// ============================================================

// Cross-browser jsQR loading:
// - Chrome/Edge/Firefox (service worker): use importScripts
// - Firefox (background page): jsQR loaded via background.scripts array
if (typeof importScripts === "function") {
  importScripts("jsQR.js");
}

function log(...args) {
  console.log("[Kuiqr]", ...args);
}

log("Service worker started v1.6.0");

// ── Keep service worker alive in MV3 ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive") log("Keepalive alarm fired");
});

function startKeepalive() {
  chrome.alarms.create("keepalive", { periodInMinutes: 0.5 });
}

chrome.runtime.onInstalled.addListener(startKeepalive);
chrome.runtime.onStartup.addListener(startKeepalive);
startKeepalive();

// ── Context Menu ──
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scan-qr-code",
    title: "Scan QR Code",
    contexts: ["image"],
  });
  // Seed a default shortcut if none is stored yet (platform-aware).
  chrome.storage.local.get("qrShortcut", (res) => {
    if (!res.qrShortcut) {
      const isMac = /Mac/i.test(navigator.userAgent || "");
      chrome.storage.local.set({ qrShortcut: isMac ? "Meta+Shift+Y" : "Control+Shift+Y" });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== "scan-qr-code") return;

  const srcUrl = info.srcUrl;
  if (!srcUrl) {
    notifyError("No image found. Try the keyboard shortcut or popup button instead.");
    return;
  }

  try {
    const data = await decodeQRFromUrl(srcUrl, tab.id);
    if (!data) {
      notify("No QR Code Found", "This image does not contain a detectable QR code.");
      await saveToHistory(null, srcUrl, "no-qr", "No QR code detected");
      return;
    }
    // Explicit success toast for right-click scans so the user always sees feedback.
    const display = data.length > 100 ? data.slice(0, 100) + "\u2026" : data;
    const isUrl = /^(https?:\/\/|www\.)/i.test(data);
    notify(
      isUrl ? "QR Found - Opening URL" : "QR Found - Copied to Clipboard",
      display
    );
    await actOnQRData(data, srcUrl);
  } catch (err) {
    log("QR scan error:", err);
    notifyError("Could not read the image. Try the shortcut or popup button.");
  }
});

// ── Keyboard Shortcut ──
// The PRIMARY, reliable trigger is chrome.commands (declared in manifest.json as
// "trigger-scan", suggested key Cmd/Ctrl+Shift+Y). Chrome registers it at the
// browser level — it fires regardless of which tab/page has focus and does NOT
// depend on a content script or on a page-level keydown listener. This is far
// more robust than the old content.js page-keydown approach, which only fired
// when the OS delivered the keystroke to the focused page.
//
// content.js ALSO listens for a *custom* recorded shortcut (only when the user
// changed it from the default). The default key is owned exclusively by
// chrome.commands, so the two never double-fire.
chrome.commands.onCommand.addListener((command) => {
  if (command !== "trigger-scan") return;
  // While the popup is recording a NEW shortcut, the default key (Cmd/Ctrl+Shift+Y)
  // must NOT start a scan — it is being captured by the recorder. We suppress it
  // here because chrome.commands is the browser-level owner of the default key and
  // is not affected by the content-script's `recording` guard.
  chrome.storage.local.get("recordingShortcut", (res) => {
    if (res.recordingShortcut) {
      log("trigger-scan ignored: popup is recording a new shortcut");
      return;
    }
    captureAndShowOverlay().catch((err) => {
      log("trigger-scan command error:", err);
      notifyError(err && err.message ? err.message : "Scan failed");
    });
  });
});

// ── Popup handler: show overlay ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getHistory") {
    chrome.storage.local.get("history", (res) => {
      sendResponse(res.history || []);
    });
    return true;
  }

  if (msg.action === "clearHistory") {
    chrome.storage.local.set({ history: [] }, () => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === "openUrl") {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ success: true });
    return true;
  }

  if (msg.action === "showOverlay") {
    (async () => {
      try {
        await captureAndShowOverlay();
        sendResponse({ success: true });
      } catch (err) {
        log("Popup showOverlay error:", err);
        notifyError(err.message || "Scan failed");
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // ── Overlay sends back cropped image for decoding ──
  if (msg.action === "decodeCropped") {
    (async () => {
      try {
        // Notify that scanning has started (same sequence as desktop app)
        notify("Kuiqr", "Scanning\u2026");
        const data = await decodeDataUrl(msg.dataUrl);
        if (!data) {
          log("decodeCropped: no QR found");
          sendResponse({ result: "none" });
          return;
        }
        log("decodeCropped: decoded:", data.slice(0, 80));
        const isUrl = /^(https?:\/\/|www\.)/i.test(data.trim());
        await actOnQRData(data, "screenshot-selection");
        sendResponse({ result: isUrl ? "url" : "text", data });
      } catch (err) {
        log("decodeCropped error:", err);
        sendResponse({ result: "error", message: err.message || "Decode failed" });
      }
    })();
    return true;
  }
});

// ── Capture screen and inject overlay ──
async function captureAndShowOverlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  log("Active tab:", tab ? `${tab.id}: ${tab.url?.slice(0, 60)}` : "NONE");

  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  if (!tab.url || /^chrome:\/\//i.test(tab.url) || /^edge:\/\//i.test(tab.url) || /^about:/i.test(tab.url)) {
    throw new Error("Cannot scan on browser internal pages. Switch to a regular webpage.");
  }

  log("Capturing visible tab...");
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
  log("Capture succeeded, length:", dataUrl.length);

  log("Injecting overlay into tab", tab.id);
  await injectOverlay(tab.id, dataUrl);
  log("Overlay injected successfully");
}

// ── Inject the overlay function directly into the page ──
async function injectOverlay(tabId, screenshotUrl) {
  // Self-contained function that creates the dim-screen + drag-to-select overlay.
  // It runs in the ISOLATED content-script world, so chrome.runtime is available.
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (screenshotUrl) => {
      // Remove any existing overlay
      const existing = document.getElementById("qrscan-overlay");
      if (existing) existing.remove();

      const dpr = window.devicePixelRatio || 1;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // ── Overlay root ──
      const root = document.createElement("div");
      root.id = "qrscan-overlay";
      root.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "width:100vw",
        "height:100vh",
        "z-index:2147483647",
        "cursor:crosshair",
        "user-select:none",
        "-webkit-user-select:none",
      ].join(";");

      // ── Screenshot image (full brightness) ──
      const img = document.createElement("img");
      img.src = screenshotUrl;
      img.style.cssText = [
        "position:absolute",
        "top:0",
        "left:0",
        "width:100vw",
        "height:100vh",
        "object-fit:fill",
        "pointer-events:none",
        "z-index:1",
      ].join(";");

      // ── Selection box (bright border + fill) ──
      const sel = document.createElement("div");
      sel.style.cssText = [
        "position:absolute",
        "border:3px solid #22d3ee",
        "background:rgba(34,211,238,0.15)",
        "pointer-events:none",
        "display:none",
        "box-shadow:0 0 0 2px rgba(255,255,255,0.6), 0 0 30px rgba(34,211,238,0.6)",
        "z-index:3",
      ].join(";");

      // ── Dim layers (4 divs for reliable cross-browser dimming) ──
      const dimTop = document.createElement("div");
      const dimBottom = document.createElement("div");
      const dimLeft = document.createElement("div");
      const dimRight = document.createElement("div");
      const dimStyle = "position:absolute;background:rgba(0,0,0,0.55);pointer-events:none;z-index:2;";

      // ── Hint text ──
      const hint = document.createElement("div");
      hint.textContent = "Drag to select the QR code area \u00b7  Press Esc to cancel";
      hint.style.cssText = [
        "position:fixed",
        "top:24px",
        "left:50%",
        "transform:translateX(-50%)",
        "background:rgba(79,70,229,0.95)",
        "color:white",
        "padding:12px 28px",
        "border-radius:12px",
        "font-family:-apple-system,system-ui,sans-serif",
        "font-size:15px",
        "font-weight:600",
        "pointer-events:none",
        "box-shadow:0 4px 20px rgba(0,0,0,0.4)",
        "white-space:nowrap",
        "z-index:4",
      ].join(";");

      // ── Cancel button (top-right) ──
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "\u2715";
      cancelBtn.style.cssText = [
        "position:fixed",
        "top:16px",
        "right:20px",
        "width:36px",
        "height:36px",
        "border-radius:50%",
        "border:none",
        "background:rgba(0,0,0,0.6)",
        "color:white",
        "font-size:18px",
        "cursor:pointer",
        "z-index:5",
        "display:flex",
        "align-items:center",
        "justify-content:center",
      ].join(";");
      cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeOverlay();
      });
      cancelBtn.addEventListener("mousedown", (e) => e.stopPropagation());

      root.appendChild(img);
      root.appendChild(dimTop);
      root.appendChild(dimBottom);
      root.appendChild(dimLeft);
      root.appendChild(dimRight);
      root.appendChild(sel);
      root.appendChild(hint);
      root.appendChild(cancelBtn);
      document.documentElement.appendChild(root);

      // ── Drag logic ──
      let dragging = false;
      let isDecoding = false;
      let sx = 0, sy = 0, ex = 0, ey = 0;

      function updateDimAreas() {
        const left = Math.min(sx, ex);
        const top = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);

        if (w < 2 || h < 2) {
          // No selection yet — dim everything
          dimTop.style.cssText = dimStyle + "top:0;left:0;width:100%;height:100%;";
          dimBottom.style.cssText = "display:none;";
          dimLeft.style.cssText = "display:none;";
          dimRight.style.cssText = "display:none;";
          return;
        }

        dimTop.style.cssText = dimStyle + `top:0;left:0;width:100%;height:${top}px;`;
        dimBottom.style.cssText = dimStyle + `top:${top + h}px;left:0;width:100%;height:${Math.max(0, vh - top - h)}px;`;
        dimLeft.style.cssText = dimStyle + `top:${top}px;left:0;width:${left}px;height:${h}px;`;
        dimRight.style.cssText = dimStyle + `top:${top}px;left:${left + w}px;width:${Math.max(0, vw - left - w)}px;height:${h}px;`;
      }

      root.addEventListener("mousedown", (e) => {
        if (isDecoding || e.button !== 0) return;
        dragging = true;
        sx = ex = e.clientX;
        sy = ey = e.clientY;
        sel.style.display = "block";
        hint.style.display = "none";
        cancelBtn.style.display = "none";
        updateDimAreas();
      });

      root.addEventListener("mousemove", (e) => {
        if (isDecoding || !dragging) return;
        ex = e.clientX;
        ey = e.clientY;
        const left = Math.min(sx, ex);
        const top = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);
        sel.style.left = left + "px";
        sel.style.top = top + "px";
        sel.style.width = w + "px";
        sel.style.height = h + "px";
        updateDimAreas();
      });

      root.addEventListener("mouseup", async (e) => {
        if (isDecoding || !dragging) return;
        dragging = false;

        const left = Math.min(sx, ex);
        const top = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);

        // A bare click / tiny accidental press should NOT close the overlay.
        // Only an intentional selection (>= 10 px) starts the scan. Otherwise
        // we just reset the selection and keep the overlay open so the user can
        // try again without re-pressing the shortcut.
        if (w < 10 || h < 10) {
          sel.style.display = "none";
          hint.style.display = "block";
          cancelBtn.style.display = "flex";
          sx = ex = sy = ey = 0;
          updateDimAreas();
          return;
        }

        // Show scanning state and ignore further mouse input until decoding is done.
        isDecoding = true;
        sel.style.borderColor = "#4f46e5";
        hint.style.display = "block";
        hint.textContent = "Scanning...";
        hint.style.background = "rgba(79,70,229,0.95)";
        dimTop.style.display = "none";
        dimBottom.style.display = "none";
        dimLeft.style.display = "none";
        dimRight.style.display = "none";

        // Crop the selected region from the full-res screenshot
        const cropCanvas = document.createElement("canvas");
        const cropW = Math.round(w * dpr);
        const cropH = Math.round(h * dpr);
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cctx = cropCanvas.getContext("2d");
        cctx.drawImage(
          img,
          Math.round(left * dpr),
          Math.round(top * dpr),
          cropW, cropH,
          0, 0, cropW, cropH
        );
        const croppedDataUrl = cropCanvas.toDataURL("image/png");

        // Send to background for QR decoding
        let result;
        try {
          result = await chrome.runtime.sendMessage({
            action: "decodeCropped",
            dataUrl: croppedDataUrl,
          });
        } catch (err) {
          result = { result: "error", message: "Decode failed" };
        }

        closeOverlay();
        showResult(result);
      });

      // Escape to cancel
      function keyHandler(e) {
        if (e.key === "Escape") closeOverlay();
      }
      document.addEventListener("keydown", keyHandler, true);

      function closeOverlay() {
        root.remove();
        document.removeEventListener("keydown", keyHandler, true);
      }

      // Initialize dim on full screen
      updateDimAreas();

      // ── Result badge ──
      function showResult(result) {
        const badge = document.createElement("div");
        badge.style.cssText = [
          "position:fixed",
          "top:50%",
          "left:50%",
          "transform:translate(-50%,-50%)",
          "color:white",
          "padding:16px 36px",
          "border-radius:14px",
          "font-family:-apple-system,system-ui,sans-serif",
          "font-size:16px",
          "font-weight:600",
          "z-index:2147483647",
          "pointer-events:none",
          "box-shadow:0 8px 32px rgba(0,0,0,0.3)",
          "white-space:nowrap",
          "transition:opacity 0.3s",
        ].join(";");

        if (result.result === "url") {
          badge.style.background = "#22c55e";
          badge.textContent = "QR found \u2014 opening in new tab...";
        } else if (result.result === "text") {
          badge.style.background = "#22c55e";
          badge.textContent = "QR found \u2014 copied to clipboard!";
        } else if (result.result === "error") {
          badge.style.background = "#dc2626";
          badge.textContent = "Error: " + (result.message || "unknown");
        } else {
          badge.style.background = "#f59e0b";
          badge.textContent = "No QR code found in that area.";
        }

        document.documentElement.appendChild(badge);
        setTimeout(() => { badge.style.opacity = "0"; }, 2000);
        setTimeout(() => { badge.remove(); }, 2300);
      }
    },
    args: [screenshotUrl],
  });
}

// ============================================================
// QR Decoding & Helpers
// ============================================================

// Cross-browser canvas creation:
// - Service worker (Chrome/Edge/Firefox): OffscreenCanvas
// - Background page (Firefox): regular <canvas> via document
function createCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  // Firefox background page fallback
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// ── Robust QR decoding with multiple preprocessing strategies ──
// Mirrors the desktop app's decoder so the browser extension can scan the same
// hard / artistic / decorative QR codes (e.g. Chrome dinosaur QR).
// Handles: artistic QR, low contrast, color backgrounds, small QR codes,
// inverted codes, and noisy images. Kept bounded so a bad selection never hangs.
const DECODER_BUDGET_FAST = 80;
const DECODER_BUDGET_MEDIUM = 220;
const DECODER_BUDGET_DEEP = 550;
const DECODER_BUDGET_ABSOLUTE = 800;

function looksEmptyOrUniform(imageData) {
  const d = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const sampleStep = Math.max(8, Math.floor(Math.min(w, h) / 16));
  let samples = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  let minL = 255, maxL = 0;

  for (let y = 0; y < h; y += sampleStep) {
    for (let x = 0; x < w; x += sampleStep) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      rSum += r; gSum += g; bSum += b;
      if (lum < minL) minL = lum;
      if (lum > maxL) maxL = lum;
      samples++;
    }
  }

  if (samples === 0) return true;
  if (maxL - minL < 18) return true;

  const rAvg = rSum / samples;
  const gAvg = gSum / samples;
  const bAvg = bSum / samples;
  let varianceSum = 0;
  for (let y = 0; y < h; y += sampleStep) {
    for (let x = 0; x < w; x += sampleStep) {
      const i = (y * w + x) * 4;
      varianceSum += Math.abs(d[i] - rAvg) + Math.abs(d[i + 1] - gAvg) + Math.abs(d[i + 2] - bAvg);
    }
  }
  return varianceSum / samples < 12;
}

function scaleImageData(ctx, w, h, sw, sh) {
  const sc = createCanvas(sw, sh);
  const sctx = sc.getContext("2d");
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  return sctx.getImageData(0, 0, sw, sh);
}

function tryScaleDecode(ctx, w, h, s, decode) {
  const sw = Math.round(w * s);
  const sh = Math.round(h * s);
  if (sw < 10 || sh < 10) return null;
  const sd = scaleImageData(ctx, w, h, sw, sh);
  return decode(sd);
}

function grayscale(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return imageData;
}

function stretchContrast(imageData) {
  const d = imageData.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < min) min = d[i];
    if (d[i] > max) max = d[i];
  }
  if (max > min) {
    const range = max - min;
    for (let i = 0; i < d.length; i += 4) {
      const v = ((d[i] - min) / range) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  return imageData;
}

function binaryThreshold(imageData, thresh) {
  const out = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] >= thresh ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return out;
}

function invertBin(imageData) {
  const out = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
  }
  return out;
}

function decodeImageRobust(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const start = performance.now();

  if (w < 50 || h < 50) return null;
  if (looksEmptyOrUniform(imageData)) return null;

  // FAST PATH
  let result = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
  if (result) return result;

  for (const s of [1.5, 2]) {
    if (performance.now() - start > DECODER_BUDGET_FAST) break;
    result = tryScaleDecode(ctx, w, h, s, (sd) =>
      jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
    );
    if (result) return result;
  }

  if (w > 600 || h > 600) {
    if (performance.now() - start <= DECODER_BUDGET_FAST) {
      result = tryScaleDecode(ctx, w, h, 0.5, (sd) =>
        jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
      );
      if (result) return result;
    }
  }

  // MEDIUM PATH
  if (performance.now() - start <= DECODER_BUDGET_MEDIUM) {
    let gray = grayscale(ctx.getImageData(0, 0, w, h));
    gray = stretchContrast(gray);

    result = jsQR(gray.data, w, h, { inversionAttempts: "attemptBoth" });
    if (result) return result;

    for (const thresh of [100, 128, 160]) {
      if (performance.now() - start > DECODER_BUDGET_MEDIUM) break;
      const bin = binaryThreshold(gray, thresh);
      result = jsQR(bin.data, w, h, { inversionAttempts: "attemptBoth" });
      if (result) return result;
    }
  }

  // DEEP PATH
  const deepScales = [0.75, 1.25, 1.5];
  for (const s of deepScales) {
    if (performance.now() - start > DECODER_BUDGET_DEEP) break;

    const sw = Math.round(w * s);
    const sh = Math.round(h * s);
    if (sw < 80 || sh < 80) continue;

    const sd = scaleImageData(ctx, w, h, sw, sh);
    let gray = grayscale(sd);
    gray = stretchContrast(gray);

    result = jsQR(gray.data, sw, sh, { inversionAttempts: "attemptBoth" });
    if (result) return result;

    for (const thresh of [80, 110, 140, 170]) {
      if (performance.now() - start > DECODER_BUDGET_DEEP) break;
      const bin = binaryThreshold(gray, thresh);
      result = jsQR(bin.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;

      const invBin = invertBin(bin);
      result = jsQR(invBin.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;
    }
  }

  return null;
}

async function decodeDataUrl(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const result = decodeImageRobust(ctx, bitmap.width, bitmap.height);
  bitmap.close();
  return result ? result.data : null;
}

async function decodeQRFromUrl(url, tabId) {
  let blob;

  if (url.startsWith("blob:")) {
    blob = await fetchBlobFromTab(url, tabId);
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not fetch image (HTTP ${response.status})`);
    blob = await response.blob();
  }

  // Convert to dataURL and reuse the robust decoder
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  return decodeDataUrl(dataUrl);
}

async function fetchBlobFromTab(blobUrl, tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: async (url) => {
          const resp = await fetch(url);
          const blob = await resp.blob();
          return await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(blob);
          });
        },
        args: [blobUrl],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (results && results[0]) {
          fetch(results[0].result)
            .then((r) => r.blob())
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error("Could not read blob image"));
        }
      }
    );
  });
}

async function actOnQRData(rawData, source) {
  const data = (rawData || "").trim();
  if (!data) {
    notify("No QR Code Found", "The QR code was empty.");
    return;
  }

  const isUrl = /^(https?:\/\/|www\.)/i.test(data);

  if (isUrl) {
    const targetUrl = data.startsWith("http") ? data : `https://${data}`;
    notify("QR Found \u2014 Opening URL", targetUrl);
    chrome.tabs.create({ url: targetUrl });
  } else {
    // Copy from the page (content script) — the service worker itself
    // cannot write to the clipboard, so copyToClipboard() here silently
    // failed before. copyTextToActiveTab() asks the active tab to copy.
    notify(
      "QR Found \u2014 Copied to Clipboard",
      data.length > 100 ? data.slice(0, 100) + "\u2026" : data
    );
    await copyTextToActiveTab(data);
  }

  await saveToHistory(data, source, isUrl ? "url" : "text", null);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // Silently skip
  }
}

// Copy text to the clipboard by asking the active tab's content script to do
// it (the service worker cannot access navigator.clipboard). Falls back to an
// injected copy, then a best-effort SW copy.
async function copyTextToActiveTab(text) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { action: "copyText", text });
        if (resp && resp.ok) return;
      } catch (_) {
        // content script not present on this tab — fall through
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (t) => navigator.clipboard && navigator.clipboard.writeText(t),
          args: [text],
        });
        return;
      } catch (_) {
        // ignore
      }
    }
  } catch (_) {
    // ignore
  }
  // Last resort (may work on Firefox background page)
  try {
    await navigator.clipboard?.writeText(text);
  } catch (_) {}
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
      priority: 2,
    });
  } catch {
    try {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
    } catch {
      // give up
    }
  }
}

function notifyError(message) {
  notify("Kuiqr Error", message);
}

async function saveToHistory(data, srcUrl, type, error) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({
    data,
    srcUrl,
    type,
    error,
    timestamp: Date.now(),
  });
  await chrome.storage.local.set({ history: history.slice(0, 50) });
}
