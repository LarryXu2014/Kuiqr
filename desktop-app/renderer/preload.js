// Copyright 2026 LarryXu. Licensed under GPL-3.0.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qrAPI", {
  // Scan
  triggerScan: () => ipcRenderer.invoke("trigger-scan"),
  readClipboardImage: () => ipcRenderer.invoke("read-clipboard-image"),
  onDecoded: (text, opts) => ipcRenderer.invoke("decoded", text, opts),

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  testShortcut: (accel) => ipcRenderer.invoke("test-shortcut", accel),
  suspendShortcut: () => ipcRenderer.invoke("suspend-shortcut"),
  resumeShortcut: () => ipcRenderer.invoke("resume-shortcut"),

  // History
  getHistory: () => ipcRenderer.invoke("get-history"),
  clearHistory: () => ipcRenderer.invoke("clear-history"),

  // Actions
  openUrl: (url) => ipcRenderer.invoke("open-url", url),
  copyClipboard: (text) => ipcRenderer.invoke("copy-clipboard", text),

  // Platform
  getPlatform: () => ipcRenderer.invoke("get-platform"),

  // macOS: open System Settings → Privacy & Security → Automation
  openAutomationSettings: () => ipcRenderer.invoke("open-automation-settings"),

  // macOS: check if Automation permission is already granted (to hide the settings row)
  checkAutomationPermission: () => ipcRenderer.invoke("check-automation-permission"),

  // Tab switching from tray/main process
  onSwitchTab: (callback) => ipcRenderer.on("switch-tab", (e, tab) => callback(tab)),

  // Tell the main process the active tab changed (so overlay scans restore it).
  notifyTabChanged: (tab) => ipcRenderer.send("tab-changed", tab),

  // Hidden decode worker (macOS native scan path): main sends the captured PNG,
  // the renderer decodes it and reports the result back.
  onDecodeBuffer: (callback) => ipcRenderer.on("decode-buffer", (e, buffer) => callback(buffer)),

  // macOS Vision fast path succeeded: main already applied side effects (open URL,
  // copy text, history); renderer just needs to show feedback + refresh UI.
  onNativeDecoded: (callback) => ipcRenderer.on("native-decoded", (e, text) => callback(text)),

  // Tell the main process this renderer is ready to receive decode jobs.
  markRendererReady: () => ipcRenderer.send("renderer-ready"),

  // Show a system notification (kept for non-scan feedback; scan results use
  // the in-app overlay below).
  showNotification: (title, body) => ipcRenderer.invoke("show-notification", title, body),

  // In-app scan feedback overlay (legacy; main now uses a real on-screen window)
  onShowScanToast: (callback) => ipcRenderer.on("show-scan-toast", (e, type, title, content, hint) => callback(type, title, content, hint)),

  // ── On-screen scan notification window (a real always-on-top overlay) ──
  // Lets the renderer raise the same on-screen layer as the main process.
  showScreenToast: (type, title, content, hint) => ipcRenderer.send("show-screen-toast", type, title, content, hint),

  // Show the main window and switch to a tab (in-app right-click menu).
  openTab: (tab) => ipcRenderer.invoke("open-tab", tab),

  // Fully quit the app (in-app right-click menu).
  quitApp: () => ipcRenderer.invoke("quit-app"),

  // Copy a generated QR code image (data URL) to the system clipboard
  copyQrImage: (dataUrl) => ipcRenderer.invoke("copy-qr-image", dataUrl),

  // Real app build version (4-part, e.g. "2.4.2.1"), for the About section
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // First-launch browser-extension download prompt
  shouldShowExtensionPrompt: () => ipcRenderer.invoke("should-show-extension-prompt"),
  markExtensionPromptShown: () => ipcRenderer.invoke("mark-extension-prompt-shown"),
  downloadExtension: (browserType) => ipcRenderer.invoke("download-extension", browserType),

  // In-app update check + download + install
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: (url) => ipcRenderer.invoke("download-update", url),
  installUpdate: (url, assetName, latest) => ipcRenderer.invoke("install-update", { url, assetName, latest }),
  onUpdateProgress: (callback) => ipcRenderer.on("update-progress", (e, info) => callback(info)),

  // Internet connectivity probe
  checkInternet: () => ipcRenderer.invoke("check-internet"),

  // Dynamic QR: create a trackable short code on the configured backend, and
  // fetch scan analytics. The API key is held by the main process and never
  // exposed to the renderer.
  createDynamicCode: (payload) => ipcRenderer.invoke("dynamic-create", payload),
  getDynamicStats: (payload) => ipcRenderer.invoke("dynamic-stats", payload),
  lookupDynamicCode: (payload) => ipcRenderer.invoke("dynamic-lookup", payload),

  // ── QR export / file I/O (Steps 3 & 4) ──
  // Open the OS save dialog; resolves to the chosen path string or null.
  showSaveDialog: (opts) => ipcRenderer.invoke("show-save-dialog", opts),
  // Open the OS open dialog (e.g. pick an output folder); resolves to { filePaths }.
  showOpenDialog: (opts) => ipcRenderer.invoke("show-open-dialog", opts),
  // Write a file. Pass either { path, dataUrl } (base64) or { path, text } (utf-8).
  writeFile: (payload) => ipcRenderer.invoke("write-file", payload),
  // Zip a folder into <folder>/<outName> via the system archiver.
  zipFolder: (payload) => ipcRenderer.invoke("zip-folder", payload),

  // ── Region watch mode (Step 5) ──
  // Ask the main process to open the region-selection overlay and start watching.
  openRegionWatch: () => ipcRenderer.invoke("region-watch-start"),
  // Stop the active region watch loop.
  stopRegionWatch: () => ipcRenderer.invoke("region-watch-stop"),
  // Main → renderer status updates (running / paused / last code).
  onRegionWatchStatus: (callback) => ipcRenderer.on("region-watch-status", (e, s) => callback(s)),

  // Self-hosted analytics backend (one-click local run).
  startLocalBackend: () => ipcRenderer.invoke("start-local-backend"),
  stopLocalBackend: () => ipcRenderer.invoke("stop-local-backend"),

  // ── Persisted QR styling defaults (sync main-process settings) ──
  // Get the saved styling object or null.
  getQrStyle: () => ipcRenderer.invoke("get-qr-style"),
  // Save styling defaults (fg/bg/ecc/dotStyle/finder/quiet — logo not persisted).
  setQrStyle: (style) => ipcRenderer.invoke("set-qr-style", style),

  // ── Wi-Fi scan (nearby SSID picker in the WiFi QR template) ──
  scanWifi: () => ipcRenderer.invoke("scan-wifi"),
  // macOS: open System Settings → Privacy & Security → Location Services.
  // Nearby SSIDs stay redacted until Location Services is allowed for the app.
  openLocationSettings: () => ipcRenderer.invoke("open-location-settings"),

  // ── Map / geocoding (Geo QR template) ──
  // Place search, proxied through the main process (proper User-Agent, no CORS
  // surprises, provider fallback). Returns [{ primary, secondary, type, lat, lon }].
  mapGeocode: (q, bias) => ipcRenderer.invoke("map-geocode", { q, ...(bias || {}) }),
  // Coarse "where am I" (OS location, then IP fallback) used to rank local results.
  mapLocate: () => ipcRenderer.invoke("map-locate"),
  // Offline tile cache accounting: { tiles, bytes }.
  mapCacheInfo: (force) => ipcRenderer.invoke("map-cache-info", !!force),
  // Download the whole world at low zoom (z0–z4 by default) for offline use.
  mapDownloadWorld: (opts) => ipcRenderer.invoke("map-download-world", opts || {}),
  // Download the currently visible area up to a chosen zoom for offline use.
  mapDownloadArea: (opts) => ipcRenderer.invoke("map-download-area", opts || {}),
  mapDownloadCancel: () => ipcRenderer.invoke("map-download-cancel"),
  mapCacheClear: () => ipcRenderer.invoke("map-cache-clear"),
  onMapDownloadProgress: (callback) => ipcRenderer.on("map-download-progress", (e, info) => callback(info)),

  // ── Rich QR actions (scanned WIFI/vCard/event/geo payloads) ──
  // Join a Wi-Fi network from a WIFI: QR payload ({ ssid, password, security }).
  joinWifi: (payload) => ipcRenderer.invoke("join-wifi", payload),
  // Open a vCard (.vcf → Contacts/People) or event (.ics → Calendar) payload.
  openContactEvent: (payload) => ipcRenderer.invoke("open-contact-event", payload),
  // Show a geo: payload in Maps (Apple Maps on macOS, Google Maps elsewhere).
  openGeo: (payload) => ipcRenderer.invoke("open-geo", payload),

  // Restart the app
  restartApp: () => ipcRenderer.invoke("restart-app"),

  // First-launch guided tour
  shouldShowTutorial: () => ipcRenderer.invoke("should-show-tutorial"),
  markTutorialShown: () => ipcRenderer.invoke("mark-tutorial-shown"),

  // First-launch setup wizard: the renderer marks it complete (or skipped) here.
  markSetupComplete: () => ipcRenderer.invoke("mark-setup-complete"),

  // Called by the renderer once first-launch onboarding is finished, so the first
  // window close will tuck the app into the menu bar (instead of re-showing it).
  markOnboardingComplete: () => ipcRenderer.invoke("mark-onboarding-complete"),

  // Called by the renderer once first-launch onboarding is done, to tuck the app
  // into the menu bar (hide Dock, create tray, hide window).
  enterMenuBarMode: () => ipcRenderer.invoke("enter-menu-bar-mode"),
});

// Overlay API — used when overlay.html is loaded into the same mainWindow
contextBridge.exposeInMainWorld("overlayAPI", {
  decoded: (data) => ipcRenderer.invoke("decoded", data),
  cancel: () => ipcRenderer.invoke("overlay-cancel"),
  done: () => ipcRenderer.invoke("overlay-done"),
});
