const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");
const Config = require("./public/config.js");
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
  catch (e) { console.error("Save error:", e); tokens.forEach((t) => pending.add(t)); }
  finally { writing = false; }
}
setInterval(writeSaves, 20000);

const NUM_DUCKS = Config.DuckNames.length;
const INCOME = []; const COST = [];
for (let i = 1; i <= NUM_DUCKS; i++) { INCOME.push(Config.DuckIncome(i)); COST.push(Config.DuckCost(i)); }

const newData = () => ({
  Coins: 500, Lemons: 0, Backpack: 0,
  BackpackLvl: 1, SpeedLvl: 1, Workers: 0,
  Ducks: new Array(NUM_DUCKS).fill(0), SeedsHeld: 0, ActiveSeedTier: 1,
  Plots: [
    { planted: false, tier: 0, progress: 0 },
    { planted: false, tier: 0, progress: 0 },
    { planted: false, tier: 0, progress: 0 },
    { planted: false, tier: 0, progress: 0 }
  ],
  Stage: 1, Rebirths: 0, Earned: 0
});

function ensureProg(d) {
  if (!Array.isArray(d.Ducks)) d.Ducks = new Array(NUM_DUCKS).fill(0);
  if (d.Ducks.length < NUM_DUCKS) d.Ducks = d.Ducks.concat(new Array(NUM_DUCKS - d.Ducks.length).fill(0));
  if (!Array.isArray(d.Plots)) d.Plots = newData().Plots;
  d.BackpackLvl = d.BackpackLvl || 1;
  d.SpeedLvl = d.SpeedLvl || 1;
  d.Workers = d.Workers || 0;
  d.Rebirths = d.Rebirths || 0;
}

const totalDucks = (d) => d.Ducks.reduce((a, b) => a + b, 0);
const getCapacity = (d) => 10 + (d.BackpackLvl * 10);
const getWorkerCost = (d) => Math.floor(150 * Math.pow(1.6, d.Workers));
const getUpgradeCost = (lvl) => Math.floor(100 * Math.pow(1.8, lvl));
const getRebirthCost = (d) => Math.floor(50000 * Math.pow(3, d.Rebirths));

function incomePerSec(d) {
  let sum = 0;
  for (let i = 0; i < NUM_DUCKS; i++) if (d.Ducks[i] > 0) sum += d.Ducks[i] * INCOME[i];
  return sum * Config.RebirthMult(d.Rebirths);
}

function handleAction(ws, rec, action, arg) {
  const d = rec.d; ensureProg(d);

  if (action === "PickLemons") {
    const capacity = getCapacity(d);
    if (d.Backpack < capacity) d.Backpack += 1;
  } else if (action === "SellLemons") {
    if (d.Backpack > 0) {
      const value = d.Backpack * Config.Stage(d.Stage).SellPrice * Config.RebirthMult(d.Rebirths);
      d.Coins += value;
      d.Earned += value;
      d.Lemons += d.Backpack;
      d.Backpack = 0;
    }
  } else if (action === "BuyDuckSeed") {
    const tier = Number(arg);
    if (tier >= 1 && tier <= NUM_DUCKS && d.Coins >= COST[tier - 1]) {
      d.Coins -= COST[tier - 1];
      d.SeedsHeld += 1;
      d.ActiveSeedTier = tier;
    }
  } else if (action === "PlantSeed") {
    const plotIdx = Number(arg);
    if (d.SeedsHeld > 0 && d.Plots[plotIdx] && !d.Plots[plotIdx].planted) {
      d.SeedsHeld -= 1;
      d.Plots[plotIdx] = { planted: true, tier: d.ActiveSeedTier || 1, progress: 0 };
    }
  } else if (action === "Upgrade") {
    if (arg === "backpack") {
      const c = getUpgradeCost(d.BackpackLvl);
      if (d.Coins >= c) { d.Coins -= c; d.BackpackLvl++; }
    } else if (arg === "speed") {
      const c = getUpgradeCost(d.SpeedLvl);
      if (d.Coins >= c) { d.Coins -= c; d.SpeedLvl++; }
    } else if (arg === "worker") {
      const c = getWorkerCost(d);
      if (d.Coins >= c) { d.Coins -= c; d.Workers++; }
    } else if (arg === "rebirth") {
      const c = getRebirthCost(d);
      if (d.Coins >= c) {
        d.Coins = 0; d.Backpack = 0; d.Lemons = 0;
        d.Ducks = new Array(NUM_DUCKS).fill(0);
        d.Rebirths += 1;
      }
    }
  } else if (action === "Move") {
    if (typeof arg === "object") rec.pos = { x: arg.x || 0, z: arg.z || 0 };
  }
}

const server = http.createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200); res.end(buf);
  });
});

const wss = new WebSocketServer({ server });
const online = new Map();
const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

function stateFor(rec) {
  const d = rec.d; ensureProg(d);
  return {
    t: "state", Coins: d.Coins, Lemons: d.Lemons, Backpack: d.Backpack, Capacity: getCapacity(d),
    BackpackLvl: d.BackpackLvl, SpeedLvl: d.SpeedLvl, Workers: d.Workers, WorkerCost: getWorkerCost(d),
    UpgradeCostBackpack: getUpgradeCost(d.BackpackLvl), UpgradeCostSpeed: getUpgradeCost(d.SpeedLvl),
    Rebirths: d.Rebirths, RebirthCost: getRebirthCost(d), Multiplier: Config.RebirthMult(d.Rebirths),
    Ducks: d.Ducks, TotalDucks: totalDucks(d), DuckCosts: COST, DuckNames: Config.DuckNames,
    SeedsHeld: d.SeedsHeld, Plots: d.Plots
  };
}

wss.on("connection", (ws) => {
  let rec = null;
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "login" && !rec) {
      const token = String(m.token || "").slice(0, 64);
      let s = saves[token];
      if (!s) s = saves[token] = { name: "Player", d: newData() };
      rec = { token, name: s.name, d: s.d, pos: { x: 0, z: 0 } };
      online.set(ws, rec);
      send(ws, stateFor(rec));
    } else if (m.t === "act") {
      handleAction(ws, rec, String(m.a), m.arg);
      send(ws, stateFor(rec));
    }
  });
  ws.on("close", () => { if (rec) { pending.add(rec.token); online.delete(ws); } });
});

// Server Tick Loop (1000ms)
setInterval(() => {
  for (const [ws, rec] of online) {
    const d = rec.d; ensureProg(d);

    // 1. Duck Passive Income
    const inc = incomePerSec(d);
    if (inc > 0) { d.Coins += inc; d.Earned += inc; }

    // 2. Growing Plots Tick
    d.Plots.forEach(p => {
      if (p.planted) {
        p.progress += 25; // Grows in 4 seconds
        if (p.progress >= 100) {
          d.Ducks[p.tier - 1]++;
          p.planted = false;
          p.progress = 0;
          p.tier = 0;
        }
      }
    });

    // 3. Automated Workers Logic
    if (d.Workers > 0) {
      const cap = getCapacity(d);
      if (d.Backpack + d.Workers <= cap) {
        d.Backpack += d.Workers;
      } else {
        const val = d.Workers * Config.Stage(d.Stage).SellPrice * Config.RebirthMult(d.Rebirths);
        d.Coins += val;
        d.Lemons += d.Workers;
      }
    }

    send(ws, stateFor(rec));
  }
}, 1000);

store.load().then((loaded) => { saves = loaded; server.listen(PORT, () => console.log(`Server live on ${PORT}`)); });
