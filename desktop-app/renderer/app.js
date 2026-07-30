// ============================================================
// QR Scan & Open — Desktop App Renderer Logic (v2.2.2)
// Features:
//   - In-app scan: paste from clipboard or drag-drop image
//   - Screen capture via overlay (shortcut / button)
//   - Auto-detect keyboard shortcut recorder
//   - History + Settings
// ============================================================

let currentPlatform = null;
let currentShortcut = "CommandOrControl+Shift+Y"; // the active saved shortcut (kept in sync)
let isRecordingShortcut = false; // true while the user is recording a new shortcut

document.addEventListener("DOMContentLoaded", async () => {
  // Detect platform
  currentPlatform = await window.qrAPI.getPlatform();
  updatePlatformUI();

  // Tab navigation
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Listen for external tab switches (from tray)
  window.qrAPI.onSwitchTab((tab) => switchTab(tab));

  // ── In-App Scan: Paste from Clipboard ──
  const pasteBtn = document.getElementById("paste-btn");
  pasteBtn.addEventListener("click", () => {
    if (isRecordingShortcut) return; // never scan while recording a shortcut
    readClipboardImage();
  });

  // Global ⌘V / Ctrl+V listener
  document.addEventListener("paste", (e) => {
    // Only intercept when focused on scan tab body (not an input field)
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (isRecordingShortcut) return; // never scan while recording a shortcut
    e.preventDefault();
    readClipboardImage();
  });

  // ── In-App Scan: Drag & Drop ──
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) loadImageFile(e.target.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
    if (isRecordingShortcut) return; // never scan while recording a shortcut
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      loadImageFile(file);
    }
  });

  // ── Screen Area Scan Button ──
  const scanBtn = document.getElementById("scan-btn");
  scanBtn.addEventListener("click", async () => {
    if (isRecordingShortcut) return; // never scan while recording a shortcut
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span>Starting capture…</span>';
    await window.qrAPI.triggerScan();
    setTimeout(() => {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10 7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>Select Screen Area</span><kbd id="shortcut-display" class="btn-kbd">' + formatShortcutForDisplay(currentShortcut) + '</kbd>';
    }, 2000);
  });

  // ── Result close button ──
  document.getElementById("result-close").addEventListener("click", hideResult);

  // ── Clear preview ──
  document.getElementById("clear-preview").addEventListener("click", clearPreview);

  // ── History ──
  document.getElementById("clear-btn").addEventListener("click", clearHistory);
  await loadHistory();

  // ── Settings ──
  await loadSettingsForm();
  document.getElementById("save-settings-btn").addEventListener("click", saveSettings);
  setupShortcutRecorder();
});

// ============================================================
// Tab Navigation
// ============================================================

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);

  if (tab) tab.classList.add("active");
  if (content) content.classList.add("active");
}

// ============================================================
// Platform UI
// ============================================================

function updatePlatformUI() {
  // Keep the scan button's kbd in sync with the actual shortcut (not hardcoded Y)
  const shortcutEl = document.getElementById("shortcut-display");
  if (shortcutEl) {
    shortcutEl.textContent = formatShortcutForDisplay(currentShortcut);
  }

  const platformInfo = document.getElementById("platform-info");
  if (platformInfo && currentPlatform) {
    platformInfo.textContent = `Running on: ${currentPlatform.platform}`;
  }
}

// ============================================================
// In-App Scan: Clipboard Image
// ============================================================

async function readClipboardImage() {
  try {
    // Try to read image from clipboard via main process
    const imageDataUrl = await window.qrAPI.readClipboardImage();
    if (imageDataUrl) {
      showPreviewAndDecode(imageDataUrl);
    } else {
      showResult("no-qr", "No image found in clipboard.", "Copy an image first, then paste (⌘V).");
    }
  } catch (err) {
    console.error("Clipboard read error:", err);
    showResult("error", "Could not read clipboard.", err.message);
  }
}

// ============================================================
// In-App Scan: File Load
// ============================================================

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    showPreviewAndDecode(e.target.result);
  };
  reader.readAsDataURL(file);
}

// ============================================================
// In-App Scan: Preview + Decode
// ============================================================

function showPreviewAndDecode(dataUrl) {
  const img = new Image();
  img.onload = () => {
    // Show preview
    const container = document.getElementById("image-preview-container");
    const canvas = document.getElementById("preview-canvas");
    container.classList.remove("hidden");

    // Limit preview size
    const maxW = Math.min(img.width, 360);
    const maxH = Math.min(img.height, 260);
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Decode using jsQR (loaded via script tag)
    const result = decodeImageRobust(ctx, canvas.width, canvas.height);
    if (result) {
      handleDecodedResult(result);
    } else {
      showResult("no-qr", "No QR code detected", "Try a clearer image or use screen-area selection instead.");
    }
  };
  img.onerror = () => {
    showResult("error", "Failed to load image", "The file may be corrupted or unsupported.");
  };
  img.src = dataUrl;
}

