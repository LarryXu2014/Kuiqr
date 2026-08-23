// Copyright 2026 LarryXu. Licensed under GPL-3.0.
// ============================================================
// Kuiqr — Electron Main Process (v2.4.2.1)
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

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, Tray, Menu, nativeImage, shell, clipboard, Notification, net } = require("electron");
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
let menuBarMode = false;        // true once the app has tucked itself into the menu bar (tray + hidden window)
let onboardingActive = false;   // true during first-launch onboarding (window shown, no tray yet)
let lastOverlayScreenshotPath = null; // temp screenshot for the Windows/Linux overlay (cleaned up after)

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

// App version — use Electron's app.getVersion(), which returns the npm `version`
// field (3-part semver, e.g. "2.4.1"). Used for display only.
const APP_VERSION = app.getVersion();

// Release version — the 4-part build version (e.g. "2.4.1.4") that matches the
// GitHub release tag and the extension zip filenames. We expose build.buildVersion
// to the packaged app via electron-builder's extraMetadata (see package.json),
// so this read works both in dev and in the built app.
// Fallback 4-part release version. MUST be kept in sync with the `buildVersion`
// in package.json (and the GitHub release tag) each time a new version ships.
// Only used if the packaged app can't read buildVersion from its package.json,
// so the About/Update UI never shows "undefined".
const FALLBACK_RELEASE_VERSION = "2.4.2.3.8";
const RELEASE_VERSION = (() => {
  try {
    const pkg = require("./package.json");
    return pkg.buildVersion || (pkg.build && pkg.build.buildVersion) || pkg.version || FALLBACK_RELEASE_VERSION;
  } catch {
    return FALLBACK_RELEASE_VERSION;
  }
})();

// ── macOS native Vision QR helper path ──
// In dev: native/qr-vision next to main.js. In the packaged app: extraResources
// copies it to Contents/Resources/native/qr-vision.
const VISION_HELPER_PATH = (() => {
  if (!isMac) return null;
  const devPath = path.join(__dirname, "native", "qr-vision");
  if (fs.existsSync(devPath)) return devPath;
  const packagedPath = path.join(process.resourcesPath, "native", "qr-vision");
  if (fs.existsSync(packagedPath)) return packagedPath;
  return null;
})();

// ── Settings (stored next to the app's userData) ──
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
const HISTORY_PATH = path.join(app.getPath("userData"), "history.json");

const DEFAULT_SETTINGS = {
  shortcut: "CommandOrControl+Shift+Y",
  autoOpenUrl: true,
  copyTextToClipboard: true,
  maxHistory: 50,
  launchAtLogin: false,
  browserExtensionPriority: false, // when true and a browser is the foreground app, let the browser extension handle the shortcut
  extensionPromptShown: false,     // whether the first-launch browser-extension download prompt has been shown
  extensionDownloaded: false,        // whether the user has downloaded the extension zip through the app
  tutorialShown: false,             // whether the first-launch guided tour has been shown
  showScanPopup: true,              // show a native OS notification after decoding a QR code
  language: "en",                   // UI language code (en, zh-CN, zh-TW, ja, ko, es, fr, de)
  lastUpdateNagVersion: "",         // last version we already nagged the user about updating to
  setupDone: false,                 // whether the first-launch setup wizard has been completed
};

function loadSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const stored = JSON.parse(data);

    // One-time migration: pre-2.4.1 settings didn't have a version field and may
    // carry an old browserExtensionPriority value from a previous install. Reset
    // it to OFF for those users; afterwards we respect whatever they choose.
    if (stored._version == null) {
      stored.browserExtensionPriority = false;
      stored._version = 1;
      saveSettings({ ...DEFAULT_SETTINGS, ...stored });
    }

    return { ...DEFAULT_SETTINGS, ...stored };
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

  app.whenReady().then(async () => {
    createMainWindow();

    // ── Decide the launch mode ──
    // First launch (the setup wizard has not been completed): keep the app as a
    // NORMAL foreground app — Dock icon visible, window shown, no menu-bar/tray
    // yet. The renderer drives the setup wizard (language → extension → guide →
    // done) and then calls "mark-setup-complete", at which point we clear the
    // onboarding guard so the FIRST window-close tucks the app into the menu bar.
    // Returning user (setupDone === true): go straight to menu-bar mode.
    let needsOnboarding = false;
    try {
      const s = loadSettings();
      // Run the wizard if it's never finished. The (extPrompt||tut) clause keeps
      // already-onboarded users (who predate the wizard) from being re-prompted.
      needsOnboarding = s.setupDone !== true && (s.extensionPromptShown !== true || s.tutorialShown !== true);
    } catch {
      needsOnboarding = true; // default to first-launch behavior on any error
    }

    if (needsOnboarding) {
      onboardingActive = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.once("ready-to-show", () => {
          mainWindow.show();
          mainWindow.focus();
        });
        // Fallback in case ready-to-show already fired before we attached.
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
          }
        }, 500);
      }
    } else {
      // Returning user → menu-bar mode, but briefly flash the window on launch so
      // the user always sees the app opened successfully. This is critical after
      // an update, because otherwise a hidden window + tiny tray icon can look
      // like the app "quit" even though the process is still running.
      enterMenuBarMode();
      if (mainWindow && !mainWindow.isDestroyed()) {
        let startupFlashCanceled = false;
        const cancelFlash = () => { startupFlashCanceled = true; };
        mainWindow.once("focus", cancelFlash);
        mainWindow.show();
        mainWindow.focus();
        setTimeout(() => {
          mainWindow.off("focus", cancelFlash);
          if (!startupFlashCanceled && menuBarMode && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
            mainWindow.hide();
          }
        }, 1500);
      }
    }

    await registerShortcut();

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
  stopForegroundMonitor();
  globalShortcut.unregisterAll();
});

