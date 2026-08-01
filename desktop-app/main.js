// ============================================================
// Kuiqr — Electron Main Process (v2.4.0)
// Features:
//   1. Global hotkey → scan
//   2. macOS: uses the NATIVE screen-selection UI (screencapture -i) — the
//      system draws the crosshair/dim overlay itself. The app stays in the
//      background; no Electron window is ever opened while scanning, and the
//      captured image exists only in memory.
//   3. Windows / other: Electron overlay that reuses the main window.
//   4. In-app scan: paste from clipboard or drag-drop image → decode instantly
//   5. Auto-detect keyboard shortcut recorder in Settings
//   6. Main window with scan history, settings, manual trigger
//   7. System tray for background operation (app stays alive on all platforms)
//   8. All processing local — no data sent to any server
//   9. macOS: asks for Automation permission at launch (native OS prompt) and
//      provides a Settings button to jump to System Settings → Privacy & Security → Automation
// ============================================================

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, Tray, Menu, nativeImage, shell, clipboard, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync, spawn, exec } = require("child_process");

let mainWindow = null;
let tray = null;
let isQuiting = false; // set true when we actually want to quit (so window-close hides don't block it)
let lastScreenshot = null; // NativeImage of the full screen capture (Windows overlay path)
let isInOverlayMode = false;   // true while mainWindow is showing the scan overlay (Windows)
let savedWindowState = null;    // saved bounds/state to restore after overlay (Windows)
let rendererReady = false;      // set when the renderer signals it's listening for decode jobs
let pendingDecodeBuffer = null; // captured PNG waiting for the renderer to be ready

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

// ── Settings (stored next to the app's userData) ──
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
const HISTORY_PATH = path.join(app.getPath("userData"), "history.json");

const DEFAULT_SETTINGS = {
  shortcut: "CommandOrControl+Shift+Y",
  autoOpenUrl: true,
  copyTextToClipboard: true,
  showNotification: true,
  maxHistory: 50,
  launchAtLogin: false,
  browserExtensionPriority: true, // when true and a browser is the foreground app, let the browser extension handle the shortcut
};

function loadSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