function clearPreview() {
  document.getElementById("image-preview-container").classList.add("hidden");
  hideResult();
}

// ============================================================
// Robust QR Decoder (same strategies as overlay)
// ============================================================

function decodeImageRobust(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);

  // ============================================================
  // TIER 1 — Fast / "basic" ways. A normal QR code is read here in
  // 1–3 cheap jsQR calls. We only move to the slow strategies
  // (threshold sweep + invert) if this tier fails.
  // ============================================================
  let result = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
  if (result) return result;

  // Cheap upscales help small QR codes; jsQR's "attemptBoth" handles inverted codes.
  for (const s of [1.5, 2, 2.5]) {
    result = tryScaleDecode(ctx, w, h, s, (sd) =>
      jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
    );
    if (result) return result;
  }

  // ============================================================
  // TIER 2 — Advanced strategies (only reached for hard QR codes:
  // low contrast, color backgrounds, artistic/decorative codes).
  // ============================================================
  const scales = [0.5, 0.75, 1.25, 1.5, 2];
  for (const s of scales) {
    const sw = Math.round(w * s);
    const sh = Math.round(h * s);
    if (sw < 10 || sh < 10) continue;

    const sc = document.createElement("canvas");
    sc.width = sw; sc.height = sh;
    const sctx = sc.getContext("2d");
    sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
    let sd = sctx.getImageData(0, 0, sw, sh);
    sd = grayscale(sd);
    sd = stretchContrast(sd);

    result = jsQR(sd.data, sw, sh, { inversionAttempts: "attemptBoth" });
    if (result) return result;

    for (const thresh of [80, 100, 120, 140, 160]) {
      const bin = binaryThreshold(sd, thresh);
      result = jsQR(bin.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;

      const invBin = invertBin(bin);
      result = jsQR(invBin.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;
    }
  }

  return null;
}

function tryScaleDecode(ctx, w, h, s, decode) {
  const sw = Math.round(w * s);
  const sh = Math.round(h * s);
  if (sw < 10 || sh < 10) return null;
  const sc = document.createElement("canvas");
  sc.width = sw; sc.height = sh;
  const sctx = sc.getContext("2d");
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const sd = sctx.getImageData(0, 0, sw, sh);
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
      d[i] = d[i + 1] = d[i + 2] = ((d[i] - min) / range) * 255;
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

// ============================================================
// Handle Decoded Result (in-app)
// ============================================================

async function handleDecodedResult(qrResult) {
  const text = qrResult.data.trim();
  const isUrl = /^(https?:\/\/|www\.)/i.test(text);

  // Show result UI
  if (isUrl) {
    showResult("url", text, null, true);
  } else {
    showResult("text", text, null, false);
  }

  // Apply side effects via main process
  const response = await window.qrAPI.onDecoded(text);

  // Refresh history
  await loadHistory();
}

// ============================================================
// Result UI
// ============================================================

function showResult(type, data, sub, isUrl) {
  const el = document.getElementById("scan-result");
  const badge = document.getElementById("result-badge");
  const dataEl = document.getElementById("result-data");
  const actionsEl = document.getElementById("result-actions");

  el.classList.remove("hidden");

  const typeConfig = {
    url: { label: "URL", cls: "url" },
    text: { label: "Text", cls: "text" },
    "no-qr": { label: "No QR", cls: "no-qr" },
    error: { label: "Error", cls: "no-qr" },
  };

  const cfg = typeConfig[type] || typeConfig["text"];
  badge.textContent = cfg.label;
  badge.className = "result-badge " + cfg.cls;

  dataEl.textContent = data;

  actionsEl.innerHTML = "";
  if (isUrl && type === "url") {
    actionsEl.innerHTML = `<button class="btn-result" id="result-open-btn">Open in Browser</button>`;
    document.getElementById("result-open-btn").addEventListener("click", () => {
      window.qrAPI.openUrl(data.startsWith("http") ? data : `https://${data}`);
    });
  } else if (type === "text") {
    actionsEl.innerHTML = `<button class="btn-result" id="result-copy-btn">Copy to Clipboard</button>`;
    document.getElementById("result-copy-btn").addEventListener("click", () => {
      window.qrAPI.copyClipboard(data);
      document.getElementById("result-copy-btn").textContent = "Copied!";
      setTimeout(() => { document.getElementById("result-copy-btn").textContent = "Copy to Clipboard"; }, 1500);
    });
  }

  if (sub) {
    const subEl = document.createElement("p");
    subEl.className = "result-sub";
    subEl.textContent = sub;
    actionsEl.appendChild(subEl);
  }
}

function hideResult() {
  document.getElementById("scan-result").classList.add("hidden");
}

// ============================================================
// History
// ============================================================

async function loadHistory() {
  const history = await window.qrAPI.getHistory();
  renderHistory(history);
}

function renderHistory(history) {
  const list = document.getElementById("history-list");

  if (!history || !history.length) {
    list.innerHTML = '<p class="empty-state">No scans yet. Paste an image or press the shortcut to scan.</p>';
    return;
  }

  list.innerHTML = history
    .map((item) => {
      const typeLabel = { url: "URL", text: "Text", "no-qr": "No QR" }[item.type] || "Unknown";
      const display = item.data
        ? item.data.length > 100
          ? item.data.slice(0, 100) + "\u2026"
          : item.data
        : "No QR code detected";
      const time = formatTime(item.timestamp);

      return `
        <div class="history-item" data-type="${item.type}" data-data="${escapeAttr(item.data || "")}">
          <span class="item-type ${item.type}">${typeLabel}</span>
          <div class="item-data">${escapeHtml(display)}</div>
          <div class="item-time">${time}</div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", () => {
      const type = el.getAttribute("data-type");
      const data = el.getAttribute("data-data");
      if (type === "url" && data) {
        window.qrAPI.openUrl(data.startsWith("http") ? data : `https://${data}`);
      } else if (data) {
        window.qrAPI.copyClipboard(data);
      }
    });
  });
}

