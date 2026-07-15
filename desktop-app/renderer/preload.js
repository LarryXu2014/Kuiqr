const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qrAPI", {
  triggerScan: () => ipcRenderer.invoke("trigger-scan"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  getHistory: () => ipcRenderer.invoke("get-history"),
  clearHistory: () => ipcRenderer.invoke("clear-history"),
  openUrl: (url) => ipcRenderer.invoke("open-url", url),
  copyClipboard: (text) => ipcRenderer.invoke("copy-clipboard", text),
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  onSwitchTab: (callback) => ipcRenderer.on("switch-tab", (e, tab) => callback(tab)),
});
