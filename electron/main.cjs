const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { createService } = require("./license-service.cjs");

let mainWindow = null;
let startupWindow = null;
let licensedUpdatesEnabled = false;
let startupMode = false;
let updateDecisionTaken = false;
let licenseService = null;
let startupWatchdog = null;
let startupStatus = "idle";
let startupForceOpenTimer = null;
const FILE_PROTECTION_PREFIX = "encfile:v1:";
const FILE_PROTECTION_SECRET = "toretto-file-protection-v1";

function deriveFileKey(namespace = "core") {
  return crypto.scryptSync(
    `${FILE_PROTECTION_SECRET}|${os.hostname()}|${os.userInfo().username}|${os.platform()}|${os.arch()}`,
    `bingovoice|${namespace}`,
    32,
  );
}

function encryptFileJson(payload, namespace = "core") {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveFileKey(namespace), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${FILE_PROTECTION_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64")}`;
}

function decryptFileJson(raw, namespace = "core") {
  const source = String(raw || "");
  if (!source.startsWith(FILE_PROTECTION_PREFIX)) {
    return JSON.parse(source);
  }

  const payload = Buffer.from(source.slice(FILE_PROTECTION_PREFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveFileKey(namespace), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

function getRendererEntry() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return path.join(__dirname, "..", "dist", "index.html");
}

async function loadRenderer(win, hash = "/") {
  const entry = getRendererEntry();
  if (entry.startsWith("http")) {
    await win.loadURL(`${entry}#${hash}`);
    return;
  }

  await win.loadFile(entry, { hash });
}

function sendUpdateStatus(payload) {
  if (payload?.type) {
    startupStatus = payload.type;
    if (startupWatchdog && payload.type !== "checking") {
      clearTimeout(startupWatchdog);
      startupWatchdog = null;
    }
  }
  if (startupWindow && !startupWindow.isDestroyed()) {
    startupWindow.webContents.send("desktop:update-status", payload);
  }
}

function broadcastLicenseSnapshot(snapshot) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("desktop:license-changed", snapshot);
    }
  }
}

async function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
      createChildWindow(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  await loadRenderer(mainWindow, "/Dashboard");
  return mainWindow;
}

async function closeStartupAndOpenMain() {
  if (startupWindow && !startupWindow.isDestroyed()) {
    startupWindow.close();
    startupWindow = null;
  }

  if (startupWatchdog) {
    clearTimeout(startupWatchdog);
    startupWatchdog = null;
  }
  if (startupForceOpenTimer) {
    clearTimeout(startupForceOpenTimer);
    startupForceOpenTimer = null;
  }
  startupMode = false;
  startupStatus = "idle";
  await openMainWindow();
}

async function createChildWindow(url) {
  const child = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: "#020617",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  await child.loadURL(url);
}

async function createStartupWindow() {
  startupWindow = new BrowserWindow({
    width: 700,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: "#06111f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  await startupWindow.loadFile(path.join(__dirname, "update-ui.html"));
  startupWindow.once("ready-to-show", () => startupWindow.show());
  startupWindow.on("closed", () => {
    startupWindow = null;
  });
}

function armStartupWatchdog() {
  if (startupWatchdog) clearTimeout(startupWatchdog);
  startupStatus = "checking";
  startupWatchdog = setTimeout(() => {
    if (startupMode && startupStatus === "checking") {
      sendUpdateStatus({
        type: "error",
        message: "Controllo aggiornamenti in timeout. Sto aprendo il programma.",
      });
      setTimeout(() => {
        closeStartupAndOpenMain();
      }, 1200);
    }
  }, 12000);

  if (startupForceOpenTimer) clearTimeout(startupForceOpenTimer);
  startupForceOpenTimer = setTimeout(() => {
    if (startupMode) {
      closeStartupAndOpenMain();
    }
  }, 20000);
}

function getLicenseStatePath() {
  return path.join(app.getPath("userData"), "license-state.json");
}

function getEntityStorePath(entityName) {
  return path.join(app.getPath("userData"), `entity-${entityName}.json`);
}

async function readCachedLicenseState() {
  try {
    const raw = await fs.readFile(getLicenseStatePath(), "utf8");
    return decryptFileJson(raw, "licenseState");
  } catch {
    return { hasActiveLicense: false };
  }
}

async function writeCachedLicenseState(payload) {
  await fs.writeFile(getLicenseStatePath(), encryptFileJson(payload, "licenseState"), "utf8");
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus({ type: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({ type: "available", version: info.version });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({ type: "downloading", percent: progress.percent || 0 });
  });

  autoUpdater.on("update-downloaded", () => {
    sendUpdateStatus({ type: "downloaded" });
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 1400);
  });

  autoUpdater.on("update-not-available", async () => {
    sendUpdateStatus({ type: "up-to-date" });
    if (startupMode) {
      setTimeout(() => {
        closeStartupAndOpenMain();
      }, 900);
    }
  });

  autoUpdater.on("error", async (error) => {
    sendUpdateStatus({
      type: "error",
      message: error?.message || "Controllo aggiornamenti non riuscito. Sto aprendo il programma.",
    });

    if (startupMode) {
      setTimeout(() => {
        closeStartupAndOpenMain();
      }, 1200);
    }
  });
}

async function startAppFlow() {
  const cachedLicense = await readCachedLicenseState();
  let hasActiveLicense = Boolean(cachedLicense?.hasActiveLicense);
  if (licenseService) {
    try {
      const snapshot = await licenseService.getSnapshot();
      hasActiveLicense = Boolean(snapshot?.activeLicense || hasActiveLicense);
    } catch {
      // Keep cached value if snapshot fails.
    }
  }
  licensedUpdatesEnabled = hasActiveLicense;

  if (app.isPackaged && licensedUpdatesEnabled) {
    startupMode = true;
    updateDecisionTaken = false;
    await createStartupWindow();
    sendUpdateStatus({ type: "checking" });
    armStartupWatchdog();
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        const version = result?.updateInfo?.version;
        if (version) {
          sendUpdateStatus({ type: "available", version });
        }
      })
      .catch(() => {
        closeStartupAndOpenMain();
      });
    return;
  }

  await openMainWindow();
}