async function clearHistory() {
  await window.qrAPI.clearHistory();
  renderHistory([]);
}

// ============================================================
// Settings
// ============================================================

async function loadSettingsForm() {
  const settings = await window.qrAPI.getSettings();

  document.getElementById("setting-autoopen").checked = settings.autoOpenUrl !== false;
  document.getElementById("setting-copytext").checked = settings.copyTextToClipboard !== false;
  document.getElementById("setting-notify").checked = settings.showNotification !== false;
  document.getElementById("setting-maxhistory").value = settings.maxHistory || 50;

  // Track the active shortcut and reflect it everywhere
  currentShortcut = settings.shortcut || "CommandOrControl+Shift+Y";
  updateShortcutDisplay(currentShortcut);
}

// Update both the "Current:" label and the scan button's kbd to match a shortcut
function updateShortcutDisplay(accelerator) {
  const displayKbd = formatShortcutForDisplay(accelerator);
  const curVal = document.getElementById("shortcut-current-value");
  if (curVal) curVal.textContent = displayKbd;
  const scDisplay = document.getElementById("shortcut-display");
  if (scDisplay) scDisplay.textContent = displayKbd;
}

function formatShortcutForDisplay(accelerator) {
  return accelerator
    .replace(/CommandOrControl/g, currentPlatform && currentPlatform.isMac ? "Cmd" : "Ctrl")
    .replace(/Command/g, "Cmd")
    .replace(/Control/g, "Ctrl")
    .replace(/\+/g, "+");
}

function formatShortcutForElectron(pressedKeys) {
  // Convert recorded keys to Electron accelerator format
  let parts = [];
  if (pressedKeys.meta) parts.push(isMacOS() ? "Command" : "Control");
  if (pressedKeys.ctrl && !isMacOS()) parts.push("Control");
  if (pressedKeys.ctrl && isMacOS()) parts.push("Control"); // allow Ctrl too on Mac
  if (pressedKeys.shift) parts.push("Shift");
  if (pressedKeys.alt) parts.push("Alt");
  if (pressedKeys.key) parts.push(pressedKeys.key.toUpperCase());

  if (parts.length < 2) return null; // need at least a modifier + key
  return parts.join("+");
}

function isMacOS() {
  return currentPlatform && currentPlatform.isMac;
}

// ============================================================
// Shortcut Recorder (auto-detect keyboard)
// ============================================================

