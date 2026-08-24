// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// Kuiqr — Desktop App Renderer Logic (v2.4.2.1)
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
let lastHistory = [];             // last loaded history (for re-render on language change)
let latestUpdateAssetUrl = null;  // asset URL of the latest update (set by checkForUpdates)
// Pending update info used by the in-app update modal + install flow.
let pendingUpdateUrl = null;
let pendingUpdateName = null;
let pendingUpdateLatest = null;
let updateModalDismissedVersion = null; // hide the modal again this session once "Later" is tapped

document.addEventListener("DOMContentLoaded", async () => {
  // Detect platform
  currentPlatform = await window.qrAPI.getPlatform();
  updatePlatformUI();

  // i18n: detect language, build the picker, apply static translations.
  window.initI18n();
  setupLanguagePicker();
  setupUpdates();
  // Re-render JS-built (dynamic) strings whenever the language changes.
  window.addEventListener("kuiqr:localize", () => localize());

  // Show the real app build version in the About section (fixes a bug where it
  // was hardcoded to an old version).
  try {
    const appVer = await window.qrAPI.getAppVersion();
    const aboutEl = document.getElementById("about-version");
    // Always populate from JS so the version is never stale or "undefined".
    if (aboutEl) aboutEl.textContent = "Kuiqr v" + (appVer || "?");
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
      showScanPopup("error", t("scanFailed"), t("scanFailedMsg"));
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
    scanBtn.querySelector(".btn-label").textContent = t("starting");
    await window.qrAPI.triggerScan();
    setTimeout(() => {
      scanBtn.disabled = false;
      setScanButtonLabel();
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

  // Keep the main process in sync so overlay scans restore the user's last page.
  try {
    if (window.qrAPI && window.qrAPI.notifyTabChanged) {
      window.qrAPI.notifyTabChanged(tabName);
    }
  } catch (e) { /* ignore */ }
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
    saveBtn.textContent = dirty ? t("btn.save") + " *" : t("btn.save");
  }
}

function markSettingsClean() {
  settingsDirty = false;
  savedSettingsSnapshot = getSettingsFormValues();
  const saveBtn = document.getElementById("save-settings-btn");
  if (saveBtn) saveBtn.textContent = t("btn.save");
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
// The app stays a normal foreground app after onboarding. It only enters
// menu-bar (background) mode the first time the user closes the main window.
// The tour itself is first-launch only; it can always be replayed from
// Settings → Tutorial → "Take a guided tour".
// ============================================================

// ============================================================
// First-launch setup wizard (language → extension → guide → done)
// ============================================================

// Decide whether to run the wizard. The main process only reports first-launch
// onboarding as needed, so already-onboarded users won't be re-prompted.
async function maybeRunOnboarding() {
  let extNeeded = false;
  let tutNeeded = false;
  let setupDone = true;
  try {
    const settings = await window.qrAPI.getSettings();
    extNeeded = settings.extensionPromptShown !== true;
    tutNeeded = settings.tutorialShown !== true;
    setupDone = settings.setupDone === true;
  } catch (e) {
    // If we can't reach the main process, don't block startup — just bail.
    return;
  }
  // Run the full setup wizard if it was never completed, or if any legacy
  // first-launch prompt/tour flag is still pending.
  if (setupDone && !extNeeded && !tutNeeded) return;
  runSetupWizard();
}

// Shared by the wizard's extension step: downloads the chosen browser extension
// and renders the "load into your browser" instructions inline in the wizard.
async function setupDownloadExtension(type, statusEl, instrEl, wizardEl) {
  if (statusEl) { statusEl.textContent = t("ext.instr.loading"); statusEl.classList.remove("hidden"); }
  try {
    const res = await window.qrAPI.downloadExtension(type);
    if (res.ok) {
      const stepsSrc = type === "firefox"
        ? window.getSteps().extFirefoxSteps
        : window.getSteps().extChromeSteps;
      const steps = stepsSrc.map((s) => s.replace(/\{file\}/g, escapeHtml(res.filename)));
      if (instrEl) {
        const list = instrEl.querySelector(".setup-ext-steps");
        if (list) list.innerHTML = steps.map((s) => `<li>${s}</li>`).join("");
        instrEl.classList.remove("hidden");
      }
      // Hide the download buttons + hint so only the instructions remain.
      if (wizardEl) wizardEl.querySelectorAll(".setup-ext-btns").forEach((b) => b.classList.add("hidden"));
      if (statusEl) statusEl.classList.add("hidden");
    } else {
      if (statusEl) statusEl.textContent = t("ext.instr.failed", { reason: (res.reason || "unknown error") });
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = t("ext.instr.failed", { reason: ((err && err.message) || "unknown error") });
  }
}

// Drives the multi-step first-run setup wizard. Calls markSetupComplete() when
// finished or skipped (the main process then clears the onboarding guard).
function runSetupWizard() {
  const wizard = document.getElementById("setup-wizard");
  if (!wizard) return;
  const steps = Array.from(wizard.querySelectorAll(".setup-step"));
  const dots = Array.from(wizard.querySelectorAll(".setup-dot"));
  const backBtn = wizard.querySelector("#setup-back");
  const nextBtn = wizard.querySelector("#setup-next");
  const skipBtn = wizard.querySelector("#setup-skip");
  const skipTourBtn = wizard.querySelector("#setup-skip-tour");
  const langSelect = wizard.querySelector("#setup-language");
  const TOTAL = steps.length;
  let current = 0;

  // Build the language picker and wire live language switching.
  if (window.buildLanguagePicker) window.buildLanguagePicker(langSelect);
  if (langSelect) {
    langSelect.value = window.getLang();
    langSelect.addEventListener("change", async () => {
      const lang = langSelect.value;
      // Apply the new language in place (translates the whole DOM live — no
      // restart needed). setLang() re-applies static text and dispatches
      // kuiqr:localize so dynamic strings refresh too.
      window.setLang(lang);
      render(); // keep the wizard's dynamic button labels in sync
      try {
        const s = await window.qrAPI.getSettings();
        s.language = lang;
        await window.qrAPI.saveSettings(s);
      } catch (e) { /* non-fatal */ }
    });
  }

  // Extension step download buttons.
  const extChrome = wizard.querySelector("#setup-ext-chrome");
  const extFirefox = wizard.querySelector("#setup-ext-firefox");
  const extStatus = wizard.querySelector("#setup-ext-status");
  const extInstr = wizard.querySelector("#setup-ext-instr");
  if (extChrome) extChrome.addEventListener("click", () => setupDownloadExtension("chrome", extStatus, extInstr, wizard));
  if (extFirefox) extFirefox.addEventListener("click", () => setupDownloadExtension("firefox", extStatus, extInstr, wizard));

  function render() {
    steps.forEach((el, i) => el.classList.toggle("hidden", i !== current));
    dots.forEach((d, i) => d.classList.toggle("active", i <= current));
    // Footer button visibility.
    backBtn.classList.toggle("hidden", current === 0);
    skipTourBtn.classList.toggle("hidden", current !== 3); // guide step only
    skipBtn.classList.toggle("hidden", current === TOTAL - 1); // hide on final step
    // Primary button label.
    if (current === 0) nextBtn.textContent = t("setup.getStarted");
    else if (current === TOTAL - 1) nextBtn.textContent = t("setup.finish");
    else if (current === 3) nextBtn.textContent = t("setup.guide.takeTour");
    else nextBtn.textContent = t("setup.next");
  }

  function goTo(i) {
    current = Math.max(0, Math.min(TOTAL - 1, i));
    render();
  }

  function finishSetup() {
    wizard.classList.add("hidden");
    // Mark onboarding complete (clears the onboarding guard in the main
    // process). We intentionally do NOT tuck the app into the menu bar here —
    // that only happens when the user later closes the window, so the app
    // stays open and visible after setup instead of appearing to "quit".
    try { window.qrAPI.markSetupComplete(); } catch (e) {}
  }

  nextBtn.addEventListener("click", () => {
    if (current === 0) return goTo(1);
    if (current === 1) return goTo(2);
    if (current === 2) return goTo(3); // proceed without installing the extension
    if (current === 3) {
      // Take the guided tour, then finish once it completes.
      wizard.classList.add("hidden");
      if (window.KuiqrTutorial) {
        window.KuiqrTutorial.start(() => finishSetup());
      } else {
        finishSetup();
      }
      return;
    }
    if (current === TOTAL - 1) return finishSetup();
  });

  backBtn.addEventListener("click", () => goTo(current - 1));
  skipTourBtn.addEventListener("click", () => goTo(TOTAL - 1));
  skipBtn.addEventListener("click", finishSetup);

  wizard.classList.remove("hidden");
  render();
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
    platformInfo.textContent = t("platform.running", { platform: currentPlatform.platform });
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
      showResult("no-qr", t("clip.noImage"), t("clip.hint"));
    }
  } catch (err) {
    console.error("Clipboard read error:", err);
    showResult("error", t("clip.err"), err.message);
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
    // Show preview (small, fast rendering).
    const container = document.getElementById("image-preview-container");
    const canvas = document.getElementById("preview-canvas");
    container.classList.remove("hidden");

    const previewMaxW = Math.min(img.width, 360);
    const previewMaxH = Math.min(img.height, 260);
    const previewScale = Math.min(previewMaxW / img.width, previewMaxH / img.height, 1);
    canvas.width = Math.round(img.width * previewScale);
    canvas.height = Math.round(img.height * previewScale);
    const previewCtx = canvas.getContext("2d");
    previewCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Decode at a higher resolution so artistic/embedded QR codes keep enough
    // detail. Preview stays small; decoding canvas is separate.
    const decodeMax = 1280;
    const decodeScale = Math.min(decodeMax / img.width, decodeMax / img.height, 1);
    const decodeW = Math.round(img.width * decodeScale);
    const decodeH = Math.round(img.height * decodeScale);
    const decodeCanvas = document.createElement("canvas");
    decodeCanvas.width = decodeW;
    decodeCanvas.height = decodeH;
    const decodeCtx = decodeCanvas.getContext("2d", { willReadFrequently: true });
    decodeCtx.drawImage(img, 0, 0, decodeW, decodeH);

    try {
      const result = decodeImageRobust(decodeCtx, decodeW, decodeH, { deep: true });
      if (result) {
        await handleDecodedResult(result);
      } else {
        showResult("no-qr", t("noQr"), t("noQr.sub"));
      }
    } catch (err) {
      console.error("Decode error:", err);
      showResult("error", t("decode.err"), err.message);
      // Surface the failure as an in-app overlay notification.
      showScanPopup("error", t("scanFailed"), err.message || t("scanFailedMsg"));
    }
  };
  img.onerror = () => {
    showResult("error", t("load.err"), t("load.err.sub"));
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
//   3. Hard / artistic / embedded codes get a bounded, time-limited fallback.
//
// Timing budgets (can be tuned):
//   - Fast path:     ~80 ms  (original + small up/down-scales)
//   - Medium path:  ~220 ms  (grayscale + contrast + a few thresholds)
//   - Deep path:    ~900 ms  (multi-scale, multi-channel, adaptive threshold)
//   - Absolute cap: 1400 ms  (never hang on a bad selection)
// ============================================================

const DECODER_BUDGET_FAST = 80;
const DECODER_BUDGET_MEDIUM = 220;
const DECODER_BUDGET_DEEP = 900;
const DECODER_BUDGET_ABSOLUTE = 1400;

function decodeImageRobust(ctx, w, h, opts = {}) {
  const deep = opts.deep === true;
  const imageData = ctx.getImageData(0, 0, w, h);
  const start = performance.now();
  const absoluteDeadline = start + DECODER_BUDGET_ABSOLUTE;
  const deepDeadline = start + DECODER_BUDGET_DEEP;

  // Guard against tiny / degenerate captures.
  if (w < 50 || h < 50) return null;

  // ── Instant reject: uniform / blank / blurry selections ──
  if (looksEmptyOrUniform(imageData)) return null;

  // ── FAST PATH ──
  // Original size, normal + inverted.
  let result = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
  if (result) return result;

  // Small up-scales help tiny but otherwise clean codes.
  for (const s of [1.5, 2, 2.5]) {
    if (performance.now() - start > DECODER_BUDGET_FAST) break;
    result = tryScaleDecode(ctx, w, h, s, (sd) =>
      jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
    );
    if (result) return result;
  }

  // Quick down-scales for huge captures where the QR is small.
  if (w > 600 || h > 600) {
    for (const s of [0.5, 0.75]) {
      if (performance.now() - start > DECODER_BUDGET_FAST) break;
      result = tryScaleDecode(ctx, w, h, s, (sd) =>
        jsQR(sd.data, sd.width, sd.height, { inversionAttempts: "attemptBoth" })
      );
      if (result) return result;
    }
  }

  // ── MEDIUM PATH ──
  // Grayscale + contrast stretch + threshold attempts at original size.
  if (performance.now() <= start + DECODER_BUDGET_MEDIUM) {
    let gray = grayscale(cloneImageData(imageData));
    gray = stretchContrast(gray);

    result = jsQR(gray.data, w, h, { inversionAttempts: "attemptBoth" });
    if (result) return result;

    for (const thresh of [80, 100, 128, 160, 180]) {
      if (performance.now() - start > DECODER_BUDGET_MEDIUM) break;
      const bin = binaryThreshold(gray, thresh);
      result = jsQR(bin.data, w, h, { inversionAttempts: "attemptBoth" });
      if (result) return result;
    }
  }

  // ── DEEP PATH ──
  // Only for hard codes: artistic/embedded, low contrast, color backgrounds.
  if (!deep && performance.now() > start + DECODER_BUDGET_MEDIUM) return null;

  const deepScales = [0.6, 0.8, 1.25, 1.5, 1.75];
  const deepThresholds = [60, 80, 100, 120, 140, 160, 180, 200];
  const channels = ["luma", "red", "green", "blue"];

  for (const s of deepScales) {
    if (performance.now() > deepDeadline) break;

    const sw = Math.round(w * s);
    const sh = Math.round(h * s);
    if (sw < 80 || sh < 80) continue;

    const sd = scaleImageData(ctx, w, h, sw, sh);

    for (const channel of channels) {
      if (performance.now() > deepDeadline) break;

      let ch = extractChannel(sd, channel);
      ch = stretchContrast(ch);

      result = jsQR(ch.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;

      const sharpened = sharpen(ch);
      result = jsQR(sharpened.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;

      const adapt = adaptiveThreshold(ch, 15, 0.2);
      result = jsQR(adapt.data, sw, sh, { inversionAttempts: "attemptBoth" });
      if (result) return result;

      for (const thresh of deepThresholds) {
        if (performance.now() > absoluteDeadline) break;
        const bin = binaryThreshold(ch, thresh);
        result = jsQR(bin.data, sw, sh, { inversionAttempts: "attemptBoth" });
        if (result) return result;

        const invBin = invertBin(bin);
        result = jsQR(invBin.data, sw, sh, { inversionAttempts: "attemptBoth" });
        if (result) return result;
      }
    }
  }

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

function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

// Extract a single color channel as grayscale. "luma" uses the standard
// luminance formula; RGB channels help when a QR code is hidden in one color.
function extractChannel(imageData, channel) {
  const out = new ImageData(new Uint8ClampedArray(imageData.data.length), imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    let v;
    switch (channel) {
      case "red": v = src[i]; break;
      case "green": v = src[i + 1]; break;
      case "blue": v = src[i + 2]; break;
      default: v = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    }
    dst[i] = dst[i + 1] = dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  return out;
}

// Simple 3x3 unsharp mask to make blurred QR modules crisper.
function sharpen(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new ImageData(new Uint8ClampedArray(src.length), w, h);
  const dst = out.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const j = ((y + ky) * w + (x + kx)) * 4;
          const weight = (ky === 0 && kx === 0) ? 5 : -0.5;
          sum += src[j] * weight;
        }
      }
      const v = Math.max(0, Math.min(255, Math.round(sum)));
      dst[i] = dst[i + 1] = dst[i + 2] = v;
      dst[i + 3] = 255;
    }
  }
  return out;
}

// Sauvola-like adaptive threshold using summed-area tables. Handles uneven
// lighting and colorful/artistic backgrounds where a global threshold fails.
function adaptiveThreshold(imageData, windowSize, k) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new ImageData(new Uint8ClampedArray(src.length), w, h);
  const dst = out.data;
  const half = Math.floor(windowSize / 2);
  const R = 128;

  // Build integral images for mean and variance in one pass.
  const integral = new Float64Array((w + 1) * (h + 1));
  const integralSq = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    for (let x = 1; x <= w; x++) {
      const v = src[((y - 1) * w + (x - 1)) * 4];
      rowSum += v;
      rowSumSq += v * v;
      const idx = y * (w + 1) + x;
      integral[idx] = integral[idx - (w + 1)] + rowSum;
      integralSq[idx] = integralSq[idx - (w + 1)] + rowSumSq;
    }
  }

  function rectSum(table, x1, y1, x2, y2) {
    return table[(y2 + 1) * (w + 1) + (x2 + 1)]
      - table[(y1) * (w + 1) + (x2 + 1)]
      - table[(y2 + 1) * (w + 1) + (x1)]
      + table[(y1) * (w + 1) + (x1)];
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half);
      const y2 = Math.min(h - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = rectSum(integral, x1, y1, x2, y2);
      const sumSq = rectSum(integralSq, x1, y1, x2, y2);
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      const std = Math.sqrt(Math.max(0, variance));
      const threshold = mean * (1 + k * ((std / R) - 1));
      const i = (y * w + x) * 4;
      const v = src[i] >= threshold ? 255 : 0;
      dst[i] = dst[i + 1] = dst[i + 2] = v;
      dst[i + 3] = 255;
    }
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
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const result = decodeImageRobust(ctx, canvas.width, canvas.height, { deep: true });
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
    url: { label: t("hist.type.url"), cls: "url" },
    text: { label: t("hist.type.text"), cls: "text" },
    "no-qr": { label: t("hist.type.noqr"), cls: "no-qr" },
    error: { label: t("hist.type.noqr"), cls: "no-qr" },
  };

  const cfg = typeConfig[type] || typeConfig["text"];
  badge.textContent = cfg.label;
  badge.className = "result-badge " + cfg.cls;

  dataEl.textContent = data;

  actionsEl.innerHTML = "";
  if (isUrl && type === "url") {
    actionsEl.innerHTML = `<button class="btn-result" id="result-open-btn">${t("result.open")}</button>`;
    document.getElementById("result-open-btn").addEventListener("click", () => {
      window.qrAPI.openUrl(data.startsWith("http") ? data : `https://${data}`);
    });
  } else if (type === "text") {
    actionsEl.innerHTML = `<button class="btn-result" id="result-copy-btn">${t("result.copy")}</button>`;
    document.getElementById("result-copy-btn").addEventListener("click", () => {
      window.qrAPI.copyClipboard(data);
      document.getElementById("result-copy-btn").textContent = t("result.copied");
      setTimeout(() => { document.getElementById("result-copy-btn").textContent = t("result.copy"); }, 1500);
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
  lastHistory = history || [];
  renderHistory(lastHistory);
}

function renderHistory(history) {
  const list = document.getElementById("history-list");
  if (!history) history = [];

  if (!history.length) {
    list.innerHTML = `<p class="empty-state" data-i18n="history.empty">${t("history.empty")}</p>`;
    return;
  }

  list.innerHTML = history
    .map((item) => {
      const typeLabel = { url: t("hist.type.url"), text: t("hist.type.text"), "no-qr": t("hist.type.noqr") }[item.type] || t("hist.type.unknown");
      const display = item.data
        ? item.data.length > 100
          ? item.data.slice(0, 100) + "\u2026"
          : item.data
        : t("hist.noqr");
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
    recordLabel.textContent = t("shortcut.recordLabel", { shortcut: formatShortcutForDisplay(currentShortcut) });
  }

  // Snapshot form values so we can detect unsaved changes.
  savedSettingsSnapshot = getSettingsFormValues();
  settingsDirty = false;
  const saveBtn = document.getElementById("save-settings-btn");
  if (saveBtn) saveBtn.textContent = t("btn.save");
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
    label.textContent = t("shortcut.press");
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
      label.textContent = t("shortcut.saved");
    } else {
      label.textContent = t("shortcut.cancelled");
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
    label.textContent = t("shortcut.checking");

    window.qrAPI.testShortcut(accelerator).then((ok) => {
      if (ok) {
        // Record = save: persist immediately and make it the active shortcut
        persistShortcut(accelerator).then(() => stopRecording(accelerator));
      } else {
        label.textContent = t("shortcut.cantUse");
        finalizing = false;
        pressedKeys = {};
        setTimeout(() => {
          if (recording && !finalizing) label.textContent = t("shortcut.press");
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
    recordLabel.textContent = t("shortcut.recordLabel", { shortcut: formatShortcutForDisplay(currentShortcut) });
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
      errorEl.textContent = t("gen.error", { msg: (e.message || "text may be too long for a QR code") });
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
      showScanPopup("success", t("genDown"), t("genDownSub"));
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
        copyQrBtn.textContent = t("result.copied");
        setTimeout(() => { copyQrBtn.textContent = t("gen.copyqr"); }, 1500);
        showScanPopup("success", t("qrCopied"), t("qrCopiedSub"));
      } catch (err) {
        showScanPopup("error", t("copyFail"), err.message || t("scanFailedMsg"));
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (!input.value) return;
      window.qrAPI.copyClipboard(input.value);
      copyBtn.textContent = t("result.copied");
      setTimeout(() => { copyBtn.textContent = t("gen.copytext"); }, 1500);
      showScanPopup("success", t("textCopied"), t("textCopiedSub"));
    });
  }
}

// ============================================================
// Language picker + i18n refresh
// ============================================================

function setupLanguagePicker() {
  const sel = document.getElementById("setting-language");
  if (!sel) return;
  sel.addEventListener("change", async () => {
    const lang = sel.value;
    // Apply the new language immediately (setLang re-translates the whole UI
    // in place and refreshes dynamic strings — no app restart required).
    window.setLang(lang);
    // Persist the choice so it survives restarts.
    try {
      const settings = await window.qrAPI.getSettings();
      settings.language = lang;
      await window.qrAPI.saveSettings(settings);
    } catch (e) { /* non-fatal */ }
  });
}

// Re-render JS-built (dynamic) strings after a language switch. Static DOM is
// already handled by i18n.applyI18n(); here we refresh what app.js generates.
function localize() {
  renderHistory(lastHistory);
  updateSettingsDirtyState();
  updateShortcutDisplay(currentShortcut);
  setScanButtonLabel();

  // Refresh the shortcut-recorder button label so it doesn't stay in the old
  // language after a switch.
  const recordLabel = document.getElementById("shortcut-record-label");
  const recordBtn = document.getElementById("shortcut-record-btn");
  if (recordLabel && recordBtn && !recordBtn.classList.contains("recording")) {
    recordLabel.textContent = t("shortcut.recordLabel", { shortcut: formatShortcutForDisplay(currentShortcut) });
  }
}

// Keep the scan button's label + shortcut kbd in sync (used on init + re-localize).
function setScanButtonLabel() {
  const scanBtn = document.getElementById("scan-btn");
  if (!scanBtn) return;
  const label = scanBtn.querySelector(".btn-label");
  const kbd = scanBtn.querySelector("#shortcut-display");
  if (label) label.textContent = t("btn.scan");
  if (kbd) kbd.textContent = formatShortcutForDisplay(currentShortcut);
}

// ============================================================
// Updates — check for + download the latest GitHub release
// ============================================================

function setupUpdates() {
  const checkBtn = document.getElementById("check-updates-btn");
  const dlBtn = document.getElementById("update-download-btn");
  const statusEl = document.getElementById("update-status");
  const currentEl = document.getElementById("update-current");
  const modalLater = document.getElementById("update-later-btn");
  const modalNow = document.getElementById("update-now-btn");
  const progressWrap = document.getElementById("update-progress-wrap");
  const progressBar = document.getElementById("update-progress-bar");
  const progressText = document.getElementById("update-progress-text");
  const progressSize = document.getElementById("update-progress-size");
  const progressHint = document.getElementById("update-progress-hint");

  function setProgress(info) {
    const pct = info && typeof info.percent === "number" ? info.percent : 0;
    const downloaded = info && info.downloaded;
    const total = info && info.total;
    const filename = info && info.filename;
    if (progressBar) progressBar.style.width = pct + "%";
    if (progressText) progressText.textContent = t("updates.progress.text");
    if (progressSize) progressSize.textContent = (downloaded && total) ? t("updates.progress.size", { downloaded, total }) : "";
    if (progressHint) progressHint.textContent = t("updates.progress.hint", { filename: filename || "Kuiqr-update" });
  }

  function showProgress(show) {
    if (progressWrap) progressWrap.classList.toggle("hidden", !show);
  }

  function resetProgress() {
    if (progressBar) progressBar.style.width = "0%";
    if (progressText) progressText.textContent = t("updates.progress.text");
    if (progressSize) progressSize.textContent = "";
  }

  window.qrAPI.getAppVersion().then((v) => {
    if (currentEl) currentEl.textContent = t("updates.current", { ver: v || "?" });
  });

  // Live download progress pushed from the main process.
  window.qrAPI.onUpdateProgress((info) => {
    if (info && info.phase === "installing") {
      if (statusEl) { statusEl.textContent = t("updates.status.installing"); statusEl.className = "update-status"; }
      showProgress(false);
      resetProgress();
      return;
    }
    if (info && info.done) {
      showProgress(false);
      resetProgress();
      return;
    }
    showProgress(true);
    setProgress(info);
  });

  if (checkBtn) checkBtn.addEventListener("click", () => {
    showProgress(false);
    resetProgress();
    checkForUpdates(false);
  });
  // The inline "Download Update" button is a secondary path; the primary prompt
  // is the in-app update modal (see showUpdateModal).
  if (dlBtn) dlBtn.addEventListener("click", () => { if (pendingUpdateUrl) installUpdate(pendingUpdateUrl, pendingUpdateName, pendingUpdateLatest); });

  if (modalLater) modalLater.addEventListener("click", () => {
    updateModalDismissedVersion = pendingUpdateLatest || null;
    hideUpdateModal();
  });
  if (modalNow) modalNow.addEventListener("click", () => {
    const url = pendingUpdateUrl, name = pendingUpdateName, latest = pendingUpdateLatest;
    hideUpdateModal();
    if (url) installUpdate(url, name, latest);
  });

  // Silent background check on startup — skip if the machine is offline so we
  // don't flash a misleading "Could not check for updates" message.
  probeInternet().then((online) => {
    if (online) checkForUpdates(true);
  });
}

async function probeInternet() {
  try {
    const res = await window.qrAPI.checkInternet();
    return res && res.online;
  } catch {
    // If the probe itself fails, fall back to the browser's online hint.
    return navigator.onLine;
  }
}

function showUpdateModal(res) {
  if (updateModalDismissedVersion === (res && res.latest)) return;
  pendingUpdateUrl = res.assetUrl || null;
  pendingUpdateName = res.assetName || null;
  pendingUpdateLatest = res.latest || null;

  const modal = document.getElementById("update-modal");
  const titleEl = document.getElementById("update-modal-title");
  const subEl = document.getElementById("update-modal-sub");
  const notesEl = document.getElementById("update-modal-notes");
  const nowBtn = document.getElementById("update-now-btn");

  if (titleEl) titleEl.textContent = t("updates.modal.title");
  if (subEl) subEl.textContent = t("updates.modal.sub", { latest: res.latest || "?" });
  if (notesEl) {
    const notes = (res.notes || "")
      .replace(/^#+\s?/gm, "")   // strip markdown headings
      .replace(/[*_`>#]/g, "")   // strip common markdown chars
      .trim();
    if (notes) {
      notesEl.textContent = notes;
      notesEl.classList.remove("hidden");
    } else {
      notesEl.textContent = "";
      notesEl.classList.add("hidden");
    }
  }
  if (nowBtn) nowBtn.textContent = t("updates.modal.now");
  if (modal) modal.classList.remove("hidden");
}

function hideUpdateModal() {
  const modal = document.getElementById("update-modal");
  if (modal) modal.classList.add("hidden");
}

async function checkForUpdates(silent) {
  const statusEl = document.getElementById("update-status");
  const dlBtn = document.getElementById("update-download-btn");
  if (dlBtn) dlBtn.classList.add("hidden");
  // Only show the "Checking…" spinner on a manual press, not on the silent
  // background startup check (which would otherwise flash text briefly).
  if (!silent && statusEl) { statusEl.textContent = t("updates.status.checking"); statusEl.className = "update-status"; }

  try {
    const res = await window.qrAPI.checkForUpdates();
    if (!res || !res.ok) throw new Error("no data");
    pendingUpdateUrl = res.assetUrl || null;
    pendingUpdateName = res.assetName || null;
    pendingUpdateLatest = res.latest || null;

    if (res.updateAvailable) {
      if (statusEl) { statusEl.textContent = t("updates.status.available", { latest: res.latest }); statusEl.className = "update-status success"; }
      // Prompt the user in-app (no GitHub link needed).
      showUpdateModal(res);
    } else {
      if (statusEl) {
        statusEl.textContent = silent ? "" : t("updates.status.uptodate", { cur: res.currentVersion || "?" });
        statusEl.className = "update-status" + (silent ? "" : " success");
      }
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = silent ? "" : t("updates.status.error");
      statusEl.className = "update-status" + (silent ? "" : " error");
    }
  }
}

async function installUpdate(url, assetName, latest) {
  const statusEl = document.getElementById("update-status");
  const progressWrap = document.getElementById("update-progress-wrap");
  const progressBar = document.getElementById("update-progress-bar");
  if (progressWrap) progressWrap.classList.remove("hidden");
  if (progressBar) progressBar.style.width = "0%";
  if (statusEl) { statusEl.textContent = t("updates.status.downloading"); statusEl.className = "update-status"; }
  try {
    const res = await window.qrAPI.installUpdate(url, assetName, latest);
    if (progressWrap) progressWrap.classList.add("hidden");
    if (progressBar) progressBar.style.width = "0%";
    if (res && res.ok && res.relaunch) {
      // The main process will relaunch the new version automatically.
      if (statusEl) { statusEl.textContent = t("updates.status.installed"); statusEl.className = "update-status success"; }
      return;
    }
    // Auto-install didn't complete — the main process opened the installer for
    // the user (or there was an error). Surface a clear message.
    if (statusEl) {
      const isManual = res && (res.reason === "manual-install" || res.reason === "auto-install-failed" || res.fallbackOpened);
      statusEl.textContent = isManual ? t("updates.status.open") : ((res && res.reason) || t("updates.status.error"));
      statusEl.className = "update-status" + (isManual ? "" : " error");
    }
  } catch (e) {
    if (progressWrap) progressWrap.classList.add("hidden");
    if (progressBar) progressBar.style.width = "0%";
    if (statusEl) { statusEl.textContent = e.message || t("updates.status.error"); statusEl.className = "update-status error"; }
  }
}

// ============================================================
// Helpers
// ============================================================

function formatTime(ts) {
  const date = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return t("time.justnow");
  if (diff < 3600000) return t("time.mago", { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t("time.hago", { n: Math.floor(diff / 3600000) });
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
