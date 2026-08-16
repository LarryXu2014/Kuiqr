// ============================================================
// Kuiqr — Desktop App Renderer Logic (v2.4.2.0)
// Features:
//   - In-app scan: paste from clipboard or drag-drop image
//   - Screen capture via overlay (shortcut / button)
//   - Auto-detect keyboard shortcut recorder
//   - History + Settings
//   - Generate QR codes from any text/URL
// ============================================================

let currentPlatform = null;
let currentShortcut = "CommandOrControl+Shift+Y"; // the active saved shortcut (kept in sync)
let isRecordingShortcut = false; // true while the user is recording a new shortcut
let savedSettingsSnapshot = null; // snapshot of settings when the Settings tab was loaded
let settingsDirty = false;        // true when form values differ from savedSettingsSnapshot
let pendingTabTarget = null;      // tab the user is trying to switch to while dirty
let scanPopupTimer = null;        // auto-hide timer for the in-app scan toast

document.addEventListener("DOMContentLoaded", async () => {
  // Detect platform
  currentPlatform = await window.qrAPI.getPlatform();
  updatePlatformUI();

  // Show the real app build version in the About section (fixes a bug where it
  // was hardcoded to an old version).
  try {
    const appVer = await window.qrAPI.getAppVersion();
    const aboutEl = document.getElementById("about-version");
    if (aboutEl && appVer) aboutEl.textContent = "Kuiqr v" + appVer;
  } catch (e) { /* non-fatal */ }

  // Tab navigation — respect unsaved settings changes
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => requestSwitchTab(tab.dataset.tab));
  });

  // Listen for external tab switches (from tray)
  window.qrAPI.onSwitchTab((tab) => requestSwitchTab(tab));

  // Tell the main process this renderer is ready to receive decode jobs (so a
  // scan that happens right after launch is never dropped).
  window.qrAPI.markRendererReady();

  // ── Hidden decode worker (macOS native scan path) ──
  // The main process captured the screen with the NATIVE macOS selection UI and
  // sends the PNG here. We decode it with the same robust decoder and report the
  // result back. The app window stays hidden the whole time — this just runs the
  // decoder in the background. No preview is ever shown.
  window.qrAPI.onDecodeBuffer(async (buffer) => {
    try {
      const text = await decodeBufferToText(buffer);
      await window.qrAPI.onDecoded(text || null);
      // Success/no-QR feedback is delivered as an IN-APP overlay by the main
      // process (applyDecodedResult).
      await loadHistory(); // refresh history silently if the window is open
    } catch (err) {
      console.error("Hidden decode failed:", err);
      // Surface the failure as an on-screen notification. We don't post a null
      // result here (the no-QR case is handled separately in applyDecodedResult).
      showScanPopup("error", "Scan Failed", "The captured image could not be processed.");
    }
  });

  // ── macOS Vision fast-path result ──
  // The main process already decoded the capture with native Vision, applied
  // side effects (open URL / copy text / history), and sends us the text so the
  // UI can show the popup and refresh history.
  window.qrAPI.onNativeDecoded(async (text) => {
    // The main process shows the result via its own always-on-top notification
    // window; here we just refresh the history list.
    await loadHistory();
  });

  // ── In-app scan feedback overlay (replaces native system notifications) ──
  window.qrAPI.onShowScanToast((type, title, content, hint) => {
    showScanPopup(type, title, content, hint);
  });

  // In-app right-click context menu (real "right-click to scan" inside the app).
  setupContextMenu();

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
  setupGenerate();
  setupSettingsDirtyTracking();
  setupUnsavedPrompt();

  // ── First-launch onboarding: extension prompt → tutorial ask → tutorial → menu bar ──
  maybeRunOnboarding();

  // ── Replay the guided tour from Settings → Tutorial ──
  wireTutorialReplay();

  // ── macOS Automation permission: show the row + wire the Settings button ──
  const autoRow = document.getElementById("automation-permission-row");
  if (autoRow) {
    if (currentPlatform && currentPlatform.isMac) {
      // Check if permission is already granted — if so, hide the row entirely.
      try {
        const perm = await window.qrAPI.checkAutomationPermission();
        if (perm && perm.granted) {
          autoRow.classList.add("hidden");
        } else {
          autoRow.classList.remove("hidden");
        }
      } catch {
        autoRow.classList.remove("hidden"); // show on error so user can still grant
      }
    } else {
      autoRow.classList.add("hidden");
    }
  }
  const openAutoBtn = document.getElementById("open-automation-settings-btn");
  if (openAutoBtn) {
    openAutoBtn.addEventListener("click", async () => {
      try {
        const res = await window.qrAPI.openAutomationSettings();
        if (!res || !res.ok) {
          // Couldn't deep-link — copy the manual path so the user can find it.
          window.qrAPI.copyClipboard("System Settings → Privacy & Security → Automation");
        }
      } catch (err) {
        console.error("Failed to open Automation settings:", err);
      }
    });
  }
});

