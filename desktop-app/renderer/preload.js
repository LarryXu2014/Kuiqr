// Copyright 2026 LarryXu. Licensed under GPL-3.0.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qrAPI", {
  // Scan
  triggerScan: () => ipcRenderer.invoke("trigger-scan"),
  readClipboardImage: () => ipcRenderer.invoke("read-clipboard-image"),
  onDecoded: (text) => ipcRenderer.invoke("decoded", text),

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

  // First-launch guided tour
  shouldShowTutorial: () => ipcRenderer.invoke("should-show-tutorial"),
  markTutorialShown: () => ipcRenderer.invoke("mark-tutorial-shown"),

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
