const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const https = require("node:https");
const { pathToFileURL } = require("node:url");
const { createService } = require("./license-service.cjs");
const { createLocalServer } = require("./local-server.cjs");

let mainWindow = null;
let startupWindow = null;
let licensedUpdatesEnabled = false;
let startupMode = false;
let updateDecisionTaken = false;
let licenseService = null;
let startupWatchdog = null;
let startupStatus = "idle";
let startupForceOpenTimer = null;
let startupShownAt = null;
let startupCloseTimer = null;
let localServer = null;
let localServerError = null;
let localServerErrorAt = null;
let localServerRestarting = false;
let startupUpdateOffer = null;
const FILE_PROTECTION_PREFIX = "encfile:v1:";
const FILE_PROTECTION_SECRET = "toretto-file-protection-v1";
const STARTUP_MIN_VISIBLE_MS = 900;

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

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfMissing(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath))) return;
  if (await pathExists(targetPath)) return;
  await fs.cp(sourcePath, targetPath, { recursive: true, force: false });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeVersion(b).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function fetchLatestGithubVersion() {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path: "/repos/michelegiuliano87/BingoVoice/releases/latest",
        method: "GET",
        headers: {
          "User-Agent": "BingoVoice-Updater",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`github-status-${res.statusCode}`));
            return;
          }
          try {
            const parsed = JSON.parse(body || "{}");
            resolve(normalizeVersion(parsed.tag_name || parsed.name || ""));
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.setTimeout(5000, () => {
      req.destroy(new Error("github-timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

async function ensureSeedData() {
  const userDataPath = app.getPath("userData");
  const markerPath = path.join(userDataPath, "seed-installed.json");
  if (await pathExists(markerPath)) return;

  const seedRoot = app.isPackaged
    ? path.join(process.resourcesPath, "seed-data")
    : path.join(__dirname, "..", "seed-data");

  if (!(await pathExists(seedRoot))) return;

  await copyIfMissing(path.join(seedRoot, "uploads"), path.join(userDataPath, "uploads"));
  await copyIfMissing(path.join(seedRoot, "Local Storage"), path.join(userDataPath, "Local Storage"));
  await copyIfMissing(path.join(seedRoot, "entity-AppSettings.json"), path.join(userDataPath, "entity-AppSettings.json"));
  await copyIfMissing(path.join(seedRoot, "entity-VideoButton.json"), path.join(userDataPath, "entity-VideoButton.json"));

  await fs.writeFile(
    markerPath,
    JSON.stringify({ installedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
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
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
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
  if (startupCloseTimer) return;
  const elapsed = startupShownAt ? Date.now() - startupShownAt : STARTUP_MIN_VISIBLE_MS;
  const delay = Math.max(0, STARTUP_MIN_VISIBLE_MS - elapsed);
  if (delay > 0) {
    startupCloseTimer = setTimeout(() => {
      startupCloseTimer = null;
      closeStartupAndOpenMain();
    }, delay);
    return;
  }

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
  if (startupCloseTimer) {
    clearTimeout(startupCloseTimer);
    startupCloseTimer = null;
  }
  startupMode = false;
  startupStatus = "idle";
  startupShownAt = null;
  await openMainWindow();
}

async function createChildWindow(url) {
  const child = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: "#020617",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
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
    show: true,
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  await startupWindow.loadFile(path.join(__dirname, "update-ui.html"));
  startupShownAt = Date.now();
  startupWindow.once("ready-to-show", () => {
    startupWindow.show();
    if (!startupShownAt) startupShownAt = Date.now();
  });
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
    startupUpdateOffer = normalizeVersion(info?.version || "");
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

async function checkForStartupUpdates() {
  const currentVersion = normalizeVersion(app.getVersion());
  let autoVersion = null;
  let manualVersion = null;
  const detailsBase = `Locale: ${currentVersion || "n/d"}`;

  try {
    const result = await autoUpdater.checkForUpdates();
    autoVersion = normalizeVersion(result?.updateInfo?.version || "");
    if (autoVersion && compareVersions(autoVersion, currentVersion) > 0) {
      startupUpdateOffer = autoVersion;
      sendUpdateStatus({
        type: "available",
        version: autoVersion,
        details: `${detailsBase} • AutoUpdater: ${autoVersion}`,
      });
      return;
    }
  } catch {
    // fallback to manual check
  }

  try {
    manualVersion = await fetchLatestGithubVersion();
  } catch {
    manualVersion = null;
  }

  if (manualVersion && compareVersions(manualVersion, currentVersion) > 0) {
    startupUpdateOffer = manualVersion;
    sendUpdateStatus({
      type: "available",
      version: manualVersion,
      details: `${detailsBase} • GitHub: ${manualVersion}`,
    });
    return;
  }

  if (!autoVersion && !manualVersion) {
    sendUpdateStatus({
      type: "error",
      message: "Non sono riuscito a verificare gli aggiornamenti. Sto aprendo il programma.",
      details: `${detailsBase} • AutoUpdater: errore • GitHub: errore`,
    });
    if (startupMode) {
      setTimeout(() => {
        closeStartupAndOpenMain();
      }, 1200);
    }
    return;
  }

  sendUpdateStatus({
    type: "up-to-date",
    details: `${detailsBase} • AutoUpdater: ${autoVersion || "nessuno"} • GitHub: ${manualVersion || "nessuno"}`,
  });
  if (startupMode) {
    setTimeout(() => {
      closeStartupAndOpenMain();
    }, 900);
  }
}

async function ensureLocalServer() {
  if (localServer) return localServer;
  try {
    localServer = await createLocalServer({ app, decryptFileJson, getEntityStorePath });
    localServerError = null;
    localServerErrorAt = null;
    return localServer;
  } catch (error) {
    localServerError = error?.message || "local-server-error";
    localServerErrorAt = new Date().toISOString();
    return null;
  }
}

async function restartLocalServer() {
  if (localServerRestarting) return localServer;
  localServerRestarting = true;
  localServerError = null;
  localServerErrorAt = null;
  const restartedAt = new Date().toISOString();
  let previousPort = null;
  let previousIp = null;
  if (localServer?.getStatus) {
    try {
      const status = localServer.getStatus();
      previousPort = status?.port ?? null;
      previousIp = status?.ip ?? null;
    } catch {
      // ignore
    }
  }
  try {
    if (localServer) {
      await localServer.close();
    }
  } catch {
    // ignore close errors
  } finally {
    localServer = null;
  }
  await delay(250);
  const server = await ensureLocalServer();
  localServerRestarting = false;
  if (!server) return server;
  try {
    const ok = await server.ping?.();
    if (!ok) {
      localServerError = "ping-failed";
      localServerErrorAt = new Date().toISOString();
    }
  } catch {
    localServerError = "ping-failed";
    localServerErrorAt = new Date().toISOString();
  }
  const status = server.getStatus?.() || {};
  return {
    ...server,
    __restartMeta: {
      previousPort,
      previousIp,
      restartedAt,
      currentPort: status?.port ?? null,
      currentIp: status?.ip ?? null,
    },
  };
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

  if (app.isPackaged) {
    startupMode = true;
    updateDecisionTaken = false;
    startupUpdateOffer = null;
    await createStartupWindow();
    sendUpdateStatus({ type: "checking" });
    armStartupWatchdog();
    checkForStartupUpdates();
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
ipcMain.handle("desktop:local-server:status", async () => {
  if (localServer) return { ...localServer.getStatus(), error: null };
  return { error: localServerError || "not-ready", errorAt: localServerErrorAt };
});
ipcMain.handle("desktop:local-server:connections", async () => localServer?.getConnections() || []);
ipcMain.handle("desktop:local-server:push-cards", async (_event, payload) => localServer?.pushCards(payload));
ipcMain.handle("desktop:local-server:ping", async () => {
  if (!localServer) return { ok: false, error: "not-ready" };
  const ok = await localServer.ping?.();
  return { ok: Boolean(ok) };
});
ipcMain.handle("desktop:local-server:ensure", async () => {
  const server = await ensureLocalServer();
  if (!server) return { error: localServerError || "not-ready", errorAt: localServerErrorAt };
  const ok = await server.ping?.();
  if (!ok) {
    localServerError = "ping-failed";
    localServerErrorAt = new Date().toISOString();
    return { ...server.getStatus(), error: "ping-failed", errorAt: localServerErrorAt };
  }
  return { ...server.getStatus(), error: null };
});
ipcMain.handle("desktop:local-server:restart", async () => {
  const server = await restartLocalServer();
  if (!server) return { error: localServerError || "not-ready", errorAt: localServerErrorAt };
  const status = server.getStatus ? server.getStatus() : {};
  const ok = await server.ping?.();
  if (!ok) {
    localServerError = "ping-failed";
    localServerErrorAt = new Date().toISOString();
    return { ...status, error: "ping-failed", errorAt: localServerErrorAt };
  }
  const meta = server.__restartMeta || {};
  return {
    ...status,
    error: null,
    restartedAt: meta.restartedAt || new Date().toISOString(),
    previousPort: meta.previousPort ?? null,
    previousIp: meta.previousIp ?? null,
    currentPort: meta.currentPort ?? status?.port ?? null,
    currentIp: meta.currentIp ?? status?.ip ?? null,
  };
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
    try {
      if (!startupUpdateOffer) {
        await autoUpdater.checkForUpdates();
      }
      await autoUpdater.downloadUpdate();
    } catch {
      closeStartupAndOpenMain();
    }
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
  await ensureLocalServer();
  await ensureSeedData();
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

app.on("before-quit", async () => {
  if (localServer) {
    await localServer.close();
  }
});