// ============================================================
// Tab Navigation
// ============================================================

function getCurrentTab() {
  const active = document.querySelector(".tab.active");
  return active ? active.dataset.tab : null;
}

function requestSwitchTab(tabName) {
  if (tabName === getCurrentTab()) return;

  // If we're leaving the settings tab with unsaved changes, ask first.
  if (getCurrentTab() === "settings" && settingsDirty) {
    pendingTabTarget = tabName;
    showUnsavedPrompt();
    return;
  }

  switchTab(tabName);
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);

  if (tab) tab.classList.add("active");
  if (content) content.classList.add("active");
}

// ============================================================
// Settings dirty-state tracking + discard prompt
// ============================================================

function getSettingsFormValues() {
  return {
    autoOpenUrl: document.getElementById("setting-autoopen").checked,
    copyTextToClipboard: document.getElementById("setting-copytext").checked,
    browserExtensionPriority: document.getElementById("setting-browserpriority").checked,
    showScanPopup: document.getElementById("setting-showscanpopup").checked,
    maxHistory: parseInt(document.getElementById("setting-maxhistory").value, 10) || 50,
    shortcut: currentShortcut,
  };
}

function updateSettingsDirtyState() {
  if (!savedSettingsSnapshot) return;
  const current = getSettingsFormValues();
  const dirty =
    current.autoOpenUrl !== savedSettingsSnapshot.autoOpenUrl ||
    current.copyTextToClipboard !== savedSettingsSnapshot.copyTextToClipboard ||
    current.browserExtensionPriority !== savedSettingsSnapshot.browserExtensionPriority ||
    current.showScanPopup !== savedSettingsSnapshot.showScanPopup ||
    current.maxHistory !== savedSettingsSnapshot.maxHistory ||
    current.shortcut !== savedSettingsSnapshot.shortcut;

  settingsDirty = dirty;
  const saveBtn = document.getElementById("save-settings-btn");
  if (saveBtn) {
    saveBtn.textContent = dirty ? "Save Settings*" : "Save Settings";
  }
}

function markSettingsClean() {
  settingsDirty = false;
  savedSettingsSnapshot = getSettingsFormValues();
  const saveBtn = document.getElementById("save-settings-btn");
  if (saveBtn) saveBtn.textContent = "Save Settings";
}

function setupSettingsDirtyTracking() {
  const ids = ["setting-autoopen", "setting-copytext", "setting-browserpriority", "setting-showscanpopup", "setting-maxhistory"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", updateSettingsDirtyState);
  });
  // Also watch for shortcut changes (recorder updates currentShortcut and calls updateSettingsDirtyState)
}

function setupUnsavedPrompt() {
  const prompt = document.getElementById("unsaved-prompt");
  const saveBtn = document.getElementById("unsaved-save");
  const discardBtn = document.getElementById("unsaved-discard");
  if (!prompt || !saveBtn || !discardBtn) return;

  // Save changes, then proceed to the tab the user wanted to switch to.
  saveBtn.addEventListener("click", async () => {
    prompt.classList.add("hidden");
    await saveSettings();
    if (pendingTabTarget) {
      switchTab(pendingTabTarget);
      pendingTabTarget = null;
    }
  });

  // Discard changes: revert the settings form to the saved values,
  // then proceed with the pending tab switch.
  discardBtn.addEventListener("click", async () => {
    prompt.classList.add("hidden");
    await loadSettingsForm(); // resets form + dirty flag from saved settings
    if (pendingTabTarget) {
      switchTab(pendingTabTarget);
      pendingTabTarget = null;
    }
  });
}

