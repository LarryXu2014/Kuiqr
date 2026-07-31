// ============================================================
// QR Scan & Open — Electron Main Process (v2.3.0)
// Features:
//   1. Global hotkey → capture screen → overlay drag-to-select → decode
//   2. In-app scan: paste from clipboard or drag-drop image → decode instantly
//   3. Auto-detect keyboard shortcut recorder in Settings
//   4. Main window with scan history, settings, manual trigger
//   5. System tray for background operation (app stays alive on all platforms)
//   6. All processing local — no data sent to any server
//   7. Overlay reuses mainWindow (no separate window created)
// ============================================================

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, Tray, Menu, nativeImage, shell, clipboard, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

let mainWindow = null;
let tray = null;
let isQuiting = false; // set true when we actually want to quit (so window-close hides don't block it)
let lastScreenshot = null; // NativeImage of the full screen capture
let isInOverlayMode = false;   // true while mainWindow is showing the scan overlay
let savedWindowState = null;    // saved bounds/state to restore after overlay

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
    show: true, // visible on launch so the user is never "windowless"
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    backgroundColor: "#f8fafc",
    transparent: true,        // allows switching to transparent overlay mode
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
  tray.setToolTip("QR Scan & Open");

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

function suspendShortcut() {
  shortcutSuspended = true;
  globalShortcut.unregisterAll();
}

function resumeShortcut() {
  shortcutSuspended = false;
  registerShortcut();
}

function registerShortcut() {
  // Don't actually register while the user is recording a new shortcut.
  if (shortcutSuspended) return;

  const settings = loadSettings();
  globalShortcut.unregisterAll();

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
        console.log("QR Scan: registered global shortcut:", accel);
        return;
      }
    } catch (err) {
      console.error("QR Scan: failed to register", accel, err);
    }
  }

  // Nothing registered — tell the user they can still use the tray / in-app button.
  showNotification(
    "QR Scan & Open",
    "Global shortcut unavailable. Use the tray icon or the 'Select Screen Area' button to scan."
  );
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

async function triggerScan() {
  try {
    const settings = loadSettings();

    // Extension-priority: if the user enabled it AND a browser is the foreground
    // app, let the browser extension handle the shortcut. This avoids a double
    // overlay and stops this app from stealing focus / minimizing the browser.
    if (settings.browserExtensionPriority && isForegroundAppBrowser()) {
      console.log("QR Scan: foreground is a browser — deferring to the browser extension.");
      return;
    }

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
      showNotification("QR Scan", "Could not capture the screen.");
      return;
    }

    // Use the first screen source (primary display)
    const source = sources[0];
    lastScreenshot = source.thumbnail;

    // On macOS the screen can be blank if Screen Recording permission is missing.
    if (lastScreenshot.isEmpty()) {
      showNotification(
        "Screen capture blocked",
        "Please grant Screen Recording permission in System Settings → Privacy & Security, then try again."
      );
      return;
    }

    // Save screenshot to a temp file for the overlay to load
    const tempPath = path.join(app.getPath("temp"), "qr-scan-screenshot.png");
    fs.writeFileSync(tempPath, lastScreenshot.toPNG());

    // Transform mainWindow into overlay mode (no new window created)
    enterOverlayMode(tempPath, { width, height, scaleFactor });
  } catch (err) {
    console.error("Scan error:", err);
    showNotification("QR Scan Error", err.message || "Scan failed");
  }
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

// Overlay decodes the QR locally and sends the decoded string (or null).
// The main process applies the side effects: open URL / copy text / history / notification.
ipcMain.handle("decoded", (event, data) => {
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
});

// ============================================================
// Notifications
// ============================================================

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, "icons", "icon128.png"),
    }).show();
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
