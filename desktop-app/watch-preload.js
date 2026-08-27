// Copyright 2026 LarryXu. Licensed under GPL-3.0.
const { contextBridge, ipcRenderer } = require("electron");

// Region-watch selection overlay → main process.
contextBridge.exposeInMainWorld("watchOverlay", {
  // rect: { x, y, w, h } in CSS pixels relative to the display; displayId echoed back.
  submit: (rect) => ipcRenderer.invoke("region-watch-rect", rect),
  cancel: () => ipcRenderer.invoke("region-watch-cancel"),
});