function showUnsavedPrompt() {
  const prompt = document.getElementById("unsaved-prompt");
  if (prompt) prompt.classList.remove("hidden");
}

// ============================================================
// First-launch onboarding
//   1. Browser-extension download prompt (first)
//   2. Ask whether to take the guided tour ("Enter Tutorial" / "Maybe later")
//   3. Run the tour if requested
//   4. Enter menu-bar (background) mode — shows the menu bar icon
// The tour itself is first-launch only; it can always be replayed from
// Settings → Tutorial → "Take a guided tour".
// ============================================================

async function maybeRunOnboarding() {
  let extNeeded = false;
  let tutNeeded = false;
  try {
    extNeeded = (await window.qrAPI.shouldShowExtensionPrompt()).show;
    tutNeeded = (await window.qrAPI.shouldShowTutorial()).show;
  } catch (e) {
    // If we can't reach the main process, don't block startup — just bail.
    return;
  }

  // Returning user (everything already seen): nothing to do. The main process is
  // already in menu-bar mode and keeps the window hidden.
  if (!extNeeded && !tutNeeded) return;

  try {
    // Step 1 — browser-extension download prompt comes first.
    if (extNeeded) await showExtensionPrompt();

    // Step 2 — ask whether to take the guided tour.
    if (tutNeeded) {
      const wantsTour = await askTutorial();
      if (wantsTour && window.KuiqrTutorial) {
        await new Promise((resolve) => {
          window.KuiqrTutorial.start(() => resolve());
        });
      }
      // Mark the tour as handled (first-launch only) whether or not they took it.
      try { await window.qrAPI.markTutorialShown(); } catch (e) {}
    }

    // Step 3 — onboarding finished: become a menu-bar app (shows the menu bar icon).
    try { await window.qrAPI.enterMenuBarMode(); } catch (e) {}
  } catch (e) {
    // If anything goes wrong mid-onboarding, still finish into menu-bar mode.
    try { await window.qrAPI.enterMenuBarMode(); } catch (_) {}
  }
}

