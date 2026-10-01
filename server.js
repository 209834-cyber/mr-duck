// server.js - Duck & Lemon Tycoon (multiplayer, authoritative)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const Config = require("./public/config.js");
const admin = require("./admin.js");
const store = require("./store.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

// ------------------------------------------------------------------ saving
let saves = {};
const pending = new Set(); // tokens of players who left since the last save
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

// -------------------------------------------------------------- game data
const NUM_DUCKS = Config.DuckNames.length;
const INCOME = []; const COST = [];
for (let i = 1; i <= NUM_DUCKS; i++) { INCOME.push(Config.DuckIncome(i)); COST.push(Config.DuckCost(i)); }
const EGG = {}; Config.EggUpgrades.forEach((u) => (EGG[u.id] = u));

const newData = () => ({
  Coins: 500, Lemons: 0, Ducks: new Array(NUM_DUCKS).fill(0),
  Stage: 1, Rebirths: 0, Earned: 0, World: 1,
  Eggs: 0, EggUp: {}, Ach: [], Streak: 0, LastDay: 0, BestTier: 0,
});

function ensureValidDucks(d) {
  if (!Array.isArray(d.Ducks)) d.Ducks = [];
  if (d.Ducks.length < NUM_DUCKS) d.Ducks = d.Ducks.concat(new Array(NUM_DUCKS - d.Ducks.length).fill(0));
}
function ensureProg(d) {
  ensureValidDucks(d);
  if (!d.World) d.World = 1;
  if (typeof d.Eggs !== "number" || !isFinite(d.Eggs)) d.Eggs = 0;
  if (!d.EggUp || typeof d.EggUp !== "object") d.EggUp = {};
  if (!Array.isArray(d.Ach)) d.Ach = [];
  d.Streak = d.Streak || 0; d.LastDay = d.LastDay || 0; d.BestTier = d.BestTier || 0;
  d.Earned = d.Earned || 0;
}

const lvl = (d, id) => d.EggUp[id] | 0;
const totalDucks = (d) => { ensureValidDucks(d); let t = 0; for (let i = 0; i < NUM_DUCKS; i++) t += d.Ducks[i]; return t; };
const worldMult = (d) => (Config.Worlds[d.World || 1] || Config.Worlds[1]).coinMult;
const worldLemonMult = (d) => (Config.Worlds[d.World || 1] || Config.Worlds[1]).lemonMult;
const achMult = (d) => 1 + 0.02 * d.Ach.length;
const coinMult = (d) => Config.RebirthMult(d.Rebirths) * worldMult(d) * achMult(d) * (1 + 0.25 * lvl(d, "goldenTouch"));
const lemonMult = (d) => worldLemonMult(d) * achMult(d) * (1 + 0.25 * lvl(d, "squeezer"));
const maxTier = (d) => Config.MaxTier(d.Stage, d.Rebirths, d.World);
const offlineCap = (d) => Config.OfflineCapSeconds + 3600 * lvl(d, "timeTraveler");

function incomePerSec(d) {
  ensureValidDucks(d);
  let sum = 0;
  for (let i = 0; i < NUM_DUCKS; i++) if (d.Ducks[i] > 0) sum += d.Ducks[i] * INCOME[i];
  return sum * coinMult(d) * (1 + 0.15 * lvl(d, "training"));
}
const lemonRate = (d) => Config.Stage(d.Stage).LemonsPerSec * lemonMult(d);

function addCoins(d, n) {
  d.Coins += n; d.Earned += n;
  if (!isFinite(d.Coins)) d.Coins = 1e300;
  if (!isFinite(d.Earned)) d.Earned = 1e300;
}
function sellLemons(d) {
  addCoins(d, d.Lemons * Config.Stage(d.Stage).SellPrice * coinMult(d) * admin.mult("coins"));
  d.Lemons = 0;
}
function eggsOnRebirth(d) {
  return Math.floor(Config.RebirthEggs(d.Coins, d.Rebirths + 1) * (1 + 0.1 * lvl(d, "luckyRebirth")) * admin.mult("eggs"));
}

function sanitizeName(s) {
  s = String(s || "").replace(/[^\p{L}\p{N} _\-]/gu, "").trim().slice(0, 16);
  return s || "Duckling" + Math.floor(Math.random() * 9999);
}

// buys a duck; if the pond is full, replaces the weakest duck when the new one is better
function buyDuck(d, tier) {
  if (!Number.isInteger(tier) || tier < 1 || tier > NUM_DUCKS || tier > maxTier(d)) return false;
  const cost = COST[tier - 1];
  if (d.Coins < cost) return false;
  if (totalDucks(d) >= Config.MaxSlots(d.Stage)) {
    let low = -1;
    for (let i = 0; i < NUM_DUCKS; i++) if (d.Ducks[i] > 0) { low = i; break; }
    if (low === -1 || low + 1 >= tier) return false;
    d.Ducks[low]--;
  }
  d.Coins -= cost;
  d.Ducks[tier - 1]++;
  if (tier > d.BestTier) d.BestTier = tier;
  return true;
}
function buyBestDuck(d) {
  for (let t = Math.min(maxTier(d), NUM_DUCKS); t >= 1; t--) {
    if (COST[t - 1] <= d.Coins) return buyDuck(d, t);
  }
  return false;
}
function upgradeStage(d) {
  const next = d.Stage + 1;
  if (next > Config.StageNames.length) return false;
  const cost = Config.Stage(next).Cost;
  if (d.Coins < cost) return false;
  d.Coins -= cost; d.Stage = next;
  return true;
}

// ------------------------------------------------------------ achievements
function achOk(d, a) {
  switch (a.type) {
    case "earned": return d.Earned >= a.value;
    case "rebirths": return d.Rebirths >= a.value;
    case "stage": return d.Stage >= a.value;
    case "tier": return d.BestTier >= a.value;
    case "ducks": return totalDucks(d) >= a.value;
    case "streak": return d.Streak >= a.value;
  }
  return false;
}
function checkAchievements(ws, rec) {
  const d = rec.d;
  for (const a of Config.Achievements) {
    if (!d.Ach.includes(a.id) && achOk(d, a)) {
      d.Ach.push(a.id);
      d.Eggs += 1;
      send(ws, { t: "toast", msg: `🏆 Achievement: ${a.name}  (+2% coins, +1 🥚)` });
    }
  }
}

// ------------------------------------------------------------ golden duck
let golden = null; // { id, until, minutes }
let nextGolden = Date.now() + (6 + Math.random() * 6) * 60000;
function spawnGolden(minutes) {
  golden = { id: Math.random().toString(36).slice(2, 8), until: Date.now() + 20000, minutes };
  broadcast({ t: "golden", id: golden.id, secs: 20 });
  broadcast({ t: "chat", name: "🌟", msg: "A GOLDEN DUCK appeared! Click it fast!" });
}

// ----------------------------------------------------------------- actions
const muted = new Set();

function handleAction(ws, rec, action, arg) {
  const d = rec.d;
  ensureProg(d);

  if (action === "PickLemons") {
    const now = Date.now();
    if (now - (rec.lastPick || 0) < 50) return;
    rec.lastPick = now;
    d.Lemons += Config.Stage(d.Stage).PickAmount * lemonMult(d) * admin.mult("lemons");
  } else if (action === "SellLemons") {
    sellLemons(d);
  } else if (action === "BuyDuck") {
    buyDuck(d, Number(arg));
  } else if (action === "UpgradeLemon") {
    upgradeStage(d);
  } else if (action === "Rebirth") {
    if (d.Coins < Config.RebirthCost(d.Rebirths)) return;
    const eggs = eggsOnRebirth(d);
    const fresh = newData();
    fresh.Rebirths = d.Rebirths + 1;
    fresh.Earned = d.Earned;
    fresh.World = d.World;
    fresh.Eggs = d.Eggs + eggs;
    fresh.EggUp = d.EggUp; fresh.Ach = d.Ach; fresh.Streak = d.Streak;
    fresh.LastDay = d.LastDay; fresh.BestTier = d.BestTier;
    fresh.Coins = 500 * Math.pow(4, lvl(d, "starterKit"));
    fresh.Ducks[0] = fresh.Rebirths; // faster restart: 1 starter duck per rebirth
    rec.d = saves[rec.token].d = fresh;
    send(ws, { t: "toast", msg: `🔄 Rebirth #${fresh.Rebirths}! You earned ${eggs} 🥚 Golden Eggs.` });
  } else if (action === "SwitchWorld") {
    const target = Number(arg);
    const w = Config.Worlds[target];
    if (w && d.Rebirths >= w.unlockRebirths) d.World = target;
  } else if (action === "BuyEgg") {
    const up = EGG[String(arg)];
    if (!up) return;
    const level = lvl(d, up.id);
    if (level >= up.max) return;
    const cost = Config.EggCost(up, level);
    if (d.Eggs < cost) return;
    d.Eggs -= cost;
    d.EggUp[up.id] = level + 1;
  } else if (action === "ClaimDaily") {
    const today = Math.floor(Date.now() / 86400000);
    if (d.LastDay === today) return;
    d.Streak = d.LastDay === today - 1 ? d.Streak + 1 : 1;
    d.LastDay = today;
    const bonus = 1 + Math.min(d.Streak, 30) * 0.1;
    const coins = Math.max(1000, incomePerSec(d) * Config.DailyMinutesOfIncome * 60) * bonus;
    const eggs = 1 + (d.Streak % 7 === 0 ? 5 : 0);
    addCoins(d, coins); d.Eggs += eggs;
    send(ws, { t: "toast", msg: `🎁 Daily reward (day ${d.Streak}): ${Config.Format(coins)} coins + ${eggs} 🥚` });
  } else if (action === "ClaimGolden") {
    if (golden && String(arg) === golden.id && Date.now() < golden.until) {
      const coins = Math.max(5000, incomePerSec(d) * golden.minutes * 60);
      addCoins(d, coins); d.Eggs += 1;
      broadcast({ t: "chat", name: "🌟", msg: `${rec.name} caught the golden duck and won ${Config.Format(coins)} coins!` });
      broadcast({ t: "golden_end" });
      golden = null;
    }
  }
  checkAchievements(ws, rec);
}

// ------------------------------------------------------------- web server
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
const online = new Map(); // ws -> rec

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (obj) => { for (const ws of online.keys()) send(ws, obj); };

function stateFor(rec) {
  const d = rec.d;
  ensureProg(d);
  const today = Math.floor(Date.now() / 86400000);
  return {
    t: "state", Coins: d.Coins, Lemons: d.Lemons, Ducks: d.Ducks, Stage: d.Stage,
    Rebirths: d.Rebirths, World: d.World || 1, Income: incomePerSec(d) * admin.mult("coins"),
    LemonRate: lemonRate(d),
    Slots: Config.MaxSlots(d.Stage), Total: totalDucks(d), Buffs: admin.snapshot(),
    Prog: {
      Eggs: d.Eggs, EggUp: d.EggUp, Ach: d.Ach, Streak: d.Streak,
      CanDaily: d.LastDay !== today, MaxTier: maxTier(d), BestTier: d.BestTier,
      EggsOnRebirth: eggsOnRebirth(d), CoinMult: coinMult(d), Earned: d.Earned,
    },
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
        ensureProg(s.d);
        const secs = Math.min((Date.now() - (s.lastSeen || Date.now())) / 1000, offlineCap(s.d));
        offline = Math.floor(incomePerSec(s.d) * secs * Config.OfflineRate);
        if (offline > 0) addCoins(s.d, offline);
      }
      rec = { token, name, d: s.d, tick: 0 };
      online.set(ws, rec);
      send(ws, { t: "welcome", name, offline });
      send(ws, stateFor(rec));
      broadcast({ t: "chat", name: "🦆", msg: name + " joined the pond!" });
    } else if (!rec) {
      return;
    } else if (m.t === "act") {
      handleAction(ws, rec, String(m.a), m.arg);
      send(ws, stateFor(rec));
    } else if (m.t === "admin_login") {
      const r = admin.tryLogin(ip, m.code);
      rec.admin = r.ok;
      send(ws, r.ok ? { t: "admin_ok", msg: "login" } : { t: "admin_err", msg: r.msg });
      if (r.ok) console.log("Admin login:", rec.name);
    } else if (m.t === "admin") {
      if (!rec.admin) return send(ws, { t: "admin_err", msg: "Not authorised." });
      const ctx = {
        online, Config, saves, broadcast, send, addCoins, totalDucks, incomePerSec, lemonRate,
        newData, ensureProg, muted, spawnGolden, upgradeStage, writeSaves,
        replaceData: (r, nd) => { r.d = saves[r.token].d = nd; },
      };
      const result = admin.handle(m, ctx);
      console.log("Admin cmd:", rec.name, m.cmd);
      if (result && typeof result === "object") send(ws, { t: "admin_ok", msg: result.msg, data: result.data });
      else send(ws, { t: "admin_ok", msg: result });
      for (const [w, r] of online) { checkAchievements(w, r); send(w, stateFor(r)); }
    } else if (m.t === "chat") {
      const now = Date.now();
      if (now - lastChat < 1000 || muted.has(rec.token)) return;
      lastChat = now;
      const msg = String(m.msg || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
      if (msg) broadcast({ t: "chat", name: rec.name, msg });
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

// ------------------------------------------------------------- main loop
setInterval(() => {
  for (const [ws, rec] of online) {
    const d = rec.d;
    rec.tick++;
    addCoins(d, incomePerSec(d) * admin.mult("coins"));
    d.Lemons += lemonRate(d) * admin.mult("lemons");

    // automation unlocked in the Egg Shop
    const aS = lvl(d, "autoSeller"), aB = lvl(d, "autoBuyer");
    if (aS > 0 && rec.tick % Math.max(2, 13 - aS) === 0) sellLemons(d);
    if (aB > 0 && rec.tick % Math.max(1, 6 - aB) === 0) buyBestDuck(d);
    if (lvl(d, "autoStage") > 0) upgradeStage(d);

    checkAchievements(ws, rec);
    if (saves[rec.token]) saves[rec.token].lastSeen = Date.now();
    send(ws, stateFor(rec));
  }
  if (golden && Date.now() > golden.until) { golden = null; broadcast({ t: "golden_end" }); }
  if (online.size && !golden && Date.now() > nextGolden) {
    spawnGolden(5);
    nextGolden = Date.now() + (8 + Math.random() * 8) * 60000;
  }
}, 1000);

setInterval(() => broadcast(boardMsg()), 3000);

store.load()
  .then((loaded) => {
    saves = loaded;
    server.listen(PORT, () => console.log(`Duck & Lemon Tycoon running on http://localhost:${PORT}`));
  })
  .catch((e) => { console.error(e.message); process.exit(1); });
