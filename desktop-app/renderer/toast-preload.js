// Kuiqr — Toast Window Preload (v2.4.2.0)
// Bridges the toast BrowserWindow (a real on-screen overlay, not an in-app DOM
// element) with the main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("toastAPI", {
  // Main → toast window: show a notification with { type, title, content, hint }.
  onShowToast: (callback) =>
    ipcRenderer.on("show-toast-window", (event, payload) => callback(payload)),

  // Toast window → main: report the rendered card height so the window can be
  // resized to fit its content exactly (it's transparent, so no wasted space).
  reportHeight: (height) => ipcRenderer.send("toast-ready", height),
});
