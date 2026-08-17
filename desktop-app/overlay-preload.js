// Copyright 2026 LarryXu. Licensed under GPL-3.0.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  decoded: (data) => ipcRenderer.invoke("decoded", data),
  cancel: () => ipcRenderer.invoke("overlay-cancel"),
  done: () => ipcRenderer.invoke("overlay-done"),
});
