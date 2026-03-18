const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

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

app.whenReady().then(async () => {
  await createWindow("/Dashboard");

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow("/Dashboard");
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