// Shows the browser-extension download prompt and resolves once the user
// dismisses it (download or "Not now"). Marks the prompt as shown.
function showExtensionPrompt() {
  return new Promise((resolve) => {
    const prompt = document.getElementById("extension-prompt");
    const chromeBtn = document.getElementById("ext-download-chrome");
    const firefoxBtn = document.getElementById("ext-download-firefox");
    const laterBtn = document.getElementById("ext-prompt-later");
    const status = document.getElementById("ext-download-status");
    if (!prompt) { resolve(); return; }

    prompt.classList.remove("hidden");

    let done = false;
    const closePrompt = () => {
      if (done) return;
      done = true;
      prompt.classList.add("hidden");
      try { window.qrAPI.markExtensionPromptShown(); } catch (e) {}
      // Detach listeners so they don't linger / double-fire on a later replay.
      [chromeBtn, firefoxBtn, laterBtn].forEach((b) => {
        if (b && b.parentNode) b.parentNode.replaceChild(b.cloneNode(true), b);
      });
      resolve();
    };

    const doDownload = async (type) => {
      status.textContent = "Downloading…";
      status.classList.remove("hidden");
      try {
        const res = await window.qrAPI.downloadExtension(type);
        if (res.ok) {
          showExtensionInstructions(type, res.filename);
        } else {
          status.textContent = "Download failed: " + (res.reason || "unknown error");
        }
      } catch (err) {
        status.textContent = "Download failed: " + ((err && err.message) || "unknown error");
      }
      // Keep the prompt open so the user can read the instructions; "Not now" finishes it.
    };

    // Shows the "how to load into Chrome/Firefox" steps, then auto-closes the
    // prompt after a visible "Tab closing in 3, 2, 1" countdown.
    const showExtensionInstructions = (type, filename) => {
      const instr = document.getElementById("ext-instructions");
      const hint = prompt.querySelector(".modal-hint");
      if (!instr) {
        status.innerHTML = `<b>Downloaded:</b> ${escapeHtml(filename)}`;
        return;
      }
      const isChrome = type !== "firefox";
      const steps = isChrome
        ? [
            `Unzip the downloaded file (<b>${escapeHtml(filename)}</b>).`,
            "Open <b>chrome://extensions</b> (or edge://extensions, brave://extensions).",
            "Turn on <b>Developer mode</b> (top-right corner).",
            "Click <b>Load unpacked</b> and select the unzipped folder.",
            "Right-click any QR image → <b>Scan QR Code</b>.",
          ]
        : [
            `Unzip the downloaded file (<b>${escapeHtml(filename)}</b>).`,
            "Open <b>about:debugging#/runtime/this-firefox</b>.",
            "Click <b>Load Temporary Add-on</b>.",
            "Select <b>manifest.json</b> inside the unzipped folder.",
            "Right-click any QR image → <b>Scan QR Code</b>.",
          ];

      instr.querySelector(".ext-instr-steps").innerHTML = steps.map((s) => `<li>${s}</li>`).join("");

      // Hide the download controls, show the instructions.
      status.classList.add("hidden");
      if (chromeBtn) chromeBtn.classList.add("hidden");
      if (firefoxBtn) firefoxBtn.classList.add("hidden");
      if (laterBtn) laterBtn.classList.add("hidden");
      if (hint) hint.classList.add("hidden");
      instr.classList.remove("hidden");

      // Countdown "Tab closing in 3, 2, 1" then close the prompt (resolves onboarding).
      const countdownEl = instr.querySelector(".ext-instr-countdown");
      let n = 3;
      const renderCount = () => { if (countdownEl) countdownEl.textContent = `Tab closing in ${n}…`; };
      renderCount();
      const iv = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(iv);
          if (countdownEl) countdownEl.textContent = "Tab closing…";
          closePrompt();
        } else {
          renderCount();
        }
      }, 1000);
    };

    if (chromeBtn) chromeBtn.addEventListener("click", () => doDownload("chrome"));
    if (firefoxBtn) firefoxBtn.addEventListener("click", () => doDownload("firefox"));
    if (laterBtn) laterBtn.addEventListener("click", closePrompt);
  });
}

// Shows the "want a guided tour?" dialog and resolves with
// true ("Enter Tutorial") or false ("Maybe later").
function askTutorial() {
  return new Promise((resolve) => {
    const modal = document.getElementById("tutorial-ask");
    const enterBtn = document.getElementById("tut-ask-enter");
    const laterBtn = document.getElementById("tut-ask-later");
    if (!modal) { resolve(false); return; }

    modal.classList.remove("hidden");

    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      modal.classList.add("hidden");
      [enterBtn, laterBtn].forEach((b) => {
        if (b && b.parentNode) b.parentNode.replaceChild(b.cloneNode(true), b);
      });
      resolve(val);
    };

    if (enterBtn) enterBtn.addEventListener("click", () => finish(true));
    if (laterBtn) laterBtn.addEventListener("click", () => finish(false));
  });
}