ipcMain.handle("desktop:save-file", async (_event, payload) => {
  const uploadsDir = path.join(app.getPath("userData"), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(payload.name || "");
  const fileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, Buffer.from(payload.bytes));

  return pathToFileURL(filePath).toString();
});

ipcMain.handle("desktop:project-package:save", async (_event, payload) => {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow || startupWindow;
  const result = await dialog.showSaveDialog(targetWindow, {
    title: "Esporta Progetto BingoVoice",
    defaultPath: payload?.suggestedName || "progetto-bingovoice.bvpack",
    filters: [{ name: "BingoVoice Project Package", extensions: ["bvpack"] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  if (payload?.bytes) {
    await fs.writeFile(result.filePath, Buffer.from(payload.bytes));
  } else {
    await fs.writeFile(result.filePath, JSON.stringify(payload.packageData, null, 2), "utf8");
  }
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("desktop:project-package:open", async () => {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow || startupWindow;
  const result = await dialog.showOpenDialog(targetWindow, {
    title: "Importa Progetto BingoVoice",
    properties: ["openFile"],
    filters: [{ name: "BingoVoice Project Package", extensions: ["bvpack", "json"] }],
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      canceled: false,
      filePath,
      packageData: JSON.parse(raw),
    };
  }

  const raw = await fs.readFile(filePath);
  return {
    canceled: false,
    filePath,
    bytes: raw,
  };
});

ipcMain.handle("desktop:entity:read", async (_event, entityName) => {
  try {
    const raw = await fs.readFile(getEntityStorePath(entityName), "utf8");
    const parsed = decryptFileJson(raw, `entity:${entityName}`);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});

ipcMain.handle("desktop:entity:write", async (_event, payload) => {
  const { entityName, items } = payload || {};
  if (!entityName) return { success: false };
  await fs.writeFile(
    getEntityStorePath(entityName),
    encryptFileJson(items || [], `entity:${entityName}`),
    "utf8",
  );
  return { success: true };
});

ipcMain.handle("desktop:entity:remove", async (_event, entityName) => {
  try {
    await fs.unlink(getEntityStorePath(entityName));
  } catch {
    // ignore
  }
  return { success: true };
});

ipcMain.handle("desktop:license:get-snapshot", async () => licenseService.getSnapshot());
ipcMain.handle("desktop:license:activate", async (_event, payload) => licenseService.activateLicense(payload));
ipcMain.handle("desktop:license:activate-owner", async () => licenseService.activateOwnerAccess());
ipcMain.handle("desktop:license:deactivate", async () => licenseService.deactivateLicense());
ipcMain.handle("desktop:license:create-customer", async (_event, payload) => licenseService.createCustomer(payload));
ipcMain.handle("desktop:license:update-customer", async (_event, payload) => licenseService.updateCustomer(payload.id, payload.patch));
ipcMain.handle("desktop:license:create-record", async (_event, payload) => licenseService.createLicenseRecord(payload));
ipcMain.handle("desktop:license:update-record", async (_event, payload) => licenseService.updateLicenseRecord(payload.id, payload.patch));
ipcMain.handle("desktop:license:renew-record", async (_event, payload) => licenseService.renewLicenseRecord(payload));
ipcMain.handle("desktop:license:release-device", async (_event, payload) => licenseService.releaseDeviceFromLicense(payload));
ipcMain.handle("desktop:license:import-legacy", async (_event, payload) => licenseService.importLegacyData(payload));

ipcMain.on("desktop:set-license-state", async (_event, payload) => {
  licensedUpdatesEnabled = Boolean(payload?.hasActiveLicense);
  await writeCachedLicenseState({
    hasActiveLicense: licensedUpdatesEnabled,
    email: payload?.email || "",
    updatedAt: new Date().toISOString(),
  });
});

ipcMain.on("desktop:updater-action", async (_event, action) => {
  if (!startupMode || updateDecisionTaken) return;

  if (action === "download") {
    updateDecisionTaken = true;
    autoUpdater.downloadUpdate().catch(() => {
      closeStartupAndOpenMain();
    });
    return;
  }

  if (action === "skip") {
    updateDecisionTaken = true;
    await closeStartupAndOpenMain();
  }
});

app.whenReady().then(async () => {
  licenseService = createService(app, (snapshot) => {
    licensedUpdatesEnabled = Boolean(snapshot?.activeLicense);
    broadcastLicenseSnapshot(snapshot);
  }, writeCachedLicenseState);
  setupAutoUpdater();
  await startAppFlow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await startAppFlow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
