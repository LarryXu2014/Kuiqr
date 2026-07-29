// ============================================================
// QR Scan & Open — Electron Main Process (v2.0.0)
// Features:
//   1. Global hotkey Cmd/Ctrl+Shift+Y → capture screen → show overlay
//   2. Overlay drag-to-select → crop → decode QR → open URL / copy text
//   3. Main window with scan history, settings, and manual trigger
//   4. System tray for background operation
//   5. All processing local — no data sent to any server
// ============================================================

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, Tray, Menu, nativeImage, shell, clipboard, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

// jsQR is loaded in the renderer / overlay process, not here.

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let lastScreenshot = null; // NativeImage of the full screen capture

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

// ── Settings (stored in electron settings.json next to app) ──
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
const HISTORY_PATH = path.join(app.getPath("userData"), "history.json");

const DEFAULT_SETTINGS = {
  shortcut: isMac ? "CommandOrControl+Shift+Y" : "CommandOrControl+Shift+Y",
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
  createMainWindow();
  createTray();
  registerShortcut();

  // On macOS, hide dock icon (run in menu bar only) — optional
  // app.dock.hide();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, keep running in the menu bar
  if (isMac) {
    // Keep app alive in tray
  } else {
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
    show: false,
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

  mainWindow.once("ready-to-show", () => {
    // Don't show on launch — user activates via tray or shortcut
  });

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow.hide();
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
    { label: "Quit", click: () => { globalShortcut.unregisterAll(); app.exit(); } },
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
    // Capture the screen
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
    fullscreen: isMac,
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
    overlayWindow.setKiosk(isMac);
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

// ============================================================
// IPC Handlers
// ============================================================

// Overlay sends crop coordinates → main process decodes
ipcMain.handle("decode-crop", async (event, dataUrl) => {
  try {
    // Send to a hidden renderer for decoding (jsQR needs canvas)
    const result = await decodeInHiddenWindow(dataUrl);
    return result;
  } catch (err) {
    console.error("Decode error:", err);
    return { result: "error", message: err.message };
  }
});

// Overlay closed without selection
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

// ============================================================
// QR Decoding — uses a hidden BrowserWindow with jsQR + canvas
// Robust multi-strategy decoding for artistic/decorative QR codes
// ============================================================

let decodeWindow = null;

function ensureDecodeWindow() {
  return new Promise((resolve) => {
    if (decodeWindow && !decodeWindow.isDestroyed()) {
      resolve(decodeWindow);
      return;
    }

    decodeWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 400,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    decodeWindow.loadURL("data:text/html," + encodeURIComponent(`
      <html><body>
      <canvas id="canvas"></canvas>
      <script>
        require("${path.join(__dirname, "jsQR.js").replace(/\\/g, "\\\\")}");
      </script>
      <script>
        const { ipcRenderer } = require("electron");
        const canvas = document.getElementById("canvas");

        // Robust QR decode with multiple preprocessing strategies
        function robustDecode(img) {
          const origW = img.width;
          const origH = img.height;

          const baseSizes = [200, 400, 600, 800, 1000, 1200];
          const minDim = Math.min(origW, origH);
          const strategies = [];

          for (const targetSize of baseSizes) {
            if (targetSize < minDim) continue;
            const scale = Math.ceil(targetSize / minDim);
            strategies.push({ scale, threshold: 0, invert: false });
            strategies.push({ scale, threshold: 0, invert: true });
            for (const thresh of [80, 100, 120, 140, 160]) {
              strategies.push({ scale, threshold: thresh, invert: false });
              strategies.push({ scale, threshold: thresh, invert: true });
            }
          }
          strategies.push({ scale: 1, threshold: 0, invert: false });
          strategies.push({ scale: 1, threshold: 0, invert: true });

          for (const { scale, threshold, invert } of strategies) {
            let w = Math.round(origW * scale);
            let h = Math.round(origH * scale);
            if (w > 2000 || h > 2000) {
              const ratio = Math.min(2000 / w, 2000 / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, w, h);

            let imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;

            // Grayscale
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
              data[i] = gray; data[i+1] = gray; data[i+2] = gray;
            }

            // Contrast enhancement
            let minG = 255, maxG = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] < minG) minG = data[i];
              if (data[i] > maxG) maxG = data[i];
            }
            if (maxG > minG) {
              const range = maxG - minG;
              for (let i = 0; i < data.length; i += 4) {
                const v = ((data[i] - minG) / range) * 255;
                data[i] = v; data[i+1] = v; data[i+2] = v;
              }
            }

            // Invert
            if (invert) {
              for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i]; data[i+1] = 255 - data[i+1]; data[i+2] = 255 - data[i+2];
              }
            }

            // Binary threshold
            if (threshold > 0) {
              for (let i = 0; i < data.length; i += 4) {
                const v = data[i] >= threshold ? 255 : 0;
                data[i] = v; data[i+1] = v; data[i+2] = v;
              }
            }

            const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
            if (code && code.data) return code.data;
          }
          return null;
        }

        ipcRenderer.handle("decode", async (event, dataUrl) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const result = robustDecode(img);
              if (result) resolve({ result: "decoded", data: result });
              else resolve({ result: "none" });
            };
            img.onerror = () => resolve({ result: "error", message: "Image load failed" });
            img.src = dataUrl;
          });
        });
      </script>
      </body></html>
    `));

    decodeWindow.webContents.once("did-finish-load", () => {
      resolve(decodeWindow);
    });
  });
}

async function decodeInHiddenWindow(dataUrl) {
  const win = await ensureDecodeWindow();
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const result = robustDecode(img);
          if (result) resolve({ result: "decoded", data: result });
          else resolve({ result: "none" });
        };
        img.onerror = () => resolve({ result: "error", message: "Image load failed" });
        img.src = ${JSON.stringify(dataUrl)};
      });
    })()
  `);

  if (result.result === "decoded") {
    const data = result.data.trim();
    const isUrl = /^(https?:\/\/|www\.)/i.test(data);
    const settings = loadSettings();

    if (isUrl && settings.autoOpenUrl) {
      const targetUrl = data.startsWith("http") ? data : `https://${data}`;
      shell.openExternal(targetUrl);
    } else if (settings.copyTextToClipboard) {
      clipboard.writeText(data);
    }

    addToHistory(data, isUrl ? "url" : "text");

    if (settings.showNotification) {
      if (isUrl && settings.autoOpenUrl) {
        showNotification("QR Found — Opening URL", data.slice(0, 100));
      } else {
        showNotification("QR Found — Copied to Clipboard", data.slice(0, 100));
      }
    }

    return { result: isUrl ? "url" : "text", data };
  }

  if (result.result === "none") {
    addToHistory(null, "no-qr");
    if (settings.showNotification) {
      showNotification("No QR Found", "No QR code detected in the selected area.");
    }
  }

  return result;
}

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
// IPC: Update tray menu dynamically
// ============================================================

ipcMain.handle("get-platform", () => {
  return { isMac, isWin, platform: process.platform };
});
