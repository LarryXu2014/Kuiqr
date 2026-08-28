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

const { app, BrowserWindow, globalShortcut, screen, desktopCapturer, ipcMain, Tray, Menu, nativeImage, shell, clipboard, Notification, net, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync, spawn, exec } = require("child_process");
const crypto = require("crypto");

// jsQR runs in the main process so the region-watch loop can decode captured
// frames directly (no round-trip to the renderer).
const jsQR = require("./jsQR.js");

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
let lastActiveTab = "scan";     // last tab the renderer was on, so overlay scans restore the right page

// Tray icon state (macOS): normal = white QR template; update-available = blue QR.
let trayIconWhite = null;       // solid QR motif, used as a template (renders white)
let trayIconBlue = null;        // same motif in blue, used as a real-color image when an update is available
let trayUpdateState = false;    // false = normal (white), true = update available (blue)

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

// Release version — the 4-part build version (e.g. "2.4.2.3.10") that matches the
// GitHub release tag and the extension zip filenames. In the PACKAGED app,
// electron-builder strips `build.buildVersion` out of package.json, so we must fall
// back to the hard-coded FALLBACK_RELEASE_VERSION (kept in sync with package.json
// build.buildVersion and the GitHub tag each release) BEFORE the npm `version` field.
// The npm `version` is only the 3-part semver ("2.4.1") and would otherwise make every
// built app report as 2.4.1 and always think it is outdated.
const FALLBACK_RELEASE_VERSION = "2.4.2.3.10";
const RELEASE_VERSION = (() => {
  try {
    const pkg = require("./package.json");
    return pkg.buildVersion || (pkg.build && pkg.build.buildVersion) || FALLBACK_RELEASE_VERSION || pkg.version;
  } catch {
    return FALLBACK_RELEASE_VERSION;
  }
})();

// App version for display — use the REAL 4-part release version so the UI shows the
// exact build the user is running (e.g. "2.4.2.3.10"), not the npm 3-part semver.
const APP_VERSION = RELEASE_VERSION;

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
  dynamicBackendUrl: "",             // base URL of the Kuiqr dynamic-QR redirect/analytics backend
  dynamicApiKey: "",                // API key for that backend (POST /api/codes, GET .../stats)
  accentColor: "",                   // UI accent color (hex, e.g. "#2563eb"); empty = default indigo
  qrStyle: null,                    // persisted QR styling defaults (fg/bg/ecc/dotStyle/finder colors/quiet/logo omitted)
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

// ── Wi-Fi network scan (used by the WiFi QR template's SSID picker) ──
// Returns [{ ssid, signal (0-100 or null) }]. Best-effort per platform.
// macOS: modern versions redact nearby SSIDs without Location permission, so we
// merge the *connected* network (networksetup, always visible) with any unredacted
// entries from system_profiler. Windows (netsh) and Linux (nmcli) list everything.
function scanWifiNetworks() {
  return new Promise((resolve, reject) => {
    if (process.platform === "darwin") {
      // Find the actual Wi-Fi interface (usually en0, but not always), then query
      // it plus system_profiler in parallel and merge.
      runCmd("networksetup", ["-listallhardwareports"]).then((ports) => {
        const m = ports.match(/Hardware Port: Wi-Fi\s*\nDevice: (\w+)/);
        const iface = m ? m[1] : "en0";
        const jobs = [runCmd("networksetup", ["-getairportnetwork", iface]), runCmd("/usr/sbin/system_profiler", ["SPAirPortDataType"])];
        Promise.all(jobs.map((p) => p.catch(() => ""))).then(([cur, prof]) => {
          try {
            const networks = parseWifiScan(cur + "\n" + prof, "darwin");
            if (!networks.length) reject(new Error("no-networks"));
            else resolve(networks);
          } catch (e) { reject(e); }
        });
      }, () => reject(new Error("networksetup failed")));
      return;
    }
    let cmd, args;
    if (process.platform === "win32") {
      cmd = "netsh"; args = ["wlan", "show", "networks", "mode=bssid"];
    } else {
      cmd = "nmcli"; args = ["-f", "SSID,SIGNAL", "dev", "wifi", "list"];
    }
    runCmd(cmd, args).then((out) => {
      try {
        const networks = parseWifiScan(out, process.platform);
        if (!networks.length) reject(new Error("no-networks"));
        else resolve(networks);
      } catch (e) { reject(e); }
    }, reject);
  });
}
function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", () => resolve(out));
  });
}
function parseWifiScan(out, platform) {
  const seen = new Set();
  const result = [];
  const push = (ssid, signal) => {
    ssid = String(ssid || "").trim();
    // Skip empty, redacted (macOS privacy) and placeholder entries.
    if (!ssid || /^<.*redacted.*>$/i.test(ssid) || ssid === "--") return;
    if (seen.has(ssid)) return;
    seen.add(ssid);
    result.push({ ssid, signal: signal == null ? null : signal });
  };
  if (platform === "darwin") {
    // networksetup: "Current Wi-Fi Network: MyNet" (or "You are not associated…")
    const cur = out.match(/Current Wi-Fi Network:\s*(.+?)\s*$/m);
    if (cur) push(cur[1], null);
    // system_profiler: lines like "          SSID: MyNet" (may be redacted → skipped)
    const ssidRe = /^[ \t]+SSID:\s*(.+?)\s*$/gm;
    let m;
    while ((m = ssidRe.exec(out))) push(m[1], null);
  } else if (platform === "win32") {
    const re = /SSID\s+\d+\s*:\s*(.+?)\r?\n/gm;
    let m;
    while ((m = re.exec(out))) push(m[1], null);
  } else {
    // nmcli: lines "  <SSID>  <SIGNAL>" — skip header.
    const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const sigMatch = line.match(/^(.*?)\s+(\d+)$/);
      if (!sigMatch) continue;
      const signal = parseInt(sigMatch[2], 10);
      push(sigMatch[1], isNaN(signal) ? null : signal);
    }
  }
  return result;
}