// Wires every "Take a guided tour" replay button (Settings → Tutorial section).
function wireTutorialReplay() {
  document.querySelectorAll(".tutorial-replay").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.KuiqrTutorial) window.KuiqrTutorial.start(() => {});
    });
  });
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
  img.onload = async () => {
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
    try {
      const result = decodeImageRobust(ctx, canvas.width, canvas.height);
      if (result) {
        await handleDecodedResult(result);
      } else {
        showResult("no-qr", "No QR code detected", "Try a clearer image or use screen-area selection instead.");
      }
    } catch (err) {
      console.error("Decode error:", err);
      showResult("error", "Failed to decode image", err.message);
      // Surface the failure as an in-app overlay notification.
      showScanPopup("error", "Scan Failed", err.message || "The file could not be processed.");
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
// Fast QR Decoder
//
// Goals:
//   1. Instant feedback for empty / uniform areas (<< 50 ms).
//   2. Most real QR codes decoded in the first 1-3 jsQR calls.
//   3. Hard / artistic codes get a bounded, time-limited fallback.
//
// Timing budgets (can be tuned):
//   - Fast path:     ~80 ms  (original + small up/down-scales)
//   - Medium path:  ~200 ms  (grayscale + contrast + a few thresholds)
//   - Deep path:    ~500 ms  (multi-scale threshold sweep)
//   - Absolute cap: 800 ms  (never hang on a bad selection)
// ============================================================

const DECODER_BUDGET_FAST = 80;
const DECODER_BUDGET_MEDIUM = 220;
const DECODER_BUDGET_DEEP = 550;
const DECODER_BUDGET_ABSOLUTE = 800;

function decodeImageRobust(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const start = performance.now();

  // Guard against tiny / degenerate captures.
  if (w < 50 || h < 50) return null;

  // ── Instant reject: uniform / blank / blurry selections ──
  // If the image has almost no contrast, no QR code can be present.
  if (looksEmptyOrUniform(imageData)) {
    return null;
  }

  // ── FAST PATH ──
  // 1. Original size, normal + inverted.
  let result = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
  if (result) return result;

  // 2. Small up-scales help tiny but otherwise clean codes.
  for (const s of [1.5, 2]) {
    if (performance.now() - start > DECODER_BUDGET_FAST) break;
    result = tryScaleDecode(ctx, w, h, s, (sd) =>
      jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
    );
    if (result) return result;
  }

  // 3. Quick down-scale for huge captures where the QR is small.
  if (w > 600 || h > 600) {
    if (performance.now() - start <= DECODER_BUDGET_FAST) {
      result = tryScaleDecode(ctx, w, h, 0.5, (sd) =>
        jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
      );
      if (result) return result;
    }
  }

  // ── MEDIUM PATH ──
  // Grayscale + contrast stretch + a few threshold attempts at original size.
  if (performance.now() - start <= DECODER_BUDGET_MEDIUM) {
    let gray = grayscale(imageData);
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

  // ── DEEP PATH ──
  // Only for hard codes: low contrast, color backgrounds, decorative codes.
  // Kept bounded so a bad selection never stalls for seconds.
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

  // Absolute cap — if we somehow got here, give up so the UI never hangs.
  return null;
}

// ── Instant empty-area detection ──
// Samples pixels on a grid. If almost every sample is the same color
// (within a small tolerance), the area contains no QR code.
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

  // No meaningful contrast -> empty.
  if (maxL - minL < 18) return true;

  // Very low color variance (e.g. a blank wall / sky).
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
  const avgVariance = varianceSum / samples;
  if (avgVariance < 12) return true;

  return false;
}

function tryScaleDecode(ctx, w, h, s, decode) {
  const sw = Math.round(w * s);
  const sh = Math.round(h * s);
  if (sw < 10 || sh < 10) return null;
  const sd = scaleImageData(ctx, w, h, sw, sh);
  return decode(sd);
}

function scaleImageData(ctx, w, h, sw, sh) {
  // Use the browser's high-quality down/up-scale, then read pixels.
  const sc = document.createElement("canvas");
  sc.width = sw; sc.height = sh;
  const sctx = sc.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  return sctx.getImageData(0, 0, sw, sh);
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
// Hidden decode worker: decode a captured PNG buffer (from the main process).
// Reuses the same robust decoder as the in-app scanner.
// ============================================================

async function decodeBufferToText(buffer) {
  // Electron serializes the Node Buffer to a Uint8Array across the bridge.
  const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const blob = new Blob([arr], { type: "image/png" });
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const result = decodeImageRobust(ctx, canvas.width, canvas.height);
  return result ? result.data.trim() : null;
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

  // Scan success feedback is delivered as an IN-APP overlay by the main process
  // (applyDecodedResult), controlled by the "Show scan notifications" setting.

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
// Scan notification — now a REAL on-screen layer (a separate always-on-top
// transparent window managed by the main process), not an in-app DOM popup.
// We just forward the request to the main process.
// ============================================================

function showScanPopup(type, title, content, hint) {
  if (window.qrAPI && window.qrAPI.showScreenToast) {
    window.qrAPI.showScreenToast(type, title, content, hint);
  }
}

// ── In-app right-click context menu ──
// Gives the desktop app a real "right-click to scan" feature (the browser
// extension already has right-click-on-image scanning; now the app does too).
function setupContextMenu() {
  const menu = document.getElementById("app-context-menu");
  if (!menu) return;

  const hide = () => menu.classList.add("hidden");
  const showAt = (x, y) => {
    // Keep the menu on-screen.
    const mw = menu.offsetWidth || 200;
    const mh = menu.offsetHeight || 160;
    const px = Math.min(x, window.innerWidth - mw - 8);
    const py = Math.min(y, window.innerHeight - mh - 8);
    menu.style.left = Math.max(8, px) + "px";
    menu.style.top = Math.max(8, py) + "px";
    menu.classList.remove("hidden");
  };

  document.addEventListener("contextmenu", (e) => {
    const t = e.target;
    // Don't hijack right-click inside editable fields, links, or buttons.
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.closest("a, button"))) return;
    e.preventDefault();
    showAt(e.clientX, e.clientY);
  });

  document.addEventListener("click", (e) => { if (!menu.contains(e.target)) hide(); });
  document.addEventListener("scroll", hide, true);
  window.addEventListener("blur", hide);

  menu.querySelectorAll("[data-action]").forEach((item) => {
    item.addEventListener("click", () => {
      hide();
      const action = item.getAttribute("data-action");
      if (action === "scan") {
        if (window.qrAPI && window.qrAPI.triggerScan) window.qrAPI.triggerScan();
      } else if (action === "paste") {
        if (typeof readClipboardImage === "function") readClipboardImage();
      } else if (action === "settings") {
        if (window.qrAPI && window.qrAPI.openTab) window.qrAPI.openTab("settings");
      } else if (action === "quit") {
        if (window.qrAPI && window.qrAPI.quitApp) window.qrAPI.quitApp();
      }
    });
  });
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
  document.getElementById("setting-browserpriority").checked = !!settings.browserExtensionPriority;
  document.getElementById("setting-showscanpopup").checked = settings.showScanPopup !== false;
  document.getElementById("setting-maxhistory").value = settings.maxHistory || 50;

  // Track the active shortcut and reflect it everywhere
  currentShortcut = settings.shortcut || "CommandOrControl+Shift+Y";
  updateShortcutDisplay(currentShortcut);

  // Show the current shortcut in the recorder button label so it doesn't say
  // "Press keys to record…" forever.
  const recordLabel = document.getElementById("shortcut-record-label");
  if (recordLabel) {
    recordLabel.textContent = `Current: ${formatShortcutForDisplay(currentShortcut)} — click to change`;
  }

  // Snapshot form values so we can detect unsaved changes.
  savedSettingsSnapshot = getSettingsFormValues();
  settingsDirty = false;
  const saveBtn = document.getElementById("save-settings-btn");
  if (saveBtn) saveBtn.textContent = "Save Settings";
}

// Update both the "Current:" label and the scan button's kbd to match a shortcut
function updateShortcutDisplay(accelerator) {
  const displayKbd = formatShortcutForDisplay(accelerator);
  const curVal = document.getElementById("shortcut-current-value");
  if (curVal) curVal.textContent = displayKbd;
  const scDisplay = document.getElementById("shortcut-display");
  if (scDisplay) scDisplay.textContent = displayKbd;
  updateSettingsDirtyState();
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
    browserExtensionPriority: document.getElementById("setting-browserpriority").checked,
    maxHistory: parseInt(document.getElementById("setting-maxhistory").value, 10) || 50,
  };
  await window.qrAPI.saveSettings(settings); // main saves + re-registers (suspended → applied on resume)
  currentShortcut = accelerator;
  markSettingsClean();

  // Update the recorder button so it reflects the new shortcut.
  const recordLabel = document.getElementById("shortcut-record-label");
  if (recordLabel) {
    recordLabel.textContent = `Current: ${formatShortcutForDisplay(currentShortcut)} — click to change`;
  }
}

async function saveSettings() {
  const recordBtn = document.getElementById("shortcut-record-btn");
  const settings = {
    shortcut: recordBtn.dataset.shortcut || (await window.qrAPI.getSettings()).shortcut || "CommandOrControl+Shift+Y",
    autoOpenUrl: document.getElementById("setting-autoopen").checked,
    copyTextToClipboard: document.getElementById("setting-copytext").checked,
    browserExtensionPriority: document.getElementById("setting-browserpriority").checked,
    showScanPopup: document.getElementById("setting-showscanpopup").checked,
    maxHistory: parseInt(document.getElementById("setting-maxhistory").value, 10) || 50,
  };

  await window.qrAPI.saveSettings(settings);
  currentShortcut = settings.shortcut;
  updateShortcutDisplay(currentShortcut);
  markSettingsClean();

  const savedMsg = document.getElementById("settings-saved");
  savedMsg.classList.remove("hidden");
  setTimeout(() => savedMsg.classList.add("hidden"), 2000);
}

// ============================================================
// Generate QR Code
// ============================================================

function setupGenerate() {
  const input = document.getElementById("gen-input");
  const ecc = document.getElementById("gen-ecc");
  const img = document.getElementById("gen-img");
  const errorEl = document.getElementById("gen-error");
  const downloadBtn = document.getElementById("gen-download");
  const copyQrBtn = document.getElementById("gen-copy-qr");
  const copyBtn = document.getElementById("gen-copy");

  let lastDataUrl = "";

  function render() {
    const text = input.value;
    errorEl.classList.add("hidden");
    if (!text) {
      img.style.display = "none";
      lastDataUrl = "";
      return;
    }
    try {
      // qrcode(typeNumber=0 → auto, errorCorrectionLevel) from qrcode-generator (UMD)
      const qr = qrcode(0, ecc.value);
      qr.addData(text);
      qr.make();
      const dataUrl = qr.createDataURL(6, 4); // cellSize, margin
      img.src = dataUrl;
      img.style.display = "block";
      lastDataUrl = dataUrl;
      // Don't notify on every keystroke — only when the user explicitly downloads/copies.
    } catch (e) {
      img.style.display = "none";
      lastDataUrl = "";
      errorEl.textContent = "Could not generate: " + (e.message || "text may be too long for a QR code");
      errorEl.classList.remove("hidden");
    }
  }

  if (input) {
    input.addEventListener("input", render);
    ecc.addEventListener("change", render);
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!lastDataUrl) return;
      const a = document.createElement("a");
      a.href = lastDataUrl;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      showScanPopup("success", "QR Code Downloaded", "Saved as qrcode.png.");
    });
  }

  if (copyQrBtn) {
    copyQrBtn.addEventListener("click", async () => {
      if (!lastDataUrl) return;
      try {
        // qrcode-generator emits a GIF data URL, but Electron's nativeImage can only
        // read PNG/JPEG — so copying the raw GIF yields an empty clipboard image.
        // Re-encode the rendered QR to PNG on a canvas first.
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width || 200;
        c.height = img.naturalHeight || img.height || 200;
        c.getContext("2d").drawImage(img, 0, 0);
        const pngDataUrl = c.toDataURL("image/png");
        const res = await window.qrAPI.copyQrImage(pngDataUrl);
        if (res && res.ok === false) throw new Error(res.reason || "Copy failed");
        copyQrBtn.textContent = "Copied QR!";
        setTimeout(() => { copyQrBtn.textContent = "Copy QR Code"; }, 1500);
        showScanPopup("success", "QR Code Copied", "The QR code image has been copied to your clipboard.");
      } catch (err) {
        showScanPopup("error", "Copy Failed", err.message || "Could not copy the QR code image.");
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (!input.value) return;
      window.qrAPI.copyClipboard(input.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy Text"; }, 1500);
      showScanPopup("success", "Text Copied", "The QR content has been copied to your clipboard.");
    });
  }
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
