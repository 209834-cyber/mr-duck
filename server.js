// server.js - Duck & Lemon Tycoon Server
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const Config = require("./public/config.js");
const admin = require("./admin.js");
const store = require("./store.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

let saves = {};
const pending = new Set();
let writing = false;

async function writeSaves() {
  if (writing) return;
  const tokens = new Set(pending);
  pending.clear();
  for (const rec of online.values()) tokens.add(rec.token);
  if (!tokens.size) return;
  writing = true;
  try { await store.save([...tokens], saves); }
  catch (e) { console.error("Save error:", e.message); tokens.forEach((t) => pending.add(t)); }
  finally { writing = false; }
}
setInterval(writeSaves, 20000);

let exiting = false;
async function flushAndExit() {
  if (exiting) return;
  exiting = true;
  setTimeout(() => process.exit(0), 8000).unref();
  writing = false;
  await writeSaves();
  process.exit(0);
}
process.on("SIGINT", flushAndExit);
process.on("SIGTERM", flushAndExit);

const NUM_DUCKS = Config.DuckNames.length;
const INCOME = []; const COST = [];
for (let i = 1; i <= NUM_DUCKS; i++) { INCOME.push(Config.DuckIncome(i)); COST.push(Config.DuckCost(i)); }

const newData = () => ({
  Coins: 500, Lemons: 0, Ducks: new Array(NUM_DUCKS).fill(0),
  Stage: 1, Rebirths: 0, SuperRebirths: 0, UltraRebirths: 0, Earned: 0, World: 1,
  Eggs: 0, EggUp: {}, Ach: [], Streak: 0, LastDay: 0, BestTier: 0,
});

function ensureValidDucks(d) {
  if (!Array.isArray(d.Ducks)) d.Ducks = [];
  if (d.Ducks.length < NUM_DUCKS) d.Ducks = d.Ducks.concat(new Array(NUM_DUCKS - d.Ducks.length).fill(0));
}
function ensureProg(d) {
  ensureValidDucks(d);
  if (!d.World) d.World = 1;
  if (d.SuperRebirths === undefined) d.SuperRebirths = 0;
  if (d.UltraRebirths === undefined) d.UltraRebirths = 0;
  if (typeof d.Eggs !== "number" || !isFinite(d.Eggs)) d.Eggs = 0;
  if (!d.EggUp || typeof d.EggUp !== "object") d.EggUp = {};
  if (!Array.isArray(d.Ach)) d.Ach = [];
  d.Streak = d.Streak || 0; d.LastDay = d.LastDay || 0; d.BestTier = d.BestTier || 0;
  d.Earned = d.Earned || 0;
}

const totalDucks = (d) => { ensureValidDucks(d); let t = 0; for (let i = 0; i < NUM_DUCKS; i++) t += d.Ducks[i]; return t; };
const worldMult = (d) => (Config.Worlds[d.World || 1] || Config.Worlds[1]).coinMult;
const worldLemonMult = (d) => (Config.Worlds[d.World || 1] || Config.Worlds[1]).lemonMult;

function incomePerSec(d) {
  ensureValidDucks(d);
  let sum = 0;
  for (let i = 0; i < NUM_DUCKS; i++) if (d.Ducks[i] > 0) sum += d.Ducks[i] * INCOME[i];
  return sum * Config.RebirthMult(d.Rebirths, d.SuperRebirths || 0, d.UltraRebirths || 0) * worldMult(d);
}
const lemonRate = (d) => Config.Stage(d.Stage).LemonsPerSec * worldLemonMult(d);

function addCoins(d, n) {
  d.Coins += n; d.Earned += n;
  if (!isFinite(d.Coins)) d.Coins = 1e308;
  if (!isFinite(d.Earned)) d.Earned = 1e308;
}
function sellLemons(d) {
  addCoins(d, d.Lemons * Config.Stage(d.Stage).SellPrice * Config.RebirthMult(d.Rebirths, d.SuperRebirths, d.UltraRebirths) * worldMult(d) * admin.mult("coins"));
  d.Lemons = 0;
}

function sanitizeName(s) {
  s = String(s || "").replace(/[^\p{L}\p{N} _\-]/gu, "").trim().slice(0, 16);
  return s || "Duckling" + Math.floor(Math.random() * 9999);
}

function buyDuck(d, tier) {
  if (!Number.isInteger(tier) || tier < 1 || tier > NUM_DUCKS) return false;
  const cost = COST[tier - 1];
  if (d.Coins < cost) return false;
  if (totalDucks(d) >= Config.MaxSlots(d.Stage)) return false;
  d.Coins -= cost;
  d.Ducks[tier - 1]++;
  if (tier > d.BestTier) d.BestTier = tier;
  return true;
}

function sellDuck(d, tier) {
  if (!Number.isInteger(tier) || tier < 1 || tier > NUM_DUCKS) return false;
  if (d.Ducks[tier - 1] <= 0) return false;
  const refund = Math.floor(COST[tier - 1] * 0.7);
  d.Ducks[tier - 1]--;
  addCoins(d, refund);
  return true;
}

function upgradeStage(d) {
  const next = d.Stage + 1;
  if (next > Config.StageNames.length) return false;
  const cost = Config.Stage(next).Cost;
  if (d.Coins < cost) return false;
  d.Coins -= cost; d.Stage = next;
  return true;
}

const muted = new Set();

function handleAction(ws, rec, action, arg) {
  const d = rec.d;
  ensureProg(d);

  if (action === "PickLemons") {
    const now = Date.now();
    if (now - (rec.lastPick || 0) < 50) return;
    rec.lastPick = now;
    d.Lemons += Config.Stage(d.Stage).PickAmount * worldLemonMult(d) * admin.mult("lemons");
  } else if (action === "SellLemons") {
    sellLemons(d);
  } else if (action === "BuyDuck") {
    buyDuck(d, Number(arg));
  } else if (action === "SellDuck") {
    sellDuck(d, Number(arg));
  } else if (action === "UpgradeLemon") {
    upgradeStage(d);
  } else if (action === "Rebirth") {
    if (d.Coins < Config.RebirthCost(d.Rebirths)) return;
    const fresh = newData();
    fresh.Rebirths = d.Rebirths + 1;
    fresh.SuperRebirths = d.SuperRebirths;
    fresh.UltraRebirths = d.UltraRebirths;
    fresh.Earned = d.Earned;
    fresh.World = d.World;
    fresh.Ducks[0] = fresh.Rebirths;
    rec.d = saves[rec.token].d = fresh;
    send(ws, { t: "toast", msg: `🔄 Rebirth #${fresh.Rebirths}!` });
  } else if (action === "SuperRebirth") {
    const cost = Config.SuperRebirthCost(d.SuperRebirths);
    if (d.Rebirths < cost) return;
    const fresh = newData();
    fresh.Rebirths = 0;
    fresh.SuperRebirths = d.SuperRebirths + 1;
    fresh.UltraRebirths = d.UltraRebirths;
    fresh.Earned = d.Earned;
    fresh.World = d.World;
    fresh.Ducks[0] = 5;
    rec.d = saves[rec.token].d = fresh;
    send(ws, { t: "toast", msg: `⚡ Super Rebirth #${fresh.SuperRebirths}!` });
  } else if (action === "UltraRebirth") {
    const cost = Config.UltraRebirthCost(d.UltraRebirths);
    if (d.SuperRebirths < cost) return;
    const fresh = newData();
    fresh.Rebirths = 0;
    fresh.SuperRebirths = 0;
    fresh.UltraRebirths = d.UltraRebirths + 1;
    fresh.Earned = d.Earned;
    fresh.World = d.World;
    fresh.Ducks[0] = 25;
    rec.d = saves[rec.token].d = fresh;
    send(ws, { t: "toast", msg: `🌟 Ultra Rebirth #${fresh.UltraRebirths}!` });
  } else if (action === "SwitchWorld") {
    const target = Number(arg);
    const w = Config.Worlds[target];
    if (w && d.Rebirths >= w.unlockRebirths) d.World = target;
  }
}

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

const wss = new WebSocketServer({ server, maxPayload: 65536 });
const online = new Map();

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (obj) => { for (const ws of online.keys()) send(ws, obj); };

function stateFor(rec) {
  const d = rec.d;
  ensureProg(d);
  return {
    t: "state", Coins: d.Coins, Lemons: d.Lemons, Ducks: d.Ducks, Stage: d.Stage,
    Rebirths: d.Rebirths, SuperRebirths: d.SuperRebirths || 0, UltraRebirths: d.UltraRebirths || 0,
    World: d.World || 1, Income: incomePerSec(d) * admin.mult("coins"),
    LemonRate: lemonRate(d), Slots: Config.MaxSlots(d.Stage), Total: totalDucks(d), Buffs: admin.snapshot(),
  };
}

wss.on("connection", (ws, req) => {
  let rec = null;
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === "login" && !rec) {
      const token = String(m.token || "").slice(0, 64);
      if (token.length < 16) return send(ws, { t: "err", msg: "Bad token" });
      const name = sanitizeName(m.name);
      let s = saves[token];
      if (!s) {
        s = saves[token] = { name, d: newData(), lastSeen: Date.now() };
      } else {
        s.name = name;
        ensureProg(s.d);
      }
      rec = { token, name, d: s.d, tick: 0 };
      online.set(ws, rec);
      send(ws, stateFor(rec));
    } else if (m.t === "act") {
      handleAction(ws, rec, String(m.a), m.arg);
      send(ws, stateFor(rec));
    } else if (m.t === "admin") {
      if (!rec.admin) return send(ws, { t: "admin_err", msg: "Not authorised." });
      const ctx = { online, Config, saves, broadcast, send, addCoins, totalDucks, incomePerSec, lemonRate, writeSaves };
      const result = admin.handle(m, ctx);
      send(ws, { t: "admin_ok", msg: result });
    }
  });

  ws.on("close", () => {
    if (rec) {
      if (saves[rec.token]) saves[rec.token].lastSeen = Date.now();
      pending.add(rec.token);
      online.delete(ws);
    }
  });
});

setInterval(() => {
  for (const [ws, rec] of online) {
    const d = rec.d;
    addCoins(d, incomePerSec(d) * admin.mult("coins"));
    d.Lemons += lemonRate(d) * admin.mult("lemons");
    send(ws, stateFor(rec));
  }
}, 1000);

store.load().then((loaded) => {
  saves = loaded;
  server.listen(PORT, () => console.log(`Tycoon online on port ${PORT}`));
});