function loadHistory() {
  try {
    const data = fs.readFileSync(HISTORY_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveHistory(history) {
  const settings = loadSettings();
  const trimmed = history.slice(0, settings.maxHistory || 50);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(trimmed, null, 2), "utf-8");
}

function addToHistory(data, type) {
  const history = loadHistory();
  history.unshift({ data, type, timestamp: Date.now() });
  saveHistory(history);
  return history;
}

// ============================================================
// App Lifecycle
// ============================================================

// Ensure a single running instance. Re-launching the app (e.g. double-clicking the
// Windows .exe again) focuses the existing window instead of spawning a second copy.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // Another instance is already running — let it handle everything and exit.
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    createMainWindow(); // shows itself on launch
    createTray();
    registerShortcut();

    // On macOS, proactively trigger the native "Automation" permission prompt the
    // first time the app opens. macOS only shows its own system alert (we draw no
    // custom dialog) the first time an app controls System Events. See
    // requestAutomationPermissionIfNeeded() for details.
    if (isMac) requestAutomationPermissionIfNeeded();

    app.on("activate", () => {
      // macOS dock click / generic focus request
      showMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  // Keep the app alive in the background (tray + global shortcut) on ALL platforms,
  // so the user can always re-open it via the tray icon or the global hotkey.
  // A registered listener suppresses Electron's default quit-on-close, so when we
  // genuinely want to quit (isQuiting === true, set by tray Quit / Cmd+Q / menu
  // Quit) we must explicitly quit here.
  if (isQuiting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuiting = true;
  globalShortcut.unregisterAll();
});

// ============================================================
// Main Window
// ============================================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 380,
    minHeight: 500,
    show: false, // start hidden — the app lives in the background (tray); scanning never shows it
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    backgroundColor: "#f8fafc",
    // macOS uses the native screencapture UI (no overlay), so an opaque window is fine.
    // Windows reuses this window as a transparent overlay, so it must be transparent there.
    transparent: !isMac,
    icon: path.join(__dirname, "icons", "icon128.png"),
    webPreferences: {
      preload: path.join(__dirname, "renderer", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (e) => {
    // Normally hide to the tray instead of quitting, so the app + global shortcut
    // keep working after the window is closed. But when we're genuinely quitting
    // (isQuiting === true), let the window actually close so the app can exit.
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.focus();
    });
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ============================================================
// System Tray
// ============================================================

function createTray() {
  const iconPath = path.join(__dirname, "icons", isMac ? "icon16.png" : "icon32.png");
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon);
  tray.setToolTip("Kuiqr");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Scan Screen", click: () => triggerScan() },
    { type: "separator" },
    { label: "Show Window", click: () => showMainWindow() },
    { label: "Settings", click: () => { showMainWindow(); mainWindow.webContents.send("switch-tab", "settings"); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuiting = true; globalShortcut.unregisterAll(); app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });
}

// ============================================================
// Global Shortcut
// ============================================================

// When the user is recording a NEW shortcut in Settings, we fully unregister the
// global hotkey so the keystrokes they press are captured by the recorder and do
// NOT trigger a scan / open the capture overlay. registerShortcut() becomes a no-op
// while `shortcutSuspended` is true (we just remember the intent). resumeShortcut()
// re-registers with whatever is currently saved.
let shortcutSuspended = false;
let appShortcutActive = false;   // true when an OS-level global shortcut is currently registered
let fgMonitorTimer = null;       // polls the foreground app to toggle the global shortcut (priority mode)

function suspendShortcut() {
  shortcutSuspended = true;
  globalShortcut.unregisterAll();
  appShortcutActive = false;
}

function resumeShortcut() {
  shortcutSuspended = false;
  registerShortcut();
}

// Registers the actual OS-level global shortcut (one of the candidates). Exposed
// so the foreground monitor can re-register after the user switches away from a
// browser. Returns true if a shortcut is now active.
function registerAppShortcut() {
  globalShortcut.unregisterAll();
  appShortcutActive = false;

  const settings = loadSettings();
  // Try the user's saved shortcut first, then fall back to a few guaranteed-valid
  // accelerators so the hotkey always works even if a stored value became invalid.
  const candidates = [
    settings.shortcut,
    "CommandOrControl+Shift+Y",
    "Shift+Y", // user-requested simpler combo (note: intercepts the Y key globally)
    "CommandOrControl+Shift+S",
    "CommandOrControl+Shift+A",
  ];

  for (const accel of candidates) {
    if (!accel || typeof accel !== "string") continue;
    try {
      const ok = globalShortcut.register(accel, () => {
        triggerScan();
      });
      if (ok) {
        appShortcutActive = true;
        console.log("Kuiqr: registered global shortcut:", accel);
        return true;
      }
    } catch (err) {
      console.error("Kuiqr: failed to register", accel, err);
    }
  }
  return false;
}

function registerShortcut() {
  // Don't actually register while the user is recording a new shortcut.
  if (shortcutSuspended) return;

  const settings = loadSettings();
  const priority = !!settings.browserExtensionPriority;

  // ── Browser-extension priority ──────────────────────────────────────────────
  // The browser extension reacts to Cmd/Ctrl+Shift+Y through a page-keydown
  // listener in content.js — which only fires when the OS delivers the keystroke
  // to the browser. If THIS app holds the shortcut as a global hotkey, the OS
  // routes the key to the app and the extension never sees it. So when priority
  // is on we must NOT hold the global shortcut while a browser is the foreground
  // app: we release it (so the extension gets the key) and hold it only when the
  // user is in a non-browser app. A monitor toggles this as the user switches apps.
  if (priority && isMac) {
    if (isForegroundAppBrowser()) {
      // Browser is foreground right now → release so the extension receives it.
      globalShortcut.unregisterAll();
      appShortcutActive = false;
    } else {
      // Non-browser foreground → hold the shortcut so this app scans on it.
      registerAppShortcut();
    }
    startForegroundMonitor();
    return;
  }

  // Priority off (or non-mac): always hold the global shortcut.
  stopForegroundMonitor();
  const ok = registerAppShortcut();
  if (!ok) {
    // Nothing registered — tell the user they can still use the tray / in-app button.
    showNotification(
      "Kuiqr",
      "Global shortcut unavailable. Use the tray icon or the 'Select Screen Area' button to scan."
    );
  }
}

// ── Foreground-app monitor (browser-extension priority mode) ─────────────────
// Toggles the OS-level global shortcut based on which app is frontmost so that,
// with priority enabled, a browser keeps the shortcut (extension fires) and a
// non-browser app yields it to this app. Polling is used because Electron does
// not expose a reliable foreground-app-change event without native code.
function startForegroundMonitor() {
  if (fgMonitorTimer) return;
  fgMonitorTimer = setInterval(syncShortcutToForegroundApp, 300);
  syncShortcutToForegroundApp();
}

function stopForegroundMonitor() {
  if (fgMonitorTimer) {
    clearInterval(fgMonitorTimer);
    fgMonitorTimer = null;
  }
}

function syncShortcutToForegroundApp() {
  if (shortcutSuspended) return; // recording a new shortcut — leave unregistered
  const browser = isForegroundAppBrowser();
  if (browser) {
    // Release so the browser extension can receive the keystroke.
    if (appShortcutActive) {
      globalShortcut.unregisterAll();
      appShortcutActive = false;
    }
  } else {
    // Re-claim the shortcut for this app.
    if (!appShortcutActive) registerAppShortcut();
  }
}

function reregisterShortcut() {
  registerShortcut();
}

// ============================================================
// Screen Capture + Overlay
// ============================================================

// Returns true if the currently focused application is a known web browser.
// Used so the browser extension can take priority over this app's global shortcut.
// Best-effort: fully implemented on macOS; on other platforms returns false
// (the app always scans) until a platform-specific check is added.
function isForegroundAppBrowser() {
  if (!isMac) return false;
  try {
    const bid = execSync(
      'osascript -e \'tell application "System Events" to get bundle identifier of (first process whose frontmost is true)\'',
      { timeout: 2000 }
    ).toString().trim();
    const BROWSERS = [
      "com.google.Chrome",
      "com.google.Chrome.canary",
      "com.microsoft.edgemac",
      "com.microsoft.edgemac.Canary",
      "org.mozilla.firefox",
      "com.brave.Browser",
      "com.operasoftware.Opera",
      "com.operasoftware.OperaNext",
      "com.vivaldi.Vivaldi",
      "company.thebrowser.Browser", // Arc
      "com.yandex.desktop.yandex",
      "com.qwant.engine.macos",
      "com.ecosia.mac",
      "com.centbrowser.Chrome",
      "com.duckduckgo.mobile.ios",
      "com.tencent.webtab", // QQ Browser
      "com.ucweb.uc", // UC Browser
      "com.baidu.Baidu", // Baidu Browser
    ];
    return BROWSERS.includes(bid);
  } catch {
    return false;
  }
}

// ============================================================
// macOS Automation permission
// ============================================================
// The browser-extension priority feature needs to know which app is frontmost,
// which we read via AppleScript / System Events. The FIRST time the app does this,
// macOS shows its OWN native alert ("Kuiqr wants to control System
// Events"). We deliberately run that osascript once at launch so the user is asked
// for the permission up front — there is no custom dialog, just the OS popup.
// (macOS only prompts once per app. If it was already granted or denied the alert
// won't reappear; the user can still grant it later via the in-app settings button.)
function requestAutomationPermissionIfNeeded() {
  if (!isMac) return;
  try {
    // Running this fires an osascript that requires Automation access, which makes
    // macOS present its native permission prompt on first run. We ignore the result.
    isForegroundAppBrowser();
  } catch {
    // The OS prompt may be shown while osascript is waiting; ignore any error here.
  }
}

// Opens System Settings → Privacy & Security → Automation so the user can grant or
// review this app's Automation permission. Wired to the in-app settings button.
ipcMain.handle("open-automation-settings", () => {
  if (!isMac) return { ok: false, reason: "unsupported-platform" };
  try {
    // Deep link straight to the Automation sub-page of Privacy & Security.
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"');
    return { ok: true };
  } catch (err) {
    // Fallback: open the Security & Privacy pane (the anchor may differ by macOS version).
    try {
      exec('open "x-apple.systempreferences:com.apple.preference.security"');
    } catch { /* ignore */ }
    return { ok: false, reason: String((err && err.message) || err) };
  }
});

// Check whether the Automation permission has already been granted (macOS only).
// The renderer calls this on the Settings tab to decide whether to show or hide
// the "macOS Automation permission" row — once granted it stays granted, so
// there's no point showing a button the user no longer needs.
ipcMain.handle("check-automation-permission", () => {
  if (!isMac) return { granted: true }; // non-mac: irrelevant, hide the row
  try {
    isForegroundAppBrowser(); // will throw if permission was denied
    return { granted: true };
  } catch {
    return { granted: false };
  }
});

async function triggerScan() {
  try {
    if (isMac) {
      // Native macOS selection UI — no Electron window is ever involved.
      await scanMacNative();
    } else {
      // Windows / other: Electron overlay that reuses the main window.
      await scanWithOverlay();
    }
  } catch (err) {
    console.error("Scan error:", err);
    showNotification("Kuiqr Error", err.message || "Scan failed");
  }
}

// ── macOS: native screen-selection experience ────────────────────────────────
// We shell out to `screencapture -i` — the SAME tool the built-in macOS
// screenshot uses. The system draws the crosshair + dim overlay itself. The app
// window is never opened, shown, or brought to the front. The captured region is
// loaded into memory, decoded, and discarded. Esc cancels (no file is written).
const SCREENCAPTURE_BIN = "/usr/sbin/screencapture";

async function scanMacNative() {
  if (!fs.existsSync(SCREENCAPTURE_BIN)) {
    showNotification("Kuiqr", "Native screen capture is not available on this system.");
    return;
  }

  const tmpPath = path.join(app.getPath("temp"), `qr-scan-${Date.now()}.png`);

  // -x : no shutter sound
  // -i : interactive — drag a rectangle (or click a window), exactly like the
  //      built-in screenshot tool. Pressing Esc cancels and writes NO file.
  const code = await runScreencapture(tmpPath);

  // Cancelled (Esc) or nothing selected → no file written → silently return to idle.
  if (code !== 0 || !fs.existsSync(tmpPath)) {
    return;
  }

  let buffer = null;
  try {
    const ni = nativeImage.createFromPath(tmpPath);
    if (ni.isEmpty()) {
      showNotification(
        "Screen capture blocked",
        "Please grant Screen Recording permission in System Settings → Privacy & Security, then try again."
      );
      return;
    }
    buffer = fs.readFileSync(tmpPath);
  } finally {
    // The captured image exists only in memory from here on.
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  if (!buffer) return;

  // Indicate scanning has started (respects the "show notifications" setting).
  try {
    const s = loadSettings();
    if (s.showNotification) showNotification("Kuiqr", "Scanning…");
  } catch { /* ignore */ }

  // Decode in the hidden renderer (it hosts the proven robust QR decoder).
  // The app stays in the background — no window is shown.
  if (rendererReady && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("decode-buffer", buffer);
  } else {
    // Renderer not ready yet — stash and flush once it signals ready.
    pendingDecodeBuffer = buffer;
  }
}

function runScreencapture(tmpPath) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (c) => { if (!done) { done = true; resolve(c); } };
    const child = spawn(SCREENCAPTURE_BIN, ["-x", "-i", tmpPath]);
    child.on("close", (code) => finish(code === null ? -1 : code));
    child.on("error", () => finish(-1));
    // Failsafe: if screencapture hangs (e.g. a permission prompt), don't block forever.
    setTimeout(() => finish(-1), 60000);
  });
}

// ── Windows / other: Electron overlay (reuses the main window) ───────────────
async function scanWithOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor;

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
    },
  });

  if (!sources || sources.length === 0) {
    showNotification("Kuiqr", "Could not capture the screen.");
    return;
  }

  const source = sources[0];
  lastScreenshot = source.thumbnail;

  if (lastScreenshot.isEmpty()) {
    showNotification(
      "Screen capture blocked",
      "Please grant Screen Recording permission in System Settings → Privacy & Security, then try again."
    );
    return;
  }

  const tempPath = path.join(app.getPath("temp"), "qr-scan-screenshot.png");
  fs.writeFileSync(tempPath, lastScreenshot.toPNG());

  enterOverlayMode(tempPath, { width, height, scaleFactor });
}

