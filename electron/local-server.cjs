const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { fileURLToPath } = require("node:url");
const JSZip = require("jszip");
const { WebSocketServer } = require("ws");

const DEFAULT_PORT = 3876;
const DOWNLOAD_TTL_MS = 1000 * 60 * 30;

function getLocalIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  if (ips.length === 0) return ["127.0.0.1"];
  return Array.from(new Set(ips));
}

function safeName(input, fallback = "file") {
  return String(input || fallback)
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 60);
}

function fileUrlToPathMaybe(value) {
  if (!value) return null;
  if (value.startsWith("file://")) {
    try {
      return fileURLToPath(value);
    } catch {
      return null;
    }
  }
  if (value.startsWith("http://") || value.startsWith("https://")) return null;
  return value;
}

async function createZipForCards({
  app,
  decryptFileJson,
  getEntityStorePath,
  projectId,
}) {
  const userData = app.getPath("userData");
  const readEntity = async (name) => {
    try {
      const raw = await fs.readFile(getEntityStorePath(name), "utf8");
      const parsed = decryptFileJson(raw, `entity:${name}`);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [cards, mediaItems, projects] = await Promise.all([
    readEntity("PlayerCard"),
    readEntity("MediaItem"),
    readEntity("Project"),
  ]);

  const filteredCards = projectId
    ? cards.filter((card) => card.project_id === projectId)
    : cards;

  const project = projectId ? projects.find((p) => p.id === projectId) : null;
  const mediaById = new Map(mediaItems.map((item) => [item.id, item]));
  const zip = new JSZip();

  const packagedCards = filteredCards.map((card) => {
    const media = (card.media_item_ids || [])
      .map((id) => mediaById.get(id))
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        name: item.name,
        image_url: item.image_url || "",
        audio_url: item.audio_url || "",
      }));
    return {
      id: card.id,
      card_number: card.card_number,
      media,
    };
  });

  zip.file(
    "cards.json",
    JSON.stringify(
      {
        project: project ? { id: project.id, name: project.name } : null,
        createdAt: new Date().toISOString(),
        cards: packagedCards,
      },
      null,
      2,
    ),
  );

  const mediaFolder = zip.folder("media");
  if (mediaFolder) {
    for (const card of packagedCards) {
      for (const media of card.media) {
        const imagePath = fileUrlToPathMaybe(media.image_url);
        if (imagePath) {
          try {
            const bytes = await fs.readFile(imagePath);
            const ext = path.extname(imagePath) || ".png";
            mediaFolder.file(
              safeName(`${media.name || media.id}-img${ext}`),
              bytes,
            );
          } catch {}
        }
        const audioPath = fileUrlToPathMaybe(media.audio_url);
        if (audioPath) {
          try {
            const bytes = await fs.readFile(audioPath);
            const ext = path.extname(audioPath) || ".mp3";
            mediaFolder.file(
              safeName(`${media.name || media.id}-audio${ext}`),
              bytes,
            );
          } catch {}
        }
      }
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const exportsDir = path.join(userData, "mobile-exports");
  await fs.mkdir(exportsDir, { recursive: true });
  const token = crypto.randomUUID();
  const baseName = project?.name ? `cartelle-${safeName(project.name)}` : "cartelle";
  const filename = `${baseName}.zip`;
  const filePath = path.join(exportsDir, `${token}-${filename}`);
  await fs.writeFile(filePath, buffer);

  return { token, filePath, filename };
}

function computePrize(cardIds, extractedIds) {
  const totalMatched = cardIds.filter((id) => extractedIds.has(id)).length;
  if (totalMatched >= 15) {
    return { prize: "BINGO! 🎉", matched: cardIds.filter((id) => extractedIds.has(id)) };
  }

  let bestCount = 0;
  let bestRowMatched = [];
  for (let row = 0; row < 3; row++) {
    const rowIds = cardIds.slice(row * 5, row * 5 + 5);
    const rowMatched = rowIds.filter((id) => extractedIds.has(id));
    if (rowMatched.length > bestCount) {
      bestCount = rowMatched.length;
      bestRowMatched = rowMatched;
    }
  }

  let prize = null;
  if (bestCount === 5) prize = "CINQUINA 🏆";
  else if (bestCount === 4) prize = "QUATERNA ⭐⭐⭐⭐";
  else if (bestCount === 3) prize = "TERNO ⭐⭐⭐";
  else if (bestCount === 2) prize = "AMBO ⭐⭐";

  const allMatched = cardIds.filter((id) => extractedIds.has(id));
  return { prize, matched: allMatched, bestRowMatched };
}

async function buildCardCheckPayload({
  app,
  decryptFileJson,
  getEntityStorePath,
  projectId,
}) {
  const readEntity = async (name) => {
    try {
      const raw = await fs.readFile(getEntityStorePath(name), "utf8");
      const parsed = decryptFileJson(raw, `entity:${name}`);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [cards, mediaItems, extractions] = await Promise.all([
    readEntity("PlayerCard"),
    readEntity("MediaItem"),
    readEntity("Extraction"),
  ]);

  const scopedCards = projectId
    ? cards.filter((card) => card.project_id === projectId)
    : cards;

  if (scopedCards.length === 0) return null;

  const card = scopedCards[Math.floor(Math.random() * scopedCards.length)];
  const cardIds = card.media_item_ids || [];
  const extractedIds = new Set(extractions.map((e) => e.media_item_id));
  const { prize, matched, bestRowMatched = [] } = computePrize(cardIds, extractedIds);
  const count = matched.length;

  const mediaById = new Map(mediaItems.map((item) => [item.id, item]));
  return {
    type: "card_check",
    cardNumber: card.card_number,
    prize,
    count,
    totalItems: cardIds.length,
    items: cardIds.map((id) => {
      const item = mediaById.get(id);
      return {
        id,
        image_url: item?.image_url || "",
        name: item?.name || "",
        matched: matched.includes(id),
        bestRow: bestRowMatched.includes(id),
      };
    }),
  };
}

function buildMobileHtml() {
  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BingoVoice Mobile</title>
    <style>
      body { margin:0; font-family: "Segoe UI", Arial, sans-serif; background:#05070f; color:#e2e8f0; min-height:100vh; }
      .screen { position: relative; min-height: 100vh; overflow: hidden; }
      .video-bg { position: absolute; inset:0; width:100%; height:100%; object-fit: cover; filter: brightness(0.5); }
      .overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:24px; }
      .panel { width: min(92vw, 520px); background: rgba(10,15,30,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:22px; padding:20px; backdrop-filter: blur(12px); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
      .logo { width: 150px; display:block; margin: 0 auto 14px; }
      h1 { font-size: 20px; margin: 0 0 6px; text-align:center; }
      p { color:#94a3b8; margin: 0 0 12px; text-align:center; }
      input { width:100%; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background:#0b1220; color:#e2e8f0; font-size:14px; }
      button { width:100%; margin-top:10px; padding:12px 14px; border-radius:12px; border:0; background:#22d3ee; color:#0b1220; font-weight:800; font-size:14px; }
      .status { margin-top: 12px; font-size: 12px; color:#a5f3fc; text-align:center; }
      .waiting-text { position:absolute; bottom:36px; width:100%; text-align:center; font-weight:900; letter-spacing:0.3em; font-size: clamp(18px, 5vw, 28px); color:white; text-shadow: 0 0 24px rgba(255,200,0,1); }
      .card-check { display:none; position:absolute; inset:0; background: rgba(0,0,0,0.92); padding:18px; overflow:auto; }
      .card-wrap { max-width: 900px; margin: 0 auto; }
      .card-title { text-align:center; font-size: 34px; font-weight:900; color:white; margin-bottom: 8px; }
      .prize { margin: 12px auto; max-width: 420px; text-align:center; padding:12px; border-radius:16px; font-weight:900; font-size: 22px; color:white; }
      .grid { display:grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
      .cell { position:relative; border-radius:10px; overflow:hidden; border:2px solid rgba(255,255,255,0.12); background:#0b1220; }
      .cell img { width:100%; aspect-ratio: 1 / 1; object-fit: cover; }
      .cell .label { font-size: 9px; text-align:center; padding:2px 4px; color:#cbd5f5; background: rgba(0,0,0,0.6); }
      .cell.matched { border-color:#22c55e; }
      .cell.best { border-color:#facc15; box-shadow: 0 0 12px rgba(250,204,21,0.6); }
      .cell .tick { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#86efac; font-size: 28px; font-weight:900; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
    </style>
  </head>
  <body>
    <div class="screen">
      <video class="video-bg" src="/waiting-video" autoplay loop muted playsinline></video>
      <div class="overlay">
        <div class="panel">
          <img class="logo" src="/logo.png" alt="BingoVoice" />
          <h1>Connessione BingoVoice</h1>
          <p>Inserisci un nome per questo telefono e resta connesso.</p>
          <input id="deviceName" placeholder="Nome dispositivo (es. iPhone Marco)" />
          <button id="connectBtn">Connetti</button>
          <div class="status" id="status">Non connesso.</div>
        </div>
      </div>
      <div class="waiting-text" id="waitingText">IN ATTESA DI ESTRAZIONE...</div>
      <div class="card-check" id="cardCheck">
        <div class="card-wrap">
          <div class="card-title" id="cardTitle">Cartella</div>
          <div class="prize" id="prize"></div>
          <div class="grid" id="cardGrid"></div>
        </div>
      </div>
    </div>

    <script>
      const statusEl = document.getElementById("status");
      const connectBtn = document.getElementById("connectBtn");
      const nameInput = document.getElementById("deviceName");
      const cardCheck = document.getElementById("cardCheck");
      const waitingText = document.getElementById("waitingText");
      const cardTitle = document.getElementById("cardTitle");
      const prize = document.getElementById("prize");
      const cardGrid = document.getElementById("cardGrid");
      let socket = null;
      let hideTimer = null;

      function connect() {
        if (socket && socket.readyState === WebSocket.OPEN) return;
        const wsUrl = \`\${location.protocol === "https:" ? "wss" : "ws"}://\${location.host}/ws\`;
        socket = new WebSocket(wsUrl);
        socket.addEventListener("open", () => {
          statusEl.textContent = "Connesso a BingoVoice.";
          socket.send(JSON.stringify({ type: "hello", name: nameInput.value || "Telefono" }));
        });
        socket.addEventListener("close", () => {
          statusEl.textContent = "Connessione persa. Tocca Connetti per riprovare.";
        });
        socket.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "card_check" && payload.items) {
              cardCheck.style.display = "block";
              waitingText.style.display = "none";
              cardTitle.textContent = \`Cartella #\${payload.cardNumber}\`;
              if (payload.prize) {
                prize.style.display = "block";
                prize.textContent = \`\${payload.prize} • \${payload.count}/\${payload.totalItems}\`;
                prize.style.background = "linear-gradient(135deg,#22c55e,#16a34a)";
              } else {
                prize.style.display = "block";
                prize.textContent = \`\${payload.count}/\${payload.totalItems} immagini estratte\`;
                prize.style.background = "linear-gradient(135deg,#334155,#0f172a)";
              }
              cardGrid.innerHTML = "";
              payload.items.forEach((item) => {
                const cell = document.createElement("div");
                const matched = item.matched ? " matched" : "";
                const best = item.bestRow ? " best" : "";
                cell.className = \`cell\${matched}\${best}\`;
                cell.innerHTML = \`<img src="\${item.image_url}" alt="" /><div class="label">\${item.name || ""}</div>\`;
                if (item.matched) {
                  const tick = document.createElement("div");
                  tick.className = "tick";
                  tick.textContent = "✓";
                  cell.appendChild(tick);
                }
                cardGrid.appendChild(cell);
              });
              clearTimeout(hideTimer);
              hideTimer = setTimeout(() => {
                cardCheck.style.display = "none";
                waitingText.style.display = "block";
              }, 20000);
            }
          } catch {}
        });
      }

      connectBtn.addEventListener("click", connect);
    </script>
  </body>
</html>`;
}

async function createLocalServer({ app, decryptFileJson, getEntityStorePath }) {
  const clients = new Map();
  const downloads = new Map();
  const ips = getLocalIps();
  const ip = ips[0];
  let port = DEFAULT_PORT;

  const server = http.createServer(async (req, res) => {
    const url = req.url || "/";
    if (url === "/" || url.startsWith("/mobile")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildMobileHtml());
      return;
    }
    if (url === "/logo.png") {
      try {
        const logoPath = path.join(__dirname, "..", "assets", "logo.png");
        const bytes = await fs.readFile(logoPath);
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(bytes);
        return;
      } catch {
        res.writeHead(404);
        res.end();
        return;
      }
    }
    if (url === "/waiting-video") {
      try {
        const raw = await fs.readFile(getEntityStorePath("AppSettings"), "utf8");
        const parsed = decryptFileJson(raw, "entity:AppSettings");
        const settings = Array.isArray(parsed) ? parsed[0] : null;
        const waitUrl = settings?.waiting_video_url || "https://i.imgur.com/TXcTyF1.mp4";
        if (waitUrl.startsWith("http")) {
          res.writeHead(302, { Location: waitUrl });
          res.end();
          return;
        }
        const filePath = fileUrlToPathMaybe(waitUrl);
        if (filePath) {
          const bytes = await fs.readFile(filePath);
          res.writeHead(200, { "Content-Type": "video/mp4" });
          res.end(bytes);
          return;
        }
      } catch {}
      res.writeHead(404);
      res.end();
      return;
    }
    if (url.startsWith("/download/")) {
      const token = url.replace("/download/", "").split("?")[0];
      const entry = downloads.get(token);
      if (!entry) {
        res.writeHead(404);
        res.end();
        return;
      }
      const bytes = await fs.readFile(entry.filePath);
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${entry.filename}"`,
      });
      res.end(bytes);
      return;
    }
    if (url === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ip, port, url: `http://${ip}:${port}` }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const id = crypto.randomUUID();
    const client = {
      id,
      name: "Telefono",
      ip: req.socket.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
    clients.set(id, { ws, meta: client });

    ws.on("message", (data) => {
      try {
        const payload = JSON.parse(String(data));
        if (payload.type === "hello" && payload.name) {
          client.name = String(payload.name).slice(0, 60);
        }
        client.lastSeen = new Date().toISOString();
      } catch {}
    });

    ws.on("close", () => {
      clients.delete(id);
    });
  });

  await new Promise((resolve, reject) => {
    const tryListen = () => {
      server.listen(port, () => resolve());
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          port += 1;
          tryListen();
        } else {
          reject(err);
        }
      });
    };
    tryListen();
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of downloads.entries()) {
      if (now - entry.createdAt > DOWNLOAD_TTL_MS) {
        downloads.delete(token);
        fs.unlink(entry.filePath).catch(() => {});
      }
    }
  }, 60_000);

  const broadcast = (payload, targetId = null) => {
    for (const [id, client] of clients.entries()) {
      if (targetId && id !== targetId) continue;
      try {
        client.ws.send(JSON.stringify(payload));
      } catch {}
    }
  };

  return {
    getStatus: () => ({ ip, ips, port, url: `http://${ip}:${port}` }),
    getConnections: () => Array.from(clients.values()).map((c) => c.meta),
    pushCards: async ({ projectId, clientId }) => {
      const payload = await buildCardCheckPayload({ app, decryptFileJson, getEntityStorePath, projectId });
      if (!payload) return { ok: false };
      broadcast(payload, clientId || null);
      return { ok: true };
    },
    close: async () => {
      clearInterval(cleanupTimer);
      wss.close();
      server.close();
    },
  };
}

module.exports = { createLocalServer };