// ── Rich QR actions (WiFi join, vCard→Contacts, event→Calendar, geo→Maps) ──
// The scanner shouldn't just copy a WIFI:/vCard payload to the clipboard like
// it's plain text — the iPhone camera joins the network and opens the contact.
// These helpers give Kuiqr the same superpowers, per platform.

// Run a shell command and return { code, stdout, stderr }. Never throws.
function runShell(cmd, args) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { windowsHide: true });
      let out = "", err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => resolve({ code: -1, stdout: out, stderr: String((e && e.message) || e) }));
      child.on("close", (code) => resolve({ code: code == null ? -1 : code, stdout: out, stderr: err }));
    } catch (e) {
      resolve({ code: -1, stdout: "", stderr: String((e && e.message) || e) });
    }
  });
}

// Write text to a temp file and return its absolute path (or null).
function writeTempFile(name, content) {
  try {
    const p = path.join(app.getPath("temp"), name);
    fs.writeFileSync(p, content, "utf-8");
    return p;
  } catch { return null; }
}

// Join a Wi-Fi network from a scanned WIFI: QR payload.
//   macOS:   networksetup -setairportnetwork <iface> <ssid> <pass>
//   Windows: create a WLAN profile XML from the payload, then `netsh wlan add
//            profile` + `netsh wlan connect`
//   Linux:   nmcli dev wifi connect <ssid> password <pass>
// Returns { ok, reason? } — reason is a stable i18n-able code, not prose.
async function joinWifiNetwork({ ssid, password, security }) {
  if (!ssid) return { ok: false, reason: "missing-ssid" };
  if (process.platform === "darwin") {
    const ports = await runShell("networksetup", ["-listallhardwareports"]);
    const m = /Hardware Port: Wi-Fi\s*\nDevice: (\w+)/.exec(ports.stdout);
    const iface = m ? m[1] : "en0";
    const args = password
      ? ["-setairportnetwork", iface, ssid, password]
      : ["-setairportnetwork", iface, ssid];
    const res = await runShell("networksetup", args);
    if (res.code !== 0) return { ok: false, reason: "join-failed" };
    // networksetup exits 0 even when the join fails — verify we actually associated.
    const check = await runShell("networksetup", ["-getairportnetwork", iface]);
    const cur = /Current Wi-Fi Network:\s*(.+?)\s*$/m.exec(check.stdout);
    if (cur && cur[1] === ssid) return { ok: true };
    return { ok: false, reason: "join-failed" };
  }
  if (process.platform === "win32") {
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const auth = security === "nopass"
      ? "<authentication>open</authentication>"
      : security === "WEP"
        ? "<authentication>open</authentication><encryption>WEP</encryption><useSecurity>true</useSecurity>"
        : "<authentication>WPA2PSK</authentication><encryption>AES</encryption><useSecurity>true</useSecurity>";
    const hex = Buffer.from(ssid, "utf8").toString("hex").toUpperCase();
    const xml =
      `<?xml version="1.0"?>\n<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">\n` +
      `<name>${esc(ssid)}</name>\n<SSIDConfig><SSID><hex>${hex}</hex><name>${esc(ssid)}</name></SSID></SSIDConfig>\n` +
      `<connectionType>ESS</connectionType><connectionMode>manual</connectionMode>\n` +
      `<MSM><security><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${esc(password || "")}</keyMaterial></sharedKey>${auth}</security></MSM>\n` +
      `</WLANProfile>`;
    const xmlPath = writeTempFile("kuiqr-wifi-profile.xml", xml);
    if (!xmlPath) return { ok: false, reason: "temp-failed" };
    const add = await runShell("netsh", ["wlan", "add", "profile", `filename=${xmlPath}`, "user=all"]);
    try { fs.unlinkSync(xmlPath); } catch { /* best effort */ }
    if (add.code !== 0) return { ok: false, reason: "join-failed" };
    const conn = await runShell("netsh", ["wlan", "connect", `name=${ssid}`]);
    if (conn.code !== 0) return { ok: false, reason: "join-failed" };
    return { ok: true };
  }
  // Linux
  const args = password
    ? ["dev", "wifi", "connect", ssid, "password", password]
    : ["dev", "wifi", "connect", ssid];
  const res = await runShell("nmcli", args);
  return res.code === 0 ? { ok: true } : { ok: false, reason: "join-failed" };
}

