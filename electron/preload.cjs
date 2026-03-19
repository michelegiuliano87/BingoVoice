const { contextBridge, ipcRenderer } = require("electron");
const crypto = require("node:crypto");
const os = require("node:os");

const PROTECTED_PREFIX = "enc:v1:";
const BASE_SECRET = "toretto-local-protection-v1";

function buildMachineFingerprint() {
  return [os.hostname(), os.userInfo().username, os.platform(), os.arch()].join("|");
}

function deriveKey(namespace = "core") {
  return crypto.scryptSync(
    `${BASE_SECRET}|${buildMachineFingerprint()}`,
    `bingovoice|${namespace}`,
    32,
  );
}

function encryptStorageValue(value, namespace = "core") {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(namespace), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PROTECTED_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64")}`;
}

function decryptStorageValue(value, namespace = "core") {
  const raw = String(value || "");
  if (!raw.startsWith(PROTECTED_PREFIX)) {
    return raw;
  }

  const payload = Buffer.from(raw.slice(PROTECTED_PREFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(namespace), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

contextBridge.exposeInMainWorld("desktopAPI", {
  saveMediaFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  setLicenseState: (payload) => ipcRenderer.send("desktop:set-license-state", payload),
  updaterAction: (action) => ipcRenderer.send("desktop:updater-action", action),
  readEntityCollection: (entityName) => ipcRenderer.invoke("desktop:entity:read", entityName),
  writeEntityCollection: (entityName, items) =>
    ipcRenderer.invoke("desktop:entity:write", { entityName, items }),
  removeEntityCollection: (entityName) => ipcRenderer.invoke("desktop:entity:remove", entityName),
  getLicenseSnapshot: () => ipcRenderer.invoke("desktop:license:get-snapshot"),
  activateLicense: (payload) => ipcRenderer.invoke("desktop:license:activate", payload),
  activateOwnerAccess: () => ipcRenderer.invoke("desktop:license:activate-owner"),
  deactivateLicense: () => ipcRenderer.invoke("desktop:license:deactivate"),
  createLicenseCustomer: (payload) => ipcRenderer.invoke("desktop:license:create-customer", payload),
  updateLicenseCustomer: (id, patch) => ipcRenderer.invoke("desktop:license:update-customer", { id, patch }),
  createLicenseRecord: (payload) => ipcRenderer.invoke("desktop:license:create-record", payload),
  updateLicenseRecord: (id, patch) => ipcRenderer.invoke("desktop:license:update-record", { id, patch }),
  renewLicenseRecord: (payload) => ipcRenderer.invoke("desktop:license:renew-record", payload),
  releaseLicenseDevice: (payload) => ipcRenderer.invoke("desktop:license:release-device", payload),
  importLegacyLicenseData: (payload) => ipcRenderer.invoke("desktop:license:import-legacy", payload),
  getLocalServerStatus: () => ipcRenderer.invoke("desktop:local-server:status"),
  ensureLocalServer: () => ipcRenderer.invoke("desktop:local-server:ensure"),
  restartLocalServer: () => ipcRenderer.invoke("desktop:local-server:restart"),
  forceLocalServer: () => ipcRenderer.invoke("desktop:local-server:force"),
  getLocalServerConnections: () => ipcRenderer.invoke("desktop:local-server:connections"),
  pushCardsToMobile: (payload) => ipcRenderer.invoke("desktop:local-server:push-cards", payload),
  pingLocalServer: () => ipcRenderer.invoke("desktop:local-server:ping"),
  saveProjectPackage: (payload) => ipcRenderer.invoke("desktop:project-package:save", payload),
  openProjectPackage: () => ipcRenderer.invoke("desktop:project-package:open"),
  encryptStorageValue: (value, namespace) => encryptStorageValue(value, namespace),
  decryptStorageValue: (value, namespace) => decryptStorageValue(value, namespace),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:update-status", handler);
    return () => ipcRenderer.removeListener("desktop:update-status", handler);
  },
  onLicenseChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:license-changed", handler);
    return () => ipcRenderer.removeListener("desktop:license-changed", handler);
  },
});