// ============================================================
// Screen Overlay — reuses mainWindow (no separate window)
// ============================================================

function enterOverlayMode(screenshotPath, displayInfo) {
  if (!mainWindow || isInOverlayMode) return;
  isInOverlayMode = true;

  const { width, height } = displayInfo;

  // Save current window state so we can restore it after scanning
  savedWindowState = {
    bounds: mainWindow.getBounds(),
    resizable: mainWindow.isResizable(),
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
  };

  // Transform mainWindow into a fullscreen transparent overlay
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setResizable(false);
  mainWindow.setBounds({ x: 0, y: 0, width, height });
  // Use setBackgroundMaterial for transparency on macOS / DWM blur on Windows
  try {
    mainWindow.setBackgroundMaterial("acrylic");
  } catch (e) {
    // fallback: just rely on transparent: true + CSS background
  }

  // Load overlay.html into the SAME window (replaces index.html temporarily)
  mainWindow.loadFile(path.join(__dirname, "overlay.html"), {
    query: {
      screenshot: screenshotPath,
      width: String(width),
      height: String(height),
      scaleFactor: String(displayInfo.scaleFactor),
    },
  });
}

function exitOverlayMode() {
  if (!isInOverlayMode || !mainWindow) return;
  isInOverlayMode = false;

  // Restore normal window appearance
  mainWindow.setAlwaysOnTop(savedWindowState ? savedWindowState.alwaysOnTop : false);
  mainWindow.setResizable(savedWindowState ? savedWindowState.resizable : true);

  try {
    mainWindow.setBackgroundMaterial("none");
  } catch (e) { /* ignore */ }

  // Restore original bounds and reload the normal app UI
  if (savedWindowState && savedWindowState.bounds) {
    mainWindow.setBounds(savedWindowState.bounds);
  }
  savedWindowState = null;

  // Reload main app UI
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

// ============================================================
// IPC Handlers
// ============================================================

// Overlay closed without a selection — restore main window
ipcMain.handle("overlay-cancel", () => {
  exitOverlayMode();
});

// Overlay finished — restore main window
ipcMain.handle("overlay-done", () => {
  exitOverlayMode();
});

// Renderer requests: trigger scan
ipcMain.handle("trigger-scan", () => {
  triggerScan();
});

// Renderer requests: get settings
ipcMain.handle("get-settings", () => {
  return loadSettings();
});

// Renderer requests: save settings
ipcMain.handle("save-settings", (event, settings) => {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  saveSettings(merged);
  reregisterShortcut();
  return merged;
});

// Renderer requests: get history
ipcMain.handle("get-history", () => {
  return loadHistory();
});

// Renderer requests: clear history
ipcMain.handle("clear-history", () => {
  saveHistory([]);
  return [];
});

// Renderer requests: open URL
ipcMain.handle("open-url", (event, url) => {
  shell.openExternal(url);
});

// Renderer requests: copy to clipboard
ipcMain.handle("copy-clipboard", (event, text) => {
  clipboard.writeText(text);
});

// Overlay / renderer decodes the QR locally and sends the decoded string (or null).
// The main process applies the side effects: open URL / copy text / history / notification.
ipcMain.handle("decoded", (event, data) => applyDecodedResult(data));

// Single source of truth for what happens after a QR code is decoded (or not):
// open the URL / copy the text / record history / notify. Used by BOTH the
// in-app scan path and the native macOS scan path.
function applyDecodedResult(data) {
  const settings = loadSettings();

  if (!data) {
    if (settings.showNotification) {
      showNotification("No QR Found", "No QR code detected in the selected area.");
    }
    return { result: "none" };
  }

  const text = String(data).trim();
  const isUrl = /^(https?:\/\/|www\.)/i.test(text);

  if (isUrl && settings.autoOpenUrl) {
    const targetUrl = text.startsWith("http") ? text : `https://${text}`;
    shell.openExternal(targetUrl);
    addToHistory(text, "url");
    if (settings.showNotification) {
      showNotification("QR Found — Opening URL", text.slice(0, 100));
    }
    return { result: "url", data: text };
  }

  if (settings.copyTextToClipboard) {
    clipboard.writeText(text);
  }
  addToHistory(text, "text");
  if (settings.showNotification) {
    showNotification("QR Found — Copied to Clipboard", text.slice(0, 100));
  }
  return { result: "text", data: text };
}

// Renderer tells us it's ready to receive decode jobs (so we never lose a
// captured image if a scan happens before the page has finished loading).
ipcMain.on("renderer-ready", () => {
  rendererReady = true;
  if (pendingDecodeBuffer && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("decode-buffer", pendingDecodeBuffer);
    pendingDecodeBuffer = null;
  }
});

// ============================================================
// Notifications
// ============================================================

// Keep a reference to every Notification we create. Electron destroys a
// notification that has no JS reference, which silently prevents it from ever
// being displayed — a common reason "notifications don't appear". We hold the
// reference for a while, then release it.
const activeNotifications = [];

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  try {
    const n = new Notification({
      title,
      body,
      icon: path.join(__dirname, "icons", "icon128.png"),
    });
    n.show();
    activeNotifications.push(n);
    setTimeout(() => {
      const i = activeNotifications.indexOf(n);
      if (i !== -1) activeNotifications.splice(i, 1);
    }, 15000);
  } catch (err) {
    console.error("Kuiqr: notification failed:", err);
  }
}

