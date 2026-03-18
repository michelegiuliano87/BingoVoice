const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  saveMediaFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
});
