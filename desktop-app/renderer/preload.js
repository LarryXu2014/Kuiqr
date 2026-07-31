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

  // Tab switching from tray/main process
  onSwitchTab: (callback) => ipcRenderer.on("switch-tab", (e, tab) => callback(tab)),
});

// Overlay API — used when overlay.html is loaded into the same mainWindow
contextBridge.exposeInMainWorld("overlayAPI", {
  decoded: (data) => ipcRenderer.invoke("decoded", data),
  cancel: () => ipcRenderer.invoke("overlay-cancel"),
  done: () => ipcRenderer.invoke("overlay-done"),
});
