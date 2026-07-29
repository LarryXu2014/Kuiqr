// ============================================================
// QR Scan & Open — Electron Main Process (v2.1.0)
// Features:
//   1. Global hotkey Cmd/Ctrl+Shift+Y → capture screen → show overlay
//   2. Overlay drag-to-select → crop → decode locally → open URL / copy text
//   3. Main window with scan history, settings, and manual trigger
//   4. System tray for background operation
//   5. All processing local — no data sent to any server
// ============================================================

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, Tray, Menu, nativeImage, shell, clipboard, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let lastScreenshot = null; // NativeImage of the full screen capture

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

app.whenReady().then(() => {
  createMainWindow(); // shows itself
  createTray();
  registerShortcut();

  app.on("activate", () => {
    // macOS: clicking the dock icon reveals the window
    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  // On macOS we keep running in the tray; elsewhere we quit.
  if (!isMac) {
    app.quit();
  }
});

app.on("before-quit", () => {
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
    icon: path.join(__dirname, "icons", "icon128.png"),
    webPreferences: {
      preload: path.join(__dirname, "renderer", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (e) => {
    // On macOS, closing the window just hides it (app stays in the tray).
    // On other platforms the window closes and the app quits via window-all-closed.
    if (isMac) {
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
    { label: "Quit", click: () => { globalShortcut.unregisterAll(); app.exit(0); } },
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

function registerShortcut() {
  const settings = loadSettings();
  globalShortcut.unregisterAll();

  try {
    globalShortcut.register(settings.shortcut, () => {
      triggerScan();
    });
  } catch (err) {
    console.error("Failed to register shortcut:", err);
  }
}

function reregisterShortcut() {
  registerShortcut();
}

// ============================================================
// Screen Capture + Overlay
// ============================================================

async function triggerScan() {
  try {
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

    // Show the overlay window
    createOverlayWindow(tempPath, { width, height, scaleFactor });
  } catch (err) {
    console.error("Scan error:", err);
    showNotification("QR Scan Error", err.message || "Scan failed");
  }
}

function createOverlayWindow(screenshotPath, displayInfo) {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }

  const { width, height } = displayInfo;

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "overlay-preload.js"),
    },
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"), {
    query: {
      screenshot: screenshotPath,
      width: String(width),
      height: String(height),
      scaleFactor: String(displayInfo.scaleFactor),
    },
  });

  overlayWindow.once("ready-to-show", () => {
    overlayWindow.show();
    overlayWindow.focus();
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

// ============================================================
// IPC Handlers
// ============================================================

// Overlay closed without a selection
ipcMain.handle("overlay-cancel", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
});

// Overlay finished — close it
ipcMain.handle("overlay-done", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
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
