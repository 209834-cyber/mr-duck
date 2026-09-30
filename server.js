// server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const Config = require("./public/config.js");
const admin = require("./admin.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const SAVE_FILE = path.join(process.env.DATA_DIR || __dirname, "saves.json");

let saves = {};
try { saves = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8")); } catch {}

let dirty = false;
function writeSaves() {
  if (!dirty) return;
  dirty = false;
  fs.writeFile(SAVE_FILE + ".tmp", JSON.stringify(saves), (err) => {
    if (err) return console.error("Save error:", err);
    fs.rename(SAVE_FILE + ".tmp", SAVE_FILE, () => {});
  });
}
setInterval(writeSaves, 15000);

function flushAndExit() {
  try { fs.writeFileSync(SAVE_FILE, JSON.stringify(saves)); } catch {}
  process.exit(0);
}
process.on("SIGINT", flushAndExit);
process.on("SIGTERM", flushAndExit);

// ---- game logic ---------------------------------------------------------
const NUM_DUCKS = Config.DuckNames.length; // 1000

const newData = () => ({
  Coins: 100, Lemons: 0, Ducks: new Array(NUM_DUCKS).fill(0),
  Stage: 1, Rebirths: 0, Earned: 0, World: 1,
});

function ensureValidDucks(d) {
  if (!Array.isArray(d.Ducks)) d.Ducks = [];
  if (d.Ducks.length < NUM_DUCKS) {
    const padded = new Array(NUM_DUCKS - d.Ducks.length).fill(0);
    d.Ducks = d.Ducks.concat(padded);
  }
}

const totalDucks = (d) => {
  ensureValidDucks(d);
  let total = 0;
  for (let i = 0; i < d.Ducks.length; i++) total += d.Ducks[i];
  return total;
};

const worldMult = (d) => Config.Worlds[d.World || 1]?.coinMult || 1;
const worldLemonMult = (d) => Config.Worlds[d.World || 1]?.lemonMult || 1;

const incomePerSec = (d) => {
  ensureValidDucks(d);
  let sum = 0;
  for (let i = 0; i < NUM_DUCKS; i++) {
    if (d.Ducks[i] > 0) {
      sum += d.Ducks[i] * Config.DuckIncome(i + 1);
    }
  }
  return sum * Config.RebirthMult(d.Rebirths) * worldMult(d);
};

function addCoins(d, n) { d.Coins += n; d.Earned += n; }

function sanitizeName(s) {
  s = String(s || "").replace(/[^\p{L}\p{N} _\-]/gu, "").trim().slice(0, 16);
  return s || "Duckling" + Math.floor(Math.random() * 9999);
}

function handleAction(rec, action, arg) {
  const d = rec.d;
  if (!d.World) d.World = 1;
  ensureValidDucks(d);

  if (action === "PickLemons") {
    const now = Date.now();
    if (now - (rec.lastPick || 0) < 100) return;
    rec.lastPick = now;
    d.Lemons += Config.Stage(d.Stage).PickAmount * worldLemonMult(d) * admin.mult("lemons");
  } else if (action === "SellLemons") {
    addCoins(d, d.Lemons * Config.Stage(d.Stage).SellPrice * Config.RebirthMult(d.Rebirths) * worldMult(d) * admin.mult("coins"));
    d.Lemons = 0;
  } else if (action === "BuyDuck") {
    const tier = Number(arg);
    if (!Number.isInteger(tier) || tier < 1 || tier > NUM_DUCKS) return;
    if (totalDucks(d) >= Config.MaxSlots(d.Stage)) return;
    const cost = Config.DuckCost(tier);
    if (d.Coins < cost) return;
    d.Coins -= cost;
    d.Ducks[tier - 1]++;
  } else if (action === "UpgradeLemon") {
    const next = d.Stage + 1;
    if (next > Config.StageNames.length) return;
    const cost = Config.Stage(next).Cost;
    if (d.Coins < cost) return;
    d.Coins -= cost;
    d.Stage = next;
  } else if (action === "Rebirth") {
    if (d.Coins < Config.RebirthCost(d.Rebirths)) return;
    const fresh = newData();
    fresh.Rebirths = d.Rebirths + 1;
    fresh.Earned = d.Earned;
    fresh.World = d.World;
    rec.d = saves[rec.token].d = fresh;
  } else if (action === "SwitchWorld") {
    const targetWorld = Number(arg);
    const wConfig = Config.Worlds[targetWorld];
    if (wConfig && d.Rebirths >= wConfig.unlockRebirths) {
      d.World = targetWorld;
    }
  }
  dirty = true;
}

// ---- networking ---------------------------------------------------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/healthz") { res.writeHead(200); return res.end("ok"); }
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

// Expanded maxPayload to 64KB for 1000 duck data arrays
const wss = new WebSocketServer({ server, maxPayload: 65536 });
const online = new Map();

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (obj) => { for (const ws of online.keys()) send(ws, obj); };

function stateFor(rec) {
  const d = rec.d;
  ensureValidDucks(d);
  return {
    t: "state", Coins: d.Coins, Lemons: d.Lemons, Ducks: d.Ducks, Stage: d.Stage,
    Rebirths: d.Rebirths, World: d.World || 1, Income: incomePerSec(d),
    LemonRate: Config.Stage(d.Stage).LemonsPerSec * worldLemonMult(d),
    Slots: Config.MaxSlots(d.Stage), Total: totalDucks(d), Buffs: admin.snapshot(),
  };
}

function boardMsg() {
  const rows = Object.values(saves)
    .sort((a, b) => b.d.Rebirths - a.d.Rebirths || b.d.Earned - a.d.Earned)
    .slice(0, 10)
    .map((s) => ({ name: s.name, rebirths: s.d.Rebirths, earned: s.d.Earned, world: s.d.World || 1 }));
  const players = [...online.values()].map((r) => ({
    name: r.name, ducks: totalDucks(r.d), stage: r.d.Stage, rebirths: r.d.Rebirths, world: r.d.World || 1,
  }));
  return { t: "board", rows, players };
}

wss.on("connection", (ws, req) => {
  let rec = null;
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  let lastChat = 0;

  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === "login" && !rec) {
      const token = String(m.token || "").slice(0, 64);
      if (token.length < 16) return send(ws, { t: "err", msg: "Bad token" });
      const name = sanitizeName(m.name);
      let s = saves[token];
      let offline = 0;
      if (!s) {
        s = saves[token] = { name, d: newData(), lastSeen: Date.now() };
      } else {
        s.name = name;
        if (!s.d.World) s.d.World = 1;
        ensureValidDucks(s.d);
        const secs = Math.min((Date.now() - (s.lastSeen || Date.now())) / 1000, Config.OfflineCapSeconds);
        offline = Math.floor(incomePerSec(s.d) * secs * Config.OfflineRate);
        if (offline > 0) addCoins(s.d, offline);
      }
      rec = { token, name, d: s.d };
      online.set(ws, rec);
      dirty = true;
      send(ws, { t: "welcome", name, offline });
      send(ws, stateFor(rec));
      broadcast({ t: "chat", name: "🦆", msg: name + " joined the pond!" });
    } else if (!rec) {
      return;
    } else if (m.t === "act") {
      handleAction(rec, String(m.a), m.arg);
      send(ws, stateFor(rec));
    } else if (m.t === "admin_login") {
      const r = admin.tryLogin(ip, m.code);
      rec.admin = r.ok;
      send(ws, r.ok ? { t: "admin_ok", msg: "login" } : { t: "admin_err", msg: r.msg });
      if (r.ok) console.log("Admin login:", rec.name);
    } else if (m.t === "admin") {
      if (!rec.admin) return send(ws, { t: "admin_err", msg: "Not authorised." });
      const result = admin.handle(m, { online, Config, addCoins, totalDucks, broadcast, saves });
      console.log("Admin cmd:", rec.name, m.cmd);
      send(ws, { t: "admin_ok", msg: result });
      for (const [w, r] of online) send(w, stateFor(r));
      dirty = true;
    } else if (m.t === "chat") {
      const now = Date.now();
      if (now - lastChat < 1000) return;
      lastChat = now;
      const msg = String(m.msg || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
      if (msg) broadcast({ t: "chat", name: rec.name, msg });
    }
  });

  ws.on("close", () => {
    if (rec) {
      saves[rec.token].lastSeen = Date.now();
      dirty = true;
      online.delete(ws);
    }
  });
});

setInterval(() => {
  for (const [ws, rec] of online) {
    const d = rec.d;
    addCoins(d, incomePerSec(d) * admin.mult("coins"));
    d.Lemons += Config.Stage(d.Stage).LemonsPerSec * worldLemonMult(d) * admin.mult("lemons");
    saves[rec.token].lastSeen = Date.now();
    send(ws, stateFor(rec));
  }
  dirty = true;
}, 1000);

setInterval(() => broadcast(boardMsg()), 3000);

server.listen(PORT, () => console.log(`Duck & Lemon Tycoon running on http://localhost:${PORT}`));