// Normalize a scanned calendar payload (VCALENDAR-wrapped or legacy bare
// VEVENT, any line endings) into a valid RFC 5545 .ics body:
//   - CRLF line endings (spec requirement; Calendar.app rejects LF-only files)
//   - a VCALENDAR envelope with VERSION + PRODID
//   - UID + DTSTAMP inside the VEVENT (Calendar.app refuses imports without them)
function normalizeIcs(content) {
  const raw = String(content || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return "";
  // Strip any existing envelope — it is rebuilt below so wrapped and bare
  // scanned payloads end up identical.
  const lines = raw
    .replace(/^BEGIN:VCALENDAR[ \t]*$/im, "")
    .replace(/^END:VCALENDAR[ \t]*$/im, "")
    .split("\n").map((l) => l.replace(/[ \t]+$/, ""));
  const out = ["BEGIN:VCALENDAR"];
  let hasVersion = false, hasProdid = false;
  for (const l of lines) {
    if (/^VERSION:/i.test(l)) { hasVersion = true; out.push(l); }
    else if (/^PRODID:/i.test(l)) { hasProdid = true; out.push(l); }
  }
  if (!hasVersion) out.push("VERSION:2.0");
  if (!hasProdid) out.push("PRODID:-//Kuiqr//EN");
  const extras = [];
  if (!lines.some((l) => /^UID:/i.test(l))) {
    extras.push("UID:kuiqr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "@kuiqr");
  }
  if (!lines.some((l) => /^DTSTAMP:/i.test(l))) {
    const d = new Date();
    const p = (n) => (n < 10 ? "0" : "") + n;
    extras.push("DTSTAMP:" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
      "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z");
  }
  let inserted = false;
  for (const l of lines) {
    if (/^(VERSION|PRODID):/i.test(l)) continue; // already hoisted above
    out.push(l);
    if (!inserted && /^BEGIN:VEVENT[ \t]*$/i.test(l)) {
      out.push(...extras); inserted = true;
    }
  }
  if (!inserted && extras.length) out.push(...extras); // no VEVENT — still emit valid props
  out.push("END:VCALENDAR");
  return out.filter((l) => l !== "").join("\r\n") + "\r\n";
}

// Open a contact/event file with the OS default handler:
//   macOS: Contacts.app / Calendar.app (default for .vcf/.ics via `open`)
//   Windows: People / Outlook / default .vcf/.ics app via `start`
//   Linux: xdg-open (GNOME Contacts / Evolution etc.)
function openContactOrEvent(kind, content) {
  let body = String(content || "");
  if (kind === "event") {
    body = normalizeIcs(body);
    if (!body) return { ok: false, reason: "empty" };
  }
  const ext = kind === "vcard" ? ".vcf" : ".ics";
  const p = writeTempFile("kuiqr-scan-" + Date.now() + ext, body);
  if (!p) return { ok: false, reason: "temp-failed" };
  if (process.platform === "win32") {
    // `start ""` because the first quoted arg of cmd's start is the window title.
    exec(`start "" "${p.replace(/"/g, '""')}"`);
    return { ok: true };
  }
  // macOS: `open` hands .vcf to Contacts, .ics to Calendar — exactly the
  // iPhone-camera behavior. Linux: xdg-open does the equivalent.
  shell.openPath(p);
  return { ok: true };
}

// Show a geo: location in the platform maps app / default browser.
function openGeoLocation(lat, lon) {
  const q = `${lat},${lon}`;
  let url;
  if (process.platform === "darwin") url = `https://maps.apple.com/?q=${q}`;
  else url = `https://www.google.com/maps?q=${q}`;
  shell.openExternal(url);
  return { ok: true };
}

ipcMain.handle("join-wifi", async (event, payload) => joinWifiNetwork(payload || {}));
ipcMain.handle("open-contact-event", (event, { kind, content }) => openContactOrEvent(kind, content));
ipcMain.handle("open-geo", (event, { lat, lon }) => openGeoLocation(lat, lon));


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

    // Hide the default Electron menu bar on Windows/Linux — the app UI is
    // self-contained and the File/Edit/View/Window/Help menu makes it look like
    // a Mac app. macOS keeps its expected app menu.
    if (!isMac) {
      try { Menu.setApplicationMenu(null); } catch { /* ignore */ }
    }

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
  stopLocalBackend();
  stopRegionWatch();
  stopForegroundMonitor();
  globalShortcut.unregisterAll();
});