function setupShortcutRecorder() {
  const btn = document.getElementById("shortcut-record-btn");
  const label = document.getElementById("shortcut-record-label");
  let recording = false;   // true between Record-click and stopRecording()
  let finalizing = false;  // true while we validate the pressed combo (locks re-entry)
  let pressedKeys = {};

  btn.addEventListener("click", () => {
    if (recording) return;
    recording = true;
    finalizing = false;
    pressedKeys = {};
    // Suspend the global hotkey so the keystrokes we capture do NOT trigger a scan
    // or open the capture overlay. Re-enabled in stopRecording().
    window.qrAPI.suspendShortcut();
    isRecordingShortcut = true;
    btn.classList.add("recording");
    label.textContent = "Press a key combination now…  (Esc to cancel)";
  });

  const stopRecording = (newShortcut) => {
    recording = false;
    finalizing = false;
    pressedKeys = {};
    isRecordingShortcut = false;
    // Re-enable the global hotkey with whatever is now saved
    window.qrAPI.resumeShortcut();
    btn.classList.remove("recording");

    if (newShortcut) {
      btn.dataset.shortcut = newShortcut;
      updateShortcutDisplay(newShortcut);
      label.textContent = "Saved! Press Record to change it again.";
    } else {
      label.textContent = "Cancelled. Press Record to set a shortcut.";
    }
  };

  document.addEventListener("keydown", (e) => {
    if (!recording || finalizing) return;
    e.preventDefault();
    e.stopPropagation();

    // Cancel with Escape
    if (e.key === "Escape") {
      stopRecording(null);
      return;
    }

    // Ignore auto-repeat (held keys)
    if (e.repeat) return;

    // Ignore just modifiers alone (wait for the real key)
    if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
      pressedKeys[e.key.toLowerCase()] = true;
      label.textContent = getModifierLabels() + "…";
      return;
    }

    pressedKeys.key = e.key;
    if (e.metaKey) pressedKeys.meta = true;
    if (e.ctrlKey) pressedKeys.ctrl = true;
    if (e.shiftKey) pressedKeys.shift = true;
    if (e.altKey) pressedKeys.alt = true;

    const accelerator = formatShortcutForElectron(pressedKeys);
    if (!accelerator) {
      stopRecording(null);
      return;
    }

    // Lock so a second combo / auto-repeat can't re-trigger while we validate
    finalizing = true;
    label.textContent = "Checking…";

    window.qrAPI.testShortcut(accelerator).then((ok) => {
      if (ok) {
        // Record = save: persist immediately and make it the active shortcut
        persistShortcut(accelerator).then(() => stopRecording(accelerator));
      } else {
        label.textContent = "That combination can't be used. Try another.";
        finalizing = false;
        pressedKeys = {};
        setTimeout(() => {
          if (recording && !finalizing) label.textContent = "Press a key combination now…  (Esc to cancel)";
        }, 1800);
      }
    });
  }, true); // capture phase so we get all keydowns

  function getModifierLabels() {
    const parts = [];
    if (pressedKeys.meta) parts.push(isMacOS() ? "Cmd" : "Win/Ctrl");
    if (pressedKeys.ctrl) parts.push("Ctrl");
    if (pressedKeys.shift) parts.push("Shift");
    if (pressedKeys.alt) parts.push("Alt");
    return parts.join(" + ") || "…";
  }
}

// Persist the newly recorded shortcut immediately (record = save).
async function persistShortcut(accelerator) {
  const settings = {
    shortcut: accelerator,
    autoOpenUrl: document.getElementById("setting-autoopen").checked,
    copyTextToClipboard: document.getElementById("setting-copytext").checked,
    showNotification: document.getElementById("setting-notify").checked,
    maxHistory: parseInt(document.getElementById("setting-maxhistory").value, 10) || 50,
  };
  await window.qrAPI.saveSettings(settings); // main saves + re-registers (suspended → applied on resume)
  currentShortcut = accelerator;
}

async function saveSettings() {
  const recordBtn = document.getElementById("shortcut-record-btn");
  const settings = {
    shortcut: recordBtn.dataset.shortcut || (await window.qrAPI.getSettings()).shortcut || "CommandOrControl+Shift+Y",
    autoOpenUrl: document.getElementById("setting-autoopen").checked,
    copyTextToClipboard: document.getElementById("setting-copytext").checked,
    showNotification: document.getElementById("setting-notify").checked,
    maxHistory: parseInt(document.getElementById("setting-maxhistory").value, 10) || 50,
  };

  await window.qrAPI.saveSettings(settings);
  currentShortcut = settings.shortcut;
  updateShortcutDisplay(currentShortcut);

  const savedMsg = document.getElementById("settings-saved");
  savedMsg.classList.remove("hidden");
  setTimeout(() => savedMsg.classList.add("hidden"), 2000);
}

// ============================================================
// Helpers
// ============================================================

function formatTime(ts) {
  const date = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text ? text.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}
