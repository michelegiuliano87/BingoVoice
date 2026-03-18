const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

let mainWindow = null;
let updateCheckStarted = false;
let licensedUpdatesEnabled = false;

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

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", async (error) => {
    if (!mainWindow) return;
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Aggiornamento non riuscito",
      message: "Non sono riuscito a controllare gli aggiornamenti di BingoVoice.",
      detail: error?.message || "Errore sconosciuto.",
    });
  });

  autoUpdater.on("update-available", async (info) => {
    if (!mainWindow) return;
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Scarica aggiornamento", "Più tardi"],
      defaultId: 0,
      cancelId: 1,
      title: "Aggiornamento disponibile",
      message: `È disponibile BingoVoice ${info.version}.`,
      detail: "Vuoi scaricare ora l'aggiornamento automatico?",
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-not-available", async () => {
    if (!mainWindow) return;
    mainWindow.webContents.send("desktop:update-status", {
      type: "up-to-date",
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    if (!mainWindow) return;
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Installa e riavvia", "Più tardi"],
      defaultId: 0,
      cancelId: 1,
      title: "Aggiornamento pronto",
      message: `BingoVoice ${info.version} è stato scaricato.`,
      detail: "Il programma verrà chiuso e riavviato per completare l'installazione.",
    });

    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
}

function maybeCheckForUpdates() {
  if (!app.isPackaged || !licensedUpdatesEnabled || updateCheckStarted) return;
  updateCheckStarted = true;
  autoUpdater.checkForUpdates().catch(() => {
    updateCheckStarted = false;
  });
}

async function createWindow(hash = "/") {
  const win = new BrowserWindow({
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
      createChildWindow(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  await loadRenderer(win, hash);
  return win;
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

ipcMain.on("desktop:set-license-state", (_event, payload) => {
  licensedUpdatesEnabled = Boolean(payload?.hasActiveLicense);
  if (licensedUpdatesEnabled) {
    maybeCheckForUpdates();
  }
});

app.whenReady().then(async () => {
  setupAutoUpdater();
  mainWindow = await createWindow("/Dashboard");

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow("/Dashboard");
      maybeCheckForUpdates();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