// Auto-restart the local analytics backend at launch when the user has one
// configured as a LAN/localhost address (i.e. they used "Run local backend").
// Without this, every app restart silently killed tracking: phone scans would
// hit a dead URL and never be counted. Hosted (non-LAN) backends are untouched.
setTimeout(() => {
  try {
    const s = loadSettings();
    let host = "";
    try { host = new URL(s.dynamicBackendUrl || "").hostname; } catch { host = ""; }
    const isLocalish = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) ||
      /^((10|192)\.\d{1,3}\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (s.dynamicBackendUrl && isLocalish) {
      startLocalBackend({ silent: true }).catch(() => {});
    }
  } catch { /* best effort */ }
}, 8000);

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

  wireWatchFocus();

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
    trayIconWhite = trayIcon;

    // Colored variant for the "update available" state. It must NOT be a template
    // image, otherwise macOS strips the color and shows it as white/black.
    try {
      const bluePath = (usedPath && usedPath.includes("@2x"))
        ? path.join(__dirname, "icons", "icon-tray-blue@2x.png")
        : path.join(__dirname, "icons", "icon-tray-blue.png");
      let bi = nativeImage.createFromPath(bluePath);
      if (!bi.isEmpty()) {
        const sz = trayIcon.getSize();
        bi = bi.resize({ width: sz.width, height: sz.height });
        bi.setTemplateImage(false);
        trayIconBlue = bi;
      }
    } catch (e) {
      console.warn("Kuiqr: failed to load blue tray icon:", e);
    }
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
    { label: "Region Watch…", click: () => { if (regionWatch.active) stopRegionWatch(); else openWatchOverlay(); } },
    { label: "Stop Region Watch", click: () => stopRegionWatch() },
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

  // Apply whatever update state we already know about (e.g. an update was
  // detected before the tray existed). Defaults to the normal white icon.
  setTrayUpdateAvailable(trayUpdateState);
}

// Swaps the menu-bar icon between the normal (white QR template) and the
// "update available" (blue QR) state. No-op on non-macOS or before tray exists.
function setTrayUpdateAvailable(isAvail) {
  trayUpdateState = !!isAvail;
  if (!tray || !isMac) return;
  try {
    if (trayUpdateState && trayIconBlue) {
      tray.setImage(trayIconBlue);
      tray.setToolTip("Kuiqr — update available");
    } else if (trayIconWhite) {
      tray.setImage(trayIconWhite);
      trayIconWhite.setTemplateImage(true);
      tray.setToolTip("Kuiqr");
    }
  } catch (err) {
    console.error("Kuiqr: setTrayUpdateAvailable failed:", err);
  }
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
  // Ignore repeated hotkey presses while a scan is already in progress.
  if (isInOverlayMode) {
    console.log("Kuiqr: scan already in progress, ignoring hotkey");
    return;
  }

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
  // Capture the display where the user's cursor currently is. This works
  // correctly on multi-monitor setups and matches macOS behaviour where the
  // crosshair appears wherever the user is looking.
  const cursor = screen.getCursorScreenPoint();
  const targetDisplay = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = targetDisplay.bounds;
  const scaleFactor = targetDisplay.scaleFactor;

  // Very large native thumbnails can come back empty on high-DPI Windows
  // screens. Cap the requested size to a sane maximum while preserving aspect
  // ratio. The overlay still fills the screen because CSS stretches the image.
  const MAX_CAPTURE = 2560;
  let reqW = Math.round(width * scaleFactor);
  let reqH = Math.round(height * scaleFactor);
  if (reqW > MAX_CAPTURE || reqH > MAX_CAPTURE) {
    const ratio = Math.min(MAX_CAPTURE / reqW, MAX_CAPTURE / reqH);
    reqW = Math.round(reqW * ratio);
    reqH = Math.round(reqH * ratio);
  }

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: reqW, height: reqH },
  });

  if (!sources || sources.length === 0) {
    showNotification("Kuiqr", "Could not capture the screen.");
    return;
  }

  // Try to pick the source matching the target display; fall back to primary.
  let source = sources[0];
  const targetId = String(targetDisplay.id);
  for (const s of sources) {
    if (String(s.display_id) === targetId || String(s.id) === targetId) {
      source = s;
      break;
    }
  }
  lastScreenshot = source.thumbnail;

  // If the chosen thumbnail is empty, try any other screen source as a fallback.
  if (lastScreenshot.isEmpty()) {
    for (const s of sources) {
      if (s.thumbnail && !s.thumbnail.isEmpty()) {
        lastScreenshot = s.thumbnail;
        source = s;
        break;
      }
    }
  }

  if (lastScreenshot.isEmpty()) {
    showNotification(
      "Screen capture blocked",
      "Please grant screen capture permission in Settings and try again."
    );
    return;
  }

  const tempPath = path.join(app.getPath("temp"), `qr-scan-screenshot-${Date.now()}.png`);
  fs.writeFileSync(tempPath, lastScreenshot.toPNG());
  lastOverlayScreenshotPath = tempPath;

  enterOverlayMode(tempPath, { x, y, width, height, scaleFactor });
}

// ============================================================
// Screen Overlay — reuses mainWindow (no separate window)
// ============================================================

