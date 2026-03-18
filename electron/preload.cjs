const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  saveMediaFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  setLicenseState: (payload) => ipcRenderer.send("desktop:set-license-state", payload),
  updaterAction: (action) => ipcRenderer.send("desktop:updater-action", action),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:update-status", handler);
    return () => ipcRenderer.removeListener("desktop:update-status", handler);
  },
});
