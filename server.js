const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");

// 12 Tier Duck Progression Engine
const DUCK_TIERS = [
  { name: "Yellow Duck", cost: 100, income: 5 },
  { name: "Rubber Duck", cost: 800, income: 45 },
  { name: "Mallard", cost: 5000, income: 300 },
  { name: "Golden Duck", cost: 35000, income: 2200 },
  { name: "Cyber Duck", cost: 250000, income: 16000 },
  { name: "Cosmic Duck", cost: 1800000, income: 120000 },
  { name: "Void Duck", cost: 15000000, income: 950000 },
  { name: "Nebula Duck", cost: 120000000, income: 8000000 },
  { name: "Quantum Duck", cost: 1000000000, income: 70000000 },
  { name: "Singularity Duck", cost: 8500000000, income: 600000000 },
  { name: "Celestial Duck", cost: 75000000000, income: 5500000000 },
  { name: "Multiversal Duck", cost: 700000000000, income: 50000000000 }
];

let saves = {};

const newData = () => ({
  Coins: 200, Lemons: 0, Backpack: 0,
  BackpackLvl: 1, SpeedLvl: 1, Workers: 0,
  Ducks: new Array(DUCK_TIERS.length).fill(0),
  SeedsHeld: 0, ActiveSeedTier: 1,
  Plots: Array.from({ length: 8 }, () => ({ planted: false, tier: 0, progress: 0 })),
  Rebirths: 0, RebirthTokens: 0,
  Perks: { IncomeBoost: 0, SpeedBoost: 0, AutoPlant: 0, SeedDiscount: 0 }
});

function getCapacity(d) { return 10 + (d.BackpackLvl * 15); }
function getUpgradeCost(lvl) { return Math.floor(100 * Math.pow(1.75, lvl - 1)); }
function getWorkerCost(d) { return Math.floor(250 * Math.pow(1.65, d.Workers)); }

// Uncapped Rebirth Formula
function getRebirthCost(rebirths) {
  return Math.floor(100000 * Math.pow(2.8, rebirths));
}

function getRebirthMult(d) {
  const baseMult = 1 + (d.Rebirths * 2.5);
  const perkMult = 1 + (d.Perks.IncomeBoost * 0.5);
  return baseMult * perkMult;
}

function incomePerSec(d) {
  let sum = 0;
  for (let i = 0; i < DUCK_TIERS.length; i++) {
    if (d.Ducks[i] > 0) sum += d.Ducks[i] * DUCK_TIERS[i].income;
  }
  return sum * getRebirthMult(d);
}

function handleAction(ws, rec, action, arg) {
  const d = rec.d;

  if (action === "PickLemons") {
    const cap = getCapacity(d);
    if (d.Backpack < cap) d.Backpack += 1;
  } else if (action === "SellLemons") {
    if (d.Backpack > 0) {
      const val = d.Backpack * 25 * getRebirthMult(d);
      d.Coins += val; d.Lemons += d.Backpack; d.Backpack = 0;
    }
  } else if (action === "BuyDuckSeed") {
    const tier = Number(arg);
    const disc = 1 - (d.Perks.SeedDiscount * 0.1);
    const cost = Math.floor(DUCK_TIERS[tier - 1].cost * disc);
    if (tier >= 1 && tier <= DUCK_TIERS.length && d.Coins >= cost) {
      d.Coins -= cost; d.SeedsHeld += 1; d.ActiveSeedTier = tier;
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
    }
  } else if (action === "PerformRebirth") {
    const cost = getRebirthCost(d.Rebirths);
    if (d.Coins >= cost) {
      d.Coins = 0; d.Backpack = 0;
      d.Ducks = new Array(DUCK_TIERS.length).fill(0);
      d.Plots.forEach(p => { p.planted = false; p.progress = 0; });
      d.Rebirths += 1;
      d.RebirthTokens += 2; // Earn tokens
    }
  } else if (action === "BuyPerk") {
    const perk = String(arg);
    const perkCost = ((d.Perks[perk] || 0) + 1) * 2;
    if (d.Perks.hasOwnProperty(perk) && d.RebirthTokens >= perkCost) {
      d.RebirthTokens -= perkCost;
      d.Perks[perk] = (d.Perks[perk] || 0) + 1;
    }
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
  const d = rec.d;
  return {
    t: "state", Coins: d.Coins, Lemons: d.Lemons, Backpack: d.Backpack, Capacity: getCapacity(d),
    BackpackLvl: d.BackpackLvl, SpeedLvl: d.SpeedLvl + (d.Perks.SpeedBoost || 0), Workers: d.Workers, WorkerCost: getWorkerCost(d),
    UpgradeCostBackpack: getUpgradeCost(d.BackpackLvl), UpgradeCostSpeed: getUpgradeCost(d.SpeedLvl),
    Rebirths: d.Rebirths, RebirthCost: getRebirthCost(d.Rebirths), Multiplier: getRebirthMult(d),
    RebirthTokens: d.RebirthTokens, Perks: d.Perks,
    Ducks: d.Ducks, DuckTiers: DUCK_TIERS, SeedsHeld: d.SeedsHeld, Plots: d.Plots
  };
}

wss.on("connection", (ws) => {
  let rec = null;
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "login" && !rec) {
      const token = String(m.token || "").slice(0, 64);
      let s = saves[token];
      if (!s) s = saves[token] = { d: newData() };
      rec = { token, d: s.d };
      online.set(ws, rec);
      send(ws, stateFor(rec));
    } else if (m.t === "act") {
      handleAction(ws, rec, String(m.a), m.arg);
      send(ws, stateFor(rec));
    }
  });
  ws.on("close", () => { if (rec) online.delete(ws); });
});

// Server Tick (1000ms)
setInterval(() => {
  for (const [ws, rec] of online) {
    const d = rec.d;
    d.Coins += incomePerSec(d);

    // Plot Growth Logic
    d.Plots.forEach(p => {
      if (p.planted) {
        p.progress += 25; // 4 seconds per seed
        if (p.progress >= 100) {
          d.Ducks[p.tier - 1]++;
          p.planted = false; p.progress = 0; p.tier = 0;
        }
      }
    });

    // Auto Workers Logic
    if (d.Workers > 0) {
      const cap = getCapacity(d);
      if (d.Backpack + d.Workers <= cap) d.Backpack += d.Workers;
      else { d.Coins += d.Workers * 25 * getRebirthMult(d); d.Lemons += d.Workers; }
    }

    send(ws, stateFor(rec));
  }
}, 1000);

server.listen(PORT, () => console.log(`2D Game Server running on port ${PORT}`));