function enterOverlayMode(screenshotPath, displayInfo) {
  if (!mainWindow || mainWindow.isDestroyed() || isInOverlayMode) return;
  isInOverlayMode = true;

  const { x, y, width, height } = displayInfo;

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
  mainWindow.setBounds({ x, y, width, height });
  // Keep the background material off so the screenshot is shown crisply rather
  // than blurred by the DWM acrylic effect.
  try {
    mainWindow.setBackgroundMaterial("none");
  } catch (e) { /* ignore */ }

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

  // Restore whichever tab the user was on before the scan, instead of always
  // landing back on the default Scan tab after index.html reloads.
  if (lastActiveTab && lastActiveTab !== "scan" && mainWindow && mainWindow.webContents) {
    try {
      mainWindow.webContents.once("did-finish-load", () => {
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
            mainWindow.webContents.send("switch-tab", lastActiveTab);
          }
        }, 80);
      });
    } catch { /* ignore */ }
  }

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
ipcMain.handle("decoded", (event, data, opts) => applyDecodedResult(data, opts));

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

// Renderer → main: track the currently active tab so that after a Windows
// overlay scan we can return to the user's previous page instead of Scan.
ipcMain.on("tab-changed", (event, tab) => {
  if (typeof tab === "string" && tab) { lastActiveTab = tab; currentTab = tab; updateWatchPause(); }
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
function applyDecodedResult(data, opts) {
  const settings = loadSettings();
  const usePopup = settings.showScanPopup !== false;
  const noAutoOpen = !!(opts && opts.noAutoOpen);

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

  // The renderer recognized this URL as one of the user's OWN trackable short
  // links: never auto-open it — copy it like text content and let the result UI
  // (destination + View stats) explain what it is.
  if (isUrl && noAutoOpen) {
    if (settings.copyTextToClipboard) {
      clipboard.writeText(text);
    }
    addToHistory(text, "url");
    if (usePopup) {
      sendScanToast("url", "Trackable QR — Link Copied", text.slice(0, 100));
    }
    return { result: "url", data: text, trackable: true };
  }

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

// ============================================================
// IPC: file dialogs + write (QR exports, batch generation)
// ============================================================
ipcMain.handle("show-save-dialog", (event, opts) => {
  if (!dialog) return null;
  const res = dialog.showSaveDialogSync(mainWindow, opts || {});
  return res || null;
});
ipcMain.handle("show-open-dialog", (event, opts) => {
  if (!dialog) return { filePaths: [] };
  const res = dialog.showOpenDialogSync(mainWindow, opts || {});
  return { filePaths: res || [] };
});
ipcMain.handle("write-file", (event, { path: p, dataUrl, text }) => {
  try {
    if (text != null) {
      fs.writeFileSync(p, text, "utf-8");
    } else if (dataUrl) {
      const base64 = String(dataUrl).split(",")[1] || "";
      fs.writeFileSync(p, Buffer.from(base64, "base64"));
    } else {
      return { ok: false, reason: "No content provided" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || String(err) };
  }
});
ipcMain.handle("get-qr-style", () => {
  try { return { ok: true, style: loadSettings().qrStyle || null }; }
  catch (err) { return { ok: false, reason: err.message || String(err) }; }
});
ipcMain.handle("set-qr-style", (event, style) => {
  try {
    const s = loadSettings();
    s.qrStyle = style || null;
    saveSettings(s);
    return { ok: true };
  } catch (err) { return { ok: false, reason: err.message || String(err) }; }
});
ipcMain.handle("scan-wifi", async () => {
  try {
    const list = await scanWifiNetworks();
    return { ok: true, networks: list };
  } catch (err) {
    return { ok: false, reason: err.message || String(err), networks: [] };
  }
});
ipcMain.handle("zip-folder", (event, { folder, outName }) => {
  try {
    const out = path.join(folder, outName || "archive.zip");
    if (isWin) {
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${folder}/*' -DestinationPath '${out}' -Force"`, { stdio: "ignore" });
    } else {
      execSync(`zip -r -q '${out}' .`, { cwd: folder, stdio: "ignore" });
    }
    return { ok: true, path: out };
  } catch (err) {
    return { ok: false, reason: err.message || String(err) };
  }
});

// ============================================================
// Region Watch mode (Step 5)
//   User drags a rectangle (transparent overlay) → main captures that screen
//   region every N ms, decodes it, and fires the normal scan actions on a NEW
//   payload. Pause/resume from tray; auto-pause while Settings is focused.
// ============================================================
let watchOverlayWindow = null;
let currentTab = "scan";
const regionWatch = {
  active: false, paused: false, rect: null, displayId: null,
  intervalMs: 500, timer: null, lastPayload: null, lastFire: 0,
  lastActivity: 0, lastSeenAt: 0,
};

function broadcastWatchStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const s = regionWatch.active
    ? { running: true, paused: regionWatch.paused, lastCode: regionWatch.lastPayload, lastActivity: regionWatch.lastActivity, lastSeenAt: regionWatch.lastSeenAt }
    : null;
  mainWindow.webContents.send("region-watch-status", s);
}
function updateWatchPause() {
  if (!regionWatch.active) return;
  const focused = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
  regionWatch.paused = focused && currentTab === "settings";
  broadcastWatchStatus();
}
function openWatchOverlay() {
  if (watchOverlayWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const winOpts = {
    x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height,
    transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, hasShadow: false, backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "watch-preload.js"), contextIsolation: true, nodeIntegration: false },
  };
  // On macOS a panel-style window can float above fullscreen apps and reliably
  // receives the first mouse click without the user having to click twice.
  if (process.platform === "darwin") {
    winOpts.type = "panel";
    winOpts.acceptFirstMouse = true;
  }
  watchOverlayWindow = new BrowserWindow(winOpts);
  watchOverlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  watchOverlayWindow.loadFile(path.join(__dirname, "watch-overlay.html"), {
    query: { displayId: String(display.id), x: String(display.bounds.x), y: String(display.bounds.y) },
  });
  watchOverlayWindow.on("closed", () => { watchOverlayWindow = null; });
}
function stopRegionWatch() {
  regionWatch.active = false;
  regionWatch.paused = false;
  regionWatch.rect = null;
  if (regionWatch.timer) { clearInterval(regionWatch.timer); regionWatch.timer = null; }
  if (watchOverlayWindow && !watchOverlayWindow.isDestroyed()) { try { watchOverlayWindow.close(); } catch { /* ignore */ } }
  watchOverlayWindow = null;
  broadcastWatchStatus();
}
function startWatchLoop() {
  if (regionWatch.timer) clearInterval(regionWatch.timer);
  regionWatch.timer = setInterval(() => {
    regionWatchTick().catch((e) => { console.error("[region-watch] tick error:", e); });
  }, regionWatch.intervalMs);
  broadcastWatchStatus();
}
async function regionWatchTick() {
  if (!regionWatch.active || regionWatch.paused || !regionWatch.rect) return;
  const { x, y, w, h, displayId } = regionWatch.rect;
  let display;
  try { display = screen.getDisplayById(parseInt(displayId, 10)); } catch { display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); }
  if (!display) return;
  const sf = display.scaleFactor;
  const MAX = 2560;
  let reqW = Math.round(display.bounds.width * sf), reqH = Math.round(display.bounds.height * sf);
  if (reqW > MAX || reqH > MAX) { const r = Math.min(MAX / reqW, MAX / reqH); reqW = Math.round(reqW * r); reqH = Math.round(reqH * r); }
  let sources;
  try { sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: reqW, height: reqH } }); }
  catch (e) { console.error("[region-watch] capture failed:", e); return; }
  if (!sources || !sources.length) { console.warn("[region-watch] no screen sources"); return; }
  let src = sources[0];
  const tid = String(display.id);
  for (const s of sources) { if (String(s.display_id) === tid || String(s.id) === tid) { src = s; break; } }
  const thumb = src.thumbnail;
  if (!thumb || thumb.isEmpty()) { console.warn("[region-watch] empty thumbnail"); return; }
  // The captured thumbnail is the full screen at `thumbnailSize`, which may be
  // downscaled (capped at MAX px). Map the CSS-px rect onto the *actual* thumbnail
  // resolution so we crop the correct region on Retina / high-DPI displays.
  const size = thumb.getSize();
  const physW = display.bounds.width * sf;
  const thumbScale = size.width / (physW || size.width);
  const cx = Math.round(x * sf * thumbScale);
  const cy = Math.round(y * sf * thumbScale);
  const cw = Math.max(1, Math.round(w * sf * thumbScale));
  const ch = Math.max(1, Math.round(h * sf * thumbScale));
  const cropped = thumb.crop({ x: cx, y: cy, width: cw, height: ch });
  if (cropped.isEmpty()) { console.warn("[region-watch] empty crop", { cx, cy, cw, ch, size }); return; }
  const csize = cropped.getSize();
  regionWatch.lastActivity = Date.now();
  let res = null;
  try {
    // Electron's nativeImage.getBitmap() is BGRA; jsQR expects RGBA. Convert to
    // a grayscale RGBA buffer so channel order and color QR codes don't matter.
    const bgra = cropped.getBitmap();
    const rgba = new Uint8ClampedArray(csize.width * csize.height * 4);
    for (let i = 0, j = 0; i < bgra.length; i += 4, j += 4) {
      const b = bgra[i], g = bgra[i + 1], r = bgra[i + 2];
      const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      rgba[j] = luma; rgba[j + 1] = luma; rgba[j + 2] = luma; rgba[j + 3] = 255;
    }
    res = jsQR(rgba, csize.width, csize.height);
  } catch (e) { console.error("[region-watch] decode error:", e); return; }
  if (res && res.data && res.data.trim()) {
    const payload = res.data.trim();
    regionWatch.lastSeenAt = Date.now();
    const now = Date.now();
    // Only fire the actions on a NEW payload (debounced) — but keep the "last scan"
    // timestamp fresh so the UI shows the code is currently visible.
    if (payload !== regionWatch.lastPayload && now - regionWatch.lastFire >= 600) {
      regionWatch.lastPayload = payload;
      regionWatch.lastFire = now;
      try { showNotification("Kuiqr — QR detected", payload.slice(0, 120)); } catch { /* ignore */ }
      applyDecodedResult(payload);
    }
  }
  broadcastWatchStatus();
}
ipcMain.handle("region-watch-rect", (event, rect) => {
  regionWatch.rect = rect;
  regionWatch.displayId = rect.displayId;
  regionWatch.lastPayload = null;
  regionWatch.active = true;
  regionWatch.paused = false;
  if (watchOverlayWindow && !watchOverlayWindow.isDestroyed()) { try { watchOverlayWindow.close(); } catch { /* ignore */ } }
  watchOverlayWindow = null;
  startWatchLoop();
  return { ok: true };
});
ipcMain.handle("region-watch-cancel", () => {
  if (watchOverlayWindow && !watchOverlayWindow.isDestroyed()) { try { watchOverlayWindow.close(); } catch { /* ignore */ } }
  watchOverlayWindow = null;
  return { ok: true };
});
ipcMain.handle("region-watch-start", () => { openWatchOverlay(); return { ok: true }; });
ipcMain.handle("region-watch-stop", () => { stopRegionWatch(); return { ok: true }; });

// ── Local (self-hosted) analytics backend ──
// Lets a user run the bundled `dynamic-backend` on their own machine with one
// click — no purchase, no external service. We spawn `npm start` in that folder,
// wait for its /health endpoint, and return the URL + API key to the renderer,
// which then fills Settings automatically.

// The LAN IPv4 address of this machine (e.g. 192.168.1.42), or null.
// Used so the local backend's short links are scannable from PHONES on the same
// Wi-Fi — a short link pointing at "localhost:3000" only works on the desktop
// itself, so any phone scan would silently never reach the backend (and never
// be counted).
function getLanIp() {
  try {
    // Route a UDP "connection" to a public IP — no packets actually leave the
    // machine; the OS just picks the default-route interface's local address.
    const s = require("dgram").createSocket("udp4");
    s.connect(1, "8.8.8.8");
    const ip = s.address() && s.address().address;
    try { s.close(); } catch { /* ignore */ }
    if (ip && !ip.startsWith("127.") && !ip.includes(":")) return ip;
  } catch { /* fall through */ }
  try {
    // Fallback: first non-internal IPv4 from the OS interface list.
    const os = require("os");
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const it of ifaces[name] || []) {
        if (it.family === "IPv4" && !it.internal) return it.address;
      }
    }
  } catch { /* ignore */ }
  return null;
}