// ============================================================
// Main Window
// ============================================================

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return; // already exists
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
    // When we're genuinely quitting (isQuiting === true), let the window actually
    // close so the app can exit.
    if (isQuiting) return;

    e.preventDefault();
    if (onboardingActive) {
      // During first-launch onboarding there is no tray yet — keep the window alive
      // so the user can finish the flow (re-show it if they closed it).
      if (mainWindow && !mainWindow.isVisible()) {
        try { mainWindow.show(); mainWindow.focus(); } catch { /* ignore */ }
      }
      return;
    }

    // The FIRST time the user closes the main window, tuck the app into the menu
    // bar (hide Dock, create tray icon). After that, closing just hides the window.
    if (!menuBarMode) {
      enterMenuBarMode();
    }

    // Hide to the tray instead of quitting, so the app + global shortcut keep
    // working after the window is closed.
    mainWindow.hide();
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
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
  if (tray) return true; // already created

  // Use a dedicated monochrome tray icon on macOS so it renders crisply as a
  // menu-bar template image. Windows keeps the colored 32 px icon.
  const candidates = isMac
    ? [
        path.join(__dirname, "icons", "icon-tray@2x.png"),
        path.join(__dirname, "icons", "icon-tray.png"),
        path.join(__dirname, "icons", "icon32.png"),
        path.join(__dirname, "icons", "icon16.png"),
      ]
    : [path.join(__dirname, "icons", "icon32.png")];
  let trayIcon = null;
  let usedPath = null;
  for (const p of candidates) {
    try {
      const ni = nativeImage.createFromPath(p);
      if (!ni.isEmpty()) {
        trayIcon = ni;
        usedPath = p;
        break;
      }
    } catch (err) {
      console.warn("Kuiqr: failed to load tray icon candidate", p, err);
    }
  }
  if (!trayIcon || trayIcon.isEmpty()) {
    console.error("Kuiqr: tray icon failed to load from any candidate", candidates);
    return false;
  }

  if (isMac) {
    // Retina-aware sizing: @2x sources are already 32 px for a 16 px logical item.
    if (!usedPath || !usedPath.includes("icon-tray@2x")) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
    trayIcon.setTemplateImage(true);
  }

  try {
    tray = new Tray(trayIcon);
  } catch (err) {
    console.error("Kuiqr: new Tray() threw:", err);
    return false;
  }
  if (!tray) {
    console.error("Kuiqr: new Tray() returned null/undefined");
    return false;
  }

  console.log("Kuiqr: tray created using", usedPath || "(unknown)");
  tray.setToolTip("Kuiqr");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Scan Screen", click: () => triggerScan() },
    { type: "separator" },
    { label: "Show Window", click: () => showMainWindow() },
    { label: "Settings", click: () => {
      showMainWindow();
      // Defer the tab switch until the window is actually shown and focused.
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send("switch-tab", "settings");
        }
      }, 50);
    }},
    { type: "separator" },
    { label: "Quit", click: () => { isQuiting = true; globalShortcut.unregisterAll(); app.quit(); } },
  ]);

  // On macOS, setContextMenu makes left-click pop the menu, which conflicts with
  // a toggle-on-click handler and feels broken. Show the menu on right-click only
  // and use left-click to show/hide the main window.
  tray.on("click", (event) => {
    try {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      const visible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
      if (visible) {
        mainWindow.hide();
      } else {
        showMainWindow();
      }
    } catch (err) {
      console.error("Kuiqr: tray click handler error:", err);
      // Last resort: try to show the window
      try { showMainWindow(); } catch { /* ignore */ }
    }
  });

  tray.on("right-click", (event) => {
    try {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      tray.popUpContextMenu(contextMenu);
    } catch (err) {
      console.error("Kuiqr: tray right-click handler error:", err);
    }
  });
}

// ============================================================
// Menu-bar (background) mode
// ============================================================

