const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let startupWindow = null;
let licensedUpdatesEnabled = false;
let startupMode = false;
let updateDecisionTaken = false;
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
  if (startupWindow && !startupWindow.isDestroyed()) {
    startupWindow.webContents.send("desktop:update-status", payload);
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

  startupMode = false;
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

function getLicenseStatePath() {
  return path.join(app.getPath("userData"), "license-state.json");
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
  licensedUpdatesEnabled = Boolean(cachedLicense?.hasActiveLicense);

  if (app.isPackaged && licensedUpdatesEnabled) {
    startupMode = true;
    updateDecisionTaken = false;
    await createStartupWindow();
    autoUpdater.checkForUpdates().catch(() => {
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