let localBackendProc = null;
let localBackendInfo = null;
// The local backend's API key is persisted in <backend>/data/.local-api-key so
// restarts (incl. the automatic one at app launch) reuse the SAME key — a new
// random key every relaunch would silently invalidate the saved settings.
function localBackendKeyPath(backendDir) {
  return path.join(backendDir, "data", ".local-api-key");
}

// Re-read the local backend's key file and update settings.dynamicApiKey if it
// has changed. This heals the common "unauthorized" case where the backend was
// restarted with a fresh key (or the settings were copied from another install).
function resyncLocalBackendKey() {
  const backendDir = path.join(__dirname, "..", "dynamic-backend");
  const p = localBackendKeyPath(backendDir);
  try {
    const fresh = fs.readFileSync(p, "utf-8").trim();
    if (/^[0-9a-f]{16,}$/i.test(fresh)) {
      const s = loadSettings();
      if (s.dynamicApiKey !== fresh) {
        s.dynamicApiKey = fresh;
        saveSettings(s);
        return fresh;
      }
    }
  } catch { /* best effort */ }
  return null;
}
function loadOrCreateLocalKey(backendDir) {
  const p = localBackendKeyPath(backendDir);
  try {
    const existing = fs.readFileSync(p, "utf-8").trim();
    if (/^[0-9a-f]{16,}$/i.test(existing)) return existing;
  } catch { /* not there yet */ }
  const key = crypto.randomBytes(24).toString("hex");
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, key, "utf-8"); } catch { /* best effort */ }
  return key;
}
async function startLocalBackend({ silent = false } = {}) {
  if (localBackendProc && !localBackendProc.killed) {
    return { ok: true, url: localBackendInfo && localBackendInfo.url, apiKey: localBackendInfo && localBackendInfo.apiKey, lanIp: localBackendInfo && localBackendInfo.lanIp, alreadyRunning: true };
  }
  const backendDir = path.join(__dirname, "..", "dynamic-backend");
  if (!fs.existsSync(path.join(backendDir, "server.js"))) return { ok: false, reason: "backend-not-found" };
  if (!fs.existsSync(path.join(backendDir, "node_modules", "fastify"))) return { ok: false, reason: "backend-not-installed" };
  const apiKey = loadOrCreateLocalKey(backendDir);
  // Short links must be reachable from PHONES (that's the whole point of a
  // trackable QR) — use this machine's LAN IP, not localhost. The server itself
  // binds 0.0.0.0 (see dynamic-backend/src/config.js HOST default).
  const lanIp = getLanIp();
  const url = lanIp ? `http://${lanIp}:3000` : "http://localhost:3000";
  const env = Object.assign({}, process.env, {
    PORT: "3000", BASE_URL: url, API_KEY: apiKey,
    DB_PATH: path.join(backendDir, "data", "qr.db"),
  });
  try {
    localBackendProc = spawn("npm", ["start"], { cwd: backendDir, env, detached: true, stdio: "ignore" });
    localBackendProc.unref();
  } catch (e) {
    return { ok: false, reason: "spawn-failed:" + String((e && e.message) || e) };
  }
  // Poll /health until the server is ready (or time out).
  const deadline = Date.now() + 15000;
  let healthy = false;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(url + "/health", { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { healthy = true; break; }
    } catch { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  if (!healthy) {
    try { if (localBackendProc && !localBackendProc.killed) process.kill(-localBackendProc.pid, "SIGTERM"); } catch { /* ignore */ }
    localBackendProc = null;
    return { ok: false, reason: "health-timeout" };
  }
  localBackendInfo = { url, apiKey, lanIp };
  // Silent (auto-restart) mode keeps settings in sync directly from main: if the
  // LAN IP changed since the last run, the stored backend URL must follow —
  // phone scans would otherwise hit a dead address and never be counted.
  if (silent) {
    try {
      const s = loadSettings();
      let host = "";
      try { host = new URL(s.dynamicBackendUrl || "").hostname; } catch { host = ""; }
      const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host);
      const hostIsThisMachine = !!(lanIp && host === lanIp);
      const hostIsPrivateLan = /^((10|192)\.\d{1,3}\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
      if (!s.dynamicBackendUrl || isLocalHost || hostIsThisMachine || hostIsPrivateLan) {
        s.dynamicBackendUrl = url;
        s.dynamicApiKey = apiKey;
        saveSettings(s);
      }
    } catch { /* best effort */ }
  }
  return { ok: true, url, apiKey, lanIp };
}
function stopLocalBackend() {
  if (localBackendProc && !localBackendProc.killed) {
    try { process.kill(-localBackendProc.pid, "SIGTERM"); } catch { /* ignore */ }
  }
  localBackendProc = null;
  localBackendInfo = null;
  return { ok: true };
}
ipcMain.handle("start-local-backend", async () => startLocalBackend());
ipcMain.handle("stop-local-backend", () => stopLocalBackend());

// Auto-pause the watch loop while the Settings window is focused.
function wireWatchFocus() {
  if (!mainWindow) return;
  mainWindow.on("focus", updateWatchPause);
  mainWindow.on("blur", updateWatchPause);
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

      // Reflect the update state in the menu-bar icon (white → blue when available).
      setTrayUpdateAvailable(updateAvailable);

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

// ── Dynamic QR (Kuiqr redirect + analytics backend) ──
// The renderer proxies through the main process so the API key stays server-side
// (it is stored in settings and never handed to the renderer). Config lives in
// Settings: dynamicBackendUrl + dynamicApiKey.
async function callDynamicApi(apiPath, { method = "GET", body } = {}) {
  const settings = loadSettings();
  const base = (settings.dynamicBackendUrl || "").replace(/\/+$/, "");
  let key = settings.dynamicApiKey || "";
  if (!base) return { ok: false, reason: "backend-not-configured" };

  const tryOnce = async () => {
    const headers = { "Content-Type": "application/json" };
    if (key) headers["x-api-key"] = key;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await net.fetch(`${base}${apiPath}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { ok: res.ok, status: res.status, data, reason: (data && data.error) || `http-${res.status}` };
    } catch (e) {
      return { ok: false, reason: "network", error: String((e && e.message) || e) };
    }
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await tryOnce();
    if (r.ok) return { ok: true, data: r.data };
    // 401 usually means the backend key changed under us (new backend process,
    // settings copied from another install, etc.). Re-read the local key file
    // once and retry.
    if (r.status === 401 && attempt === 0) {
      const fresh = resyncLocalBackendKey();
      if (fresh) { key = fresh; continue; }
    }
    return { ok: false, status: r.status, reason: r.reason || r.error || "request-failed", data: r.data };
  }
}

ipcMain.handle("dynamic-create", async (event, { destination, note, expiresAt } = {}) => {
  if (!destination) return { ok: false, reason: "destination-required" };
  return callDynamicApi("/api/codes", { method: "POST", body: { destination, note, expiresAt } });
});

ipcMain.handle("dynamic-stats", async (event, { code } = {}) => {
  if (!code) return { ok: false, reason: "code-required" };
  return callDynamicApi(`/api/codes/${encodeURIComponent(code)}/stats`);
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
