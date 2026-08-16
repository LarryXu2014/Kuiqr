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

  // Show a system notification (respects the "show notifications" setting)
  showNotification: (title, body) => ipcRenderer.invoke("show-notification", title, body),

  // Real app build version (4-part, e.g. "2.4.1.7"), for the About section
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // First-launch browser-extension download prompt
  shouldShowExtensionPrompt: () => ipcRenderer.invoke("should-show-extension-prompt"),
  markExtensionPromptShown: () => ipcRenderer.invoke("mark-extension-prompt-shown"),
  downloadExtension: (browserType) => ipcRenderer.invoke("download-extension", browserType),

  // First-launch guided tour
  shouldShowTutorial: () => ipcRenderer.invoke("should-show-tutorial"),
  markTutorialShown: () => ipcRenderer.invoke("mark-tutorial-shown"),
});

// Overlay API — used when overlay.html is loaded into the same mainWindow
contextBridge.exposeInMainWorld("overlayAPI", {
  decoded: (data) => ipcRenderer.invoke("decoded", data),
  cancel: () => ipcRenderer.invoke("overlay-cancel"),
  done: () => ipcRenderer.invoke("overlay-done"),
});