// Tucks the app into the menu bar: hide the Dock icon (macOS), create the tray
// icon, and hide the window. Called by the renderer once first-launch onboarding
// (extension prompt → tutorial) is complete, and at startup for returning users.
function enterMenuBarMode() {
  if (menuBarMode) return;
  menuBarMode = true;
  onboardingActive = false;

  // CRITICAL: create the tray icon BEFORE hiding the Dock/window. If tray
  // creation fails for any reason we must keep a visible UI (Dock + window)
  // so the app never appears to have "quit" or vanished after launch.
  const trayOk = createTray();

  // macOS: become a pure menu-bar (background) app — no Dock icon — only once
  // we know the tray is reachable. If the tray failed, the Dock stays so the
  // user still has a way to focus/quit the app.
  if (trayOk && isMac && app.dock && typeof app.dock.hide === "function") {
    try { app.dock.hide(); } catch { /* ignore */ }
  }

  // Tuck the window into the menu bar only if the tray is healthy.
  if (trayOk && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }

  // If tray creation failed, keep the window visible and focused.
  if (!trayOk && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }

  // Safety net: a few seconds after launch, if we somehow ended up in menu-bar
  // mode with a hidden window and no reachable tray, force the window back so
  // the user is never stranded with an invisible app.
  setTimeout(() => {
    try {
      if (menuBarMode && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        const trayBounds = tray && typeof tray.getBounds === "function" ? tray.getBounds() : null;
        if (!tray || !trayBounds || trayBounds.width === 0 || trayBounds.height === 0) {
          console.warn("Kuiqr: tray appears unreachable after launch, showing window as fallback");
          mainWindow.show();
          mainWindow.focus();
        }
      }
    } catch (e) {
      console.error("Kuiqr: menu-bar fallback timer error:", e);
    }
  }, 3500);
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

async function resumeShortcut() {
  shortcutSuspended = false;
  await registerShortcut();
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

async function registerShortcut() {
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
    const browser = await isForegroundAppBrowser();
    if (browser) {
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
  fgMonitorTimer = setInterval(syncShortcutToForegroundApp, 500);
  syncShortcutToForegroundApp();
}

function stopForegroundMonitor() {
  if (fgMonitorTimer) {
    clearInterval(fgMonitorTimer);
    fgMonitorTimer = null;
  }
}

async function syncShortcutToForegroundApp() {
  if (shortcutSuspended) return; // recording a new shortcut — leave unregistered
  // Always honour the LIVE setting. When browser-extension priority is OFF the app
  // must keep the global shortcut at all times — even while a browser is the
  // foreground app — so we never release it in that case. (Previously the monitor
  // released the shortcut for any browser regardless of this setting, which meant
  // turning the feature off still left the app unable to scan inside a browser.)
  const priority = !!loadSettings().browserExtensionPriority;
  if (!priority || !isMac) {
    if (!appShortcutActive) registerAppShortcut();
    return;
  }
  const browser = await isForegroundAppBrowser();
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

async function reregisterShortcut() {
  await registerShortcut();
}

// ============================================================
// Screen Capture + Overlay
// ============================================================

// Returns a Promise resolving to true if the currently focused application is a
// known web browser. Used so the browser extension can take priority over this
// app's global shortcut. Best-effort: fully implemented on macOS; on other
// platforms resolves to false (the app always scans).
// Uses async exec instead of execSync so the main thread never blocks.
function isForegroundAppBrowser() {
  return new Promise((resolve) => {
    if (!isMac) return resolve(false);
    exec(
      'osascript -e \'tell application "System Events" to get bundle identifier of (first process whose frontmost is true)\'',
      { timeout: 2000 },
      (err, stdout) => {
        if (err) return resolve(false);
        const bid = String(stdout).trim();
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
        resolve(BROWSERS.includes(bid));
      }
    );
  });
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
  // Running this fires an osascript that requires Automation access, which makes
  // macOS present its native permission prompt on first run. We ignore the result.
  isForegroundAppBrowser().catch(() => {});
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
ipcMain.handle("check-automation-permission", async () => {
  if (!isMac) return { granted: true }; // non-mac: irrelevant, hide the row
  try {
    await isForegroundAppBrowser(); // resolves false if permission was denied
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
    // Don't crash the app on scan errors — just notify.
    try {
      showNotification("Kuiqr Error", err.message || "Scan failed");
    } catch {
      // Notification itself failed; ignore.
    }
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

  // Validate the capture (also confirms Screen Recording permission is granted).
  const ni = nativeImage.createFromPath(tmpPath);
  if (ni.isEmpty()) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    showNotification(
      "Screen capture blocked",
      "Please grant Screen Recording permission in System Settings → Privacy & Security, then try again."
    );
    return;
  }

  // ── macOS fast path: native Vision QR detection ──
  // This is typically < 100 ms and handles the vast majority of clean QR codes
  // instantly. Only if Vision fails do we fall back to the renderer/jsQR path.
  if (VISION_HELPER_PATH) {
    try {
      const visionText = await runVisionHelper(tmpPath);
      if (visionText) {
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        applyDecodedResult(visionText);
        if (rendererReady && mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send("native-decoded", visionText);
        }
        return;
      }
    } catch (err) {
      console.error("Kuiqr: Vision helper failed:", err);
    }
  }

  // ── Fallback: decode in the hidden renderer with the robust jsQR pipeline ──
  // The app stays in the background — no window is shown.
  let buffer = null;
  try {
    buffer = fs.readFileSync(tmpPath);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  if (!buffer) return;

  if (rendererReady && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("decode-buffer", buffer);
  } else {
    // Renderer not ready yet — stash and flush once it signals ready.
    pendingDecodeBuffer = buffer;
  }
}

function runVisionHelper(imagePath) {
  return new Promise((resolve, reject) => {
    if (!VISION_HELPER_PATH) return resolve(null);
    let output = "";
    const child = spawn(VISION_HELPER_PATH, [imagePath]);
    child.stdout.on("data", (data) => { output += data.toString("utf8"); });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) return resolve(null);
      const text = output.trim();
      resolve(text || null);
    });
    // Vision should be near-instant; guard against hangs.
    setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      resolve(null);
    }, 2000);
  });
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
  lastOverlayScreenshotPath = tempPath;

  enterOverlayMode(tempPath, { width, height, scaleFactor });
}

// ============================================================
// Screen Overlay — reuses mainWindow (no separate window)
// ============================================================

function enterOverlayMode(screenshotPath, displayInfo) {
  if (!mainWindow || mainWindow.isDestroyed() || isInOverlayMode) return;
  isInOverlayMode = true;

  const { width, height } = displayInfo;

  // Save current window state so we can restore it after scanning
  savedWindowState = {
    bounds: mainWindow.getBounds(),
    resizable: mainWindow.isResizable(),
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
    wasVisible: mainWindow.isVisible(),
  };

  // Transform mainWindow into a fullscreen transparent overlay.
  // The window may be hidden (tray-only mode), so show + focus it first.
  mainWindow.show();
  mainWindow.focus();
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
  if (!isInOverlayMode || !mainWindow || mainWindow.isDestroyed()) return;
  isInOverlayMode = false;

  // Restore normal window appearance
  try {
    mainWindow.setAlwaysOnTop(savedWindowState ? savedWindowState.alwaysOnTop : false);
    mainWindow.setResizable(savedWindowState ? savedWindowState.resizable : true);
  } catch (e) { /* ignore */ }

  try {
    mainWindow.setBackgroundMaterial("none");
  } catch (e) { /* ignore */ }

  // Restore original bounds and reload the normal app UI
  if (savedWindowState && savedWindowState.bounds) {
    try { mainWindow.setBounds(savedWindowState.bounds); } catch { /* ignore */ }
  }
  const wasVisible = savedWindowState && savedWindowState.wasVisible;
  savedWindowState = null;

  // Reload main app UI
  try {
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  } catch { /* ignore */ }

  // Clean up the temp screenshot we wrote for the overlay scan.
  if (lastOverlayScreenshotPath) {
    try { fs.unlinkSync(lastOverlayScreenshotPath); } catch { /* ignore */ }
    lastOverlayScreenshotPath = null;
  }

  // If the window was hidden before the overlay scan, hide it again so the app
  // returns to the background after scanning.
  if (!wasVisible) {
    try {
      mainWindow.once("ready-to-show", () => mainWindow.hide());
      // Fallback: hide after a short delay if ready-to-show already fired
      setTimeout(() => { try { mainWindow.hide(); } catch {} }, 200);
    } catch { /* ignore */ }
  }
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
  // Merge with current stored settings so fields the renderer doesn't send
  // (e.g. extensionPromptShown, _version) are preserved.
  const current = loadSettings();
  const merged = { ...DEFAULT_SETTINGS, ...current, ...settings };
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

// Renderer requests: copy a generated QR code image (data URL) to the clipboard
ipcMain.handle("copy-qr-image", (event, dataUrl) => {
  try {
    const base64 = String(dataUrl).split(",")[1] || "";
    if (!base64) return { ok: false, reason: "Empty image data" };
    const buffer = Buffer.from(base64, "base64");
    const img = nativeImage.createFromBuffer(buffer);
    if (img.isEmpty()) {
      // Most likely a GIF (nativeImage can't decode GIF) — the renderer should have
      // already re-encoded to PNG; surface a clear error instead of a silent no-op.
      return { ok: false, reason: "Unsupported image format (expected PNG/JPEG)" };
    }
    clipboard.writeImage(img);
    return { ok: true };
  } catch (err) {
    console.error("Kuiqr: copy-qr-image failed:", err);
    return { ok: false, reason: err.message || String(err) };
  }
});

// Overlay / renderer decodes the QR locally and sends the decoded string (or null).
// The main process applies the side effects: open URL / copy text / history / notification.
ipcMain.handle("decoded", (event, data) => applyDecodedResult(data));

// ── On-screen scan notification ───────────────────────────────────────────────
// A REAL on-screen layer: a separate, always-on-top, transparent, borderless
// BrowserWindow that floats above everything (its own window, not a DOM element
// inside the app). It never intercepts mouse events, so it never blocks clicks.
let scanToastWindow = null;
let scanToastTimer = null;
let toastReady = false;
let pendingToast = null;

function createScanToastWindow() {
  if (scanToastWindow) return;
  scanToastWindow = new BrowserWindow({
    width: 360,
    height: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "renderer", "toast-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  scanToastWindow.loadFile(path.join(__dirname, "renderer", "toast.html"));
  // Never intercept clicks — this is a passive overlay layer.
  scanToastWindow.setIgnoreMouseEvents(true);
  // Stay visible even above full-screen apps.
  try {
    scanToastWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch { /* ignore */ }
  scanToastWindow.on("closed", () => {
    scanToastWindow = null;
    toastReady = false;
    pendingToast = null;
  });
  // The toast renderer registers its IPC listener during page load. Wait until the
  // page has actually finished loading before we send a payload, otherwise the
  // first notification would be delivered to a window with no listener yet.
  scanToastWindow.webContents.once("did-finish-load", () => {
    toastReady = true;
    if (pendingToast) {
      const p = pendingToast;
      pendingToast = null;
      showScanToastWindow(p.type, p.title, p.content, p.hint);
    }
  });
}

function showScanToastWindow(type, title, content, hint) {
  if (!scanToastWindow) createScanToastWindow();
  if (!scanToastWindow || scanToastWindow.isDestroyed()) return;

  const payload = {
    type: type || "success",
    title: title || "Kuiqr",
    content: content || "",
    hint: hint || "",
  };

  // Top-center of the primary display.
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const w = 360;
  scanToastWindow.setBounds({ x: Math.round((screenW - w) / 2), y: 20, width: w, height: 80 });

  // If the window is still loading its first paint, queue the payload and let the
  // did-finish-load handler replay it once the listener is live.
  if (!toastReady) {
    pendingToast = payload;
    return;
  }

  scanToastWindow.webContents.send("show-toast-window", payload);
  scanToastWindow.show();

  if (scanToastTimer) clearTimeout(scanToastTimer);
  scanToastTimer = setTimeout(() => {
    if (scanToastWindow && !scanToastWindow.isDestroyed()) scanToastWindow.hide();
  }, 4500);
}

// Sends a scan-feedback notification as a real on-screen layer (a separate
// always-on-top transparent window), not an in-app DOM overlay.
function sendScanToast(type, title, content, hint) {
  showScanToastWindow(type, title, content, hint);
}

// Renderer can request the same on-screen layer directly (e.g. copy/QR feedback).
ipcMain.on("show-screen-toast", (event, type, title, content, hint) => {
  showScanToastWindow(type, title, content, hint);
});

// Toast window reports its rendered height so we can size the window to fit.
ipcMain.on("toast-ready", (event, height) => {
  if (scanToastWindow && !scanToastWindow.isDestroyed() && typeof height === "number") {
    const b = scanToastWindow.getBounds();
    scanToastWindow.setBounds({ x: b.x, y: b.y, width: b.width, height });
  }
});

// Renderer → main: show the main window and switch to a given tab (used by the
// in-app right-click menu).
ipcMain.on("open-tab", (event, tab) => {
  showMainWindow();
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    setTimeout(() => mainWindow.webContents.send("switch-tab", tab), 50);
  }
});

// Renderer → main: fully quit the app (used by the in-app right-click menu).
ipcMain.on("quit-app", () => {
  isQuiting = true;
  try { globalShortcut.unregisterAll(); } catch { /* ignore */ }
  app.quit();
});

// Single source of truth for what happens after a QR code is decoded (or not):
// open the URL / copy the text / record history / notify. Used by BOTH the
// in-app scan path and the native macOS scan path.
// Feedback: success results are delivered as an IN-APP overlay notification
// (not a native OS notification). Controlled by the "Show scan notifications"
// setting (showScanPopup). For "no QR found" we stay silent to avoid spam.
function applyDecodedResult(data) {
  const settings = loadSettings();
  const usePopup = settings.showScanPopup !== false;

  if (!data) {
    // A real scan that came back empty (no QR in the captured area) — surface it
    // via the on-screen notification so failures are never silent.
    if (usePopup) {
      sendScanToast("no-qr", "No QR Code Found", "The captured area doesn't contain a readable QR code.");
    }
    return { result: "none" };
  }

  const text = String(data).trim();
  const isUrl = /^(https?:\/\/|www\.)/i.test(text);

  if (isUrl && settings.autoOpenUrl) {
    const targetUrl = text.startsWith("http") ? text : `https://${text}`;
    shell.openExternal(targetUrl);
    addToHistory(text, "url");
    // Deliver as a real on-screen overlay window (not a native OS notification).
    // Controlled by the "Show scan notifications" setting.
    if (usePopup) {
      sendScanToast("url", "QR Found — Opening URL", text.slice(0, 100));
    }
    return { result: "url", data: text };
  }

  if (settings.copyTextToClipboard) {
    clipboard.writeText(text);
  }
  addToHistory(text, "text");
  // On-screen overlay window notification.
  if (usePopup) {
    sendScanToast("text", "QR Found — Copied to Clipboard", text.slice(0, 100));
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

ipcMain.handle("resume-shortcut", async () => {
  await resumeShortcut();
  return true;
});

// Renderer requests: show a system notification
ipcMain.handle("show-notification", (event, title, body) => {
  showNotification(title, body);
});

// Renderer requests: the real app build version (4-part, e.g. "2.4.2.1")
ipcMain.handle("get-app-version", () => RELEASE_VERSION);

// ============================================================
// IPC: First-launch browser-extension download prompt
// ============================================================

ipcMain.handle("should-show-extension-prompt", () => {
  const settings = loadSettings();
  return { show: settings.extensionPromptShown !== true };
});

ipcMain.handle("mark-extension-prompt-shown", () => {
  const settings = loadSettings();
  settings.extensionPromptShown = true;
  saveSettings(settings);
  return { ok: true };
});

// ============================================================
// IPC: First-launch guided tour
// ============================================================

ipcMain.handle("should-show-tutorial", () => {
  const settings = loadSettings();
  return { show: settings.tutorialShown !== true };
});

ipcMain.handle("mark-tutorial-shown", () => {
  const settings = loadSettings();
  settings.tutorialShown = true;
  saveSettings(settings);
  return { ok: true };
});

// Renderer calls this once first-launch onboarding (extension prompt → tutorial)
// is finished and the app should remain a normal foreground app. This clears the
// onboarding guard so the FIRST window-close handler below will tuck the app into
// the menu bar, instead of re-showing the window.
ipcMain.handle("mark-onboarding-complete", () => {
  onboardingActive = false;
  return { ok: true };
});

// Renderer calls this when the first-launch setup wizard is finished (or skipped).
// Marks everything as seen so the wizard never re-appears, and clears the
// onboarding guard so the FIRST window-close tucks the app into the menu bar.
ipcMain.handle("mark-setup-complete", () => {
  try {
    const settings = loadSettings();
    settings.setupDone = true;
    settings.extensionPromptShown = true;
    settings.tutorialShown = true;
    saveSettings(settings);
    onboardingActive = false;

    // Create the tray icon immediately after setup so the user can reach Kuiqr
    // from the menu bar. Keep the window visible and focused so the app does
    // NOT appear to quit after finishing the wizard.
    createTray();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    return { ok: true };
  } catch (err) {
    console.error("Kuiqr: mark-setup-complete failed:", err);
    return { ok: false, reason: err.message || String(err) };
  }
});

// Renderer calls this when first-launch onboarding is finished: tuck the app into
// the menu bar (hide Dock, create tray, hide window).
ipcMain.handle("enter-menu-bar-mode", () => {
  enterMenuBarMode();
  return { ok: true };
});

// Downloads the appropriate extension zip to the user's Downloads folder.
// browserType is "chrome" or "firefox". Returns { ok, path? }.
// Tries the release matching this app version first; if that isn't published
// yet (e.g. pre-release testing), falls back to the latest published release.
// Downloads the appropriate extension zip to the user's Downloads folder.
// browserType is "chrome" or "firefox" (chrome covers Chrome/Edge/Brave).
// Returns { ok, path? }.
//
// Strategy:
//   1. Try the release that matches this exact app version (works as soon as
//      this version is published — the asset is named kuiqr-extension-<ver>.zip).
//   2. If that 404s (this build isn't released yet, or an older app version),
//      resolve the REAL asset URL from the latest GitHub release via the API
//      and download that. The published asset is versioned, so a bare
//      "kuiqr-extension.zip" would 404 — we must read the actual name.
ipcMain.handle("download-extension", async (event, browserType) => {
  const settings = loadSettings();
  try {
    const version = RELEASE_VERSION;
    const baseName = browserType === "firefox" ? "kuiqr-firefox" : "kuiqr-extension";
    const filename = `${baseName}-${version}.zip`;
    const versionedUrl = `https://github.com/LarryXu2014/Kuiqr/releases/download/v${version}/${filename}`;
    const destPath = path.join(app.getPath("downloads"), filename);

    async function tryFetch(url, acceptJson = false) {
      const headers = acceptJson ? { Accept: "application/vnd.github+json" } : {};
      try {
        return await net.fetch(url, { headers });
      } catch (netErr) {
        console.warn("Kuiqr: net.fetch failed, falling back to native fetch:", netErr.message || netErr);
        return acceptJson ? fetch(url, { headers }) : fetch(url);
      }
    }

    // Resolve the real download URL from the latest published release.
    async function resolveLatestUrl() {
      try {
        const meta = await tryFetch("https://api.github.com/repos/LarryXu2014/Kuiqr/releases/latest", true);
        if (!meta.ok) return null;
        const rel = await meta.json();
        const assets = rel.assets || [];
        // Prefer an asset whose name starts with our baseName (handles versioned
        // names like kuiqr-extension-2.4.1.7.zip) and fall back to a plain name.
        const asset =
          assets.find((a) => a.name.startsWith(baseName) && a.name.endsWith(".zip")) ||
          assets.find((a) => a.name === `${baseName}.zip`);
        return asset ? asset.browser_download_url : null;
      } catch (apiErr) {
        console.warn("Kuiqr: latest-release lookup failed:", apiErr.message || apiErr);
        return null;
      }
    }

    let response = await tryFetch(versionedUrl);

    // Fallback: this exact version isn't published yet (or version skew) —
    // grab the matching asset from the latest release instead.
    if (!response.ok && (response.status === 404 || response.status === 403)) {
      console.log("Kuiqr: versioned extension zip not found, resolving from latest release");
      const latestUrl = await resolveLatestUrl();
      if (latestUrl) response = await tryFetch(latestUrl);
    }

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    settings.extensionDownloaded = true;
    saveSettings(settings);

    return { ok: true, path: destPath, filename };
  } catch (err) {
    console.error("Kuiqr: extension download failed:", err);
    return { ok: false, reason: err.message || String(err) };
  }
});

// ============================================================
// IPC: In-app update check + download
// ============================================================

// Compare dotted versions (e.g. "2.4.2.1"). Returns >0 if a is newer than b.
function compareVersions(a, b) {
  const pa = String(a || "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// Pick the release asset name that matches THIS platform/arch.
// Asset names follow electron-builder artifactName patterns in package.json:
//   macOS : Kuiqr-<ver>-mac-<arch>.{dmg,zip}   (arch: x64 | arm64)
//   Win   : Kuiqr-<ver>-windows-x64-setup.exe / -portable.exe
//   Linux : Kuiqr-<ver>-linux-x86_64.AppImage / .deb  (x64 → x86_64 / amd64)
//           Kuiqr-<ver>-linux-arm64.AppImage  / .deb  (arm64)
function pickUpdateAsset(version, assets) {
  const platform = process.platform;
  const arch = process.arch; // "x64" | "arm64"
  const candidates = [];

  if (platform === "darwin") {
    const a = arch === "arm64" ? "arm64" : "x64";
    candidates.push(`Kuiqr-${version}-mac-${a}.dmg`, `Kuiqr-${version}-mac-${a}.zip`);
  } else if (platform === "win32") {
    // Prefer the NSIS setup installer, fall back to the portable exe.
    candidates.push(
      `Kuiqr-${version}-windows-x64-setup.exe`,
      `Kuiqr-${version}-windows-x64-portable.exe`
    );
  } else if (platform === "linux") {
    if (arch === "arm64") {
      candidates.push(`Kuiqr-${version}-linux-arm64.AppImage`, `Kuiqr-${version}-linux-arm64.deb`);
    } else {
      candidates.push(
        `Kuiqr-${version}-linux-x86_64.AppImage`,
        `Kuiqr-${version}-linux-amd64.deb`
      );
    }
  }

  for (const name of candidates) {
    const asset = assets.find((a) => a.name === name);
    if (asset) return asset;
  }
  return null;
}

// Shared fetch with a hard timeout. A slow/stalling GitHub connection (common
// from some networks) would otherwise hang the in-app update check for minutes;
// aborting after a few seconds lets the UI fail fast and stay responsive.
async function netFetchWithTimeout(url, { headers = {}, method = "GET" } = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    try {
      return await net.fetch(url, { method, headers, signal: controller.signal });
    } catch (netErr) {
      console.warn("Kuiqr: net.fetch failed, falling back to native fetch:", netErr.message || netErr);
      return await fetch(url, { method, headers, signal: controller.signal });
    }
  } finally {
    clearTimeout(timer);
  }
}

// Avoid hitting the network on every check: cache the latest result for a short
// window, and dedupe concurrent calls so the startup silent check + a manual
// button press don't both spin up a request.
let _updateCache = { ts: 0, data: null };
const UPDATE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
let _updateInFlight = null;

async function performUpdateCheck() {
  if (_updateInFlight) return _updateInFlight; // dedupe concurrent callers
  _updateInFlight = (async () => {
    const currentVersion = RELEASE_VERSION;
    try {
      const headers = { Accept: "application/vnd.github+json" };
      const meta = await netFetchWithTimeout(
        "https://api.github.com/repos/LarryXu2014/Kuiqr/releases/latest",
        { headers },
        8000
      );
      if (!meta.ok) {
        return { ok: false, reason: `GitHub API returned HTTP ${meta.status}`, currentVersion };
      }
      const rel = await meta.json();
      const latestVersion = String(rel.tag_name || "").replace(/^v/i, "");
      if (!latestVersion) {
        return { ok: false, reason: "No version tag in latest release", currentVersion };
      }

      const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
      const assets = rel.assets || [];
      const asset = updateAvailable ? pickUpdateAsset(latestVersion, assets) : null;
      const assetUrl = asset ? asset.browser_download_url : null;

      const result = {
        ok: true,
        updateAvailable,
        currentVersion,
        latestVersion,
        latest: latestVersion, // renderer expects this alias
        releaseUrl: rel.html_url || `https://github.com/LarryXu2014/Kuiqr/releases/tag/v${latestVersion}`,
        assetUrl,
        assetName: asset ? asset.name : null,
        notes: rel.body || "",
      };
      _updateCache = { ts: Date.now(), data: result };
      return result;
    } catch (err) {
      console.error("Kuiqr: update check failed:", err);
      const reason =
        err && err.name === "AbortError"
          ? "Update check timed out — check your connection"
          : err.message || String(err);
      return { ok: false, reason, currentVersion };
    }
  })();
  try {
    return await _updateInFlight;
  } finally {
    _updateInFlight = null;
  }
}

// Fetches the latest GitHub release and reports whether a newer version exists.
// Returns { ok, updateAvailable, currentVersion, latestVersion, releaseUrl,
//           assetUrl, assetName, notes }.
ipcMain.handle("check-for-updates", async (event, { force = false } = {}) => {
  if (!force && _updateCache.data && Date.now() - _updateCache.ts < UPDATE_CACHE_TTL) {
    return _updateCache.data; // serve instantly from cache
  }
  return performUpdateCheck();
});

// Quick online/offline probe: try to reach a reliable endpoint with a short
// timeout. Used so the startup update check stays silent when there is no
// internet instead of flashing an error.
ipcMain.handle("check-internet", async () => {
  const endpoints = [
    "https://www.google.com/generate_204",
    "https://www.apple.com/library/test/success.html",
    "https://detectportal.firefox.com/canonical.html",
  ];
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const response = await net.fetch(url, { method: "HEAD", signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || response.status === 204) return { online: true };
    } catch { /* try next */ }
  }
  return { online: false };
});

// Restart the app (used after a language change so the new locale takes effect).
ipcMain.handle("restart-app", () => {
  app.relaunch();
  app.quit();
  return { ok: true };
});

// Downloads the chosen update asset into the user's Downloads folder and opens
// it (mounts a .dmg on macOS, runs the .exe on Windows, opens the AppImage on
// Linux). Returns { ok, path? }.
ipcMain.handle("download-update", async (event, url) => {
  if (!url || typeof url !== "string") {
    return { ok: false, reason: "No download URL provided" };
  }
  try {
    const filename = decodeURIComponent(url.split("?")[0].split("/").pop()) || "Kuiqr-update";
    const destPath = path.join(app.getPath("downloads"), filename);

    let response;
    try {
      response = await net.fetch(url);
    } catch (netErr) {
      console.warn("Kuiqr: net.fetch failed, falling back to native fetch:", netErr.message || netErr);
      response = await fetch(url);
    }
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    // Open the downloaded installer so the user can finish the update.
    shell.openPath(destPath).catch(() => {});

    return { ok: true, path: destPath };
  } catch (err) {
    console.error("Kuiqr: update download failed:", err);
    return { ok: false, reason: err.message || String(err) };
  }
});

// Downloads the latest update asset and installs it in-app (no GitHub visit
// required). On macOS we mount the .dmg, copy Kuiqr.app into /Applications,
// then relaunch the new build and quit the old one. For .pkg/.zip (and
// Windows/Linux) we open the installer and let the user finish.
// Returns { ok, relaunch?, reason?, fallbackOpened? }.
ipcMain.handle("install-update", async (event, { url, assetName, latest } = {}) => {
  if (!url || typeof url !== "string") {
    return { ok: false, reason: "No download URL provided" };
  }

  function sendProgress(info) {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send("update-progress", info);
      }
    } catch { /* ignore */ }
  }

  function formatBytes(n) {
    if (n === undefined || n === null || Number.isNaN(n)) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  try {
    const filename = decodeURIComponent(url.split("?")[0].split("/").pop()) || "Kuiqr-update";
    const destPath = path.join(app.getPath("downloads"), filename);

    let response;
    try {
      response = await net.fetch(url);
    } catch (netErr) {
      console.warn("Kuiqr: net.fetch failed, falling back to native fetch:", netErr.message || netErr);
      response = await fetch(url);
    }
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);

    const total = parseInt(response.headers.get("content-length") || "0", 10) || 0;
    const chunks = [];
    let downloaded = 0;

    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        downloaded += value.length;
        const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        sendProgress({ percent: pct, downloaded: formatBytes(downloaded), total: formatBytes(total), filename, done: false });
      }
      fs.writeFileSync(destPath, Buffer.concat(chunks));
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      downloaded = buffer.length;
      fs.writeFileSync(destPath, buffer);
    }

    sendProgress({ percent: 100, downloaded: formatBytes(downloaded), total: formatBytes(total || downloaded), filename, done: true });
    sendProgress({ phase: "installing" });

    if (isMac) {
      const isDmg = /\.dmg$/i.test(destPath);
      if (isDmg) {
        try {
          const mountOut = execSync(`hdiutil attach -nobrowse -noautoopen "${destPath}"`).toString();
          const m = mountOut.match(/\/Volumes\/[^\n]+/);
          const mountPoint = m ? m[0].trim() : null;
          if (!mountPoint) throw new Error("Could not mount the update disk image");
          const appPath = path.join(mountPoint, "Kuiqr.app");
          if (!fs.existsSync(appPath)) throw new Error("Kuiqr.app was not found inside the update disk image");
          // Replace the installed copy (rm then cp, so we overwrite cleanly).
          try { execSync(`rm -rf "/Applications/Kuiqr.app"`); } catch { /* ignore */ }
          execSync(`cp -R "${appPath}" "/Applications/Kuiqr.app"`);
          // Detach the disk image (best-effort; don't fail the update if this errors).
          try { execSync(`hdiutil detach "${mountPoint}" -force`); } catch { /* ignore */ }
          // Relaunch the freshly installed copy, then quit this (old) process.
          const newExe = "/Applications/Kuiqr.app/Contents/MacOS/Kuiqr";
          setTimeout(() => {
            try { app.relaunch({ execPath: newExe }); } catch { app.relaunch(); }
            app.quit();
          }, 800);
          return { ok: true, relaunch: true };
        } catch (e) {
          // Auto-install failed — open the disk image so the user can drag the
          // app into Applications manually.
          console.error("Kuiqr: auto update failed:", e);
          try { shell.openPath(destPath); } catch { /* ignore */ }
          return { ok: false, reason: "auto-install-failed", fallbackOpened: true };
        }
      }
      // .pkg / .zip → open the installer and let the user finish.
      try { shell.openPath(destPath); } catch { /* ignore */ }
      return { ok: false, reason: "manual-install", fallbackOpened: true };
    }

    // Windows / Linux: open the downloaded installer.
    shell.openPath(destPath).catch(() => {});
    return { ok: false, reason: "manual-install", fallbackOpened: true };
  } catch (err) {
    console.error("Kuiqr: install-update failed:", err);
    return { ok: false, reason: err.message || String(err) };
  }
});
