const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  decodeCrop: (dataUrl) => ipcRenderer.invoke("decode-crop", dataUrl),
  cancel: () => ipcRenderer.invoke("overlay-cancel"),
  done: () => ipcRenderer.invoke("overlay-done"),
});