// ============================================================
// IPC: platform info
// ============================================================

ipcMain.handle("get-platform", () => {
  return { isMac, isWin, platform: process.platform };
});

// ============================================================
// IPC: Read image from clipboard (for in-app paste scan)
// ============================================================

ipcMain.handle("read-clipboard-image", () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  const dataUrl = img.toDataURL();
  // Return null if it's a tiny/blank image
  if (dataUrl === "data:,") return null;
  return dataUrl;
});

// ============================================================
// IPC: Test if a shortcut accelerator is valid
// ============================================================

ipcMain.handle("test-shortcut", (event, accelerator) => {
  if (!accelerator || typeof accelerator !== "string") return false;
  try {
    // Try to register temporarily to validate format
    // Unregister right after — this is just a format check
    const ok = globalShortcut.register(accelerator, () => {});
    if (ok) globalShortcut.unregister(accelerator);
    return ok;
  } catch {
    return false;
  }
});

// IPC: Suspend / resume the global shortcut (used while recording a new one)
// ============================================================
ipcMain.handle("suspend-shortcut", () => {
  suspendShortcut();
  return true;
});

ipcMain.handle("resume-shortcut", () => {
  resumeShortcut();
  return true;
});

// Renderer requests: show a system notification (respects the "show notifications" setting)
ipcMain.handle("show-notification", (event, title, body) => {
  const settings = loadSettings();
  if (settings.showNotification) {
    showNotification(title, body);
  }
});
