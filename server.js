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
  catch (e) { console.error("Save error:", e); tokens.forEach((t) => pending.add(t)); }
  finally { writing = false; }
}
setInterval(writeSaves, 20000);

const NUM_DUCKS = Config.DuckNames.length;
const INCOME = []; const COST = [];
for (let i = 1; i <= NUM_DUCKS; i++) { INCOME.push(Config.DuckIncome(i)); COST.push(Config.DuckCost(i)); }

const newData = () => ({
  Coins: 500, Lemons: 0, Backpack: 0, Ducks: new Array(NUM_DUCKS).fill(0),
  Stage: 1, Rebirths: 0, Earned: 0, World: 1
});

function ensureProg(d) {
  if (!Array.isArray(d.Ducks)) d.Ducks = new Array(NUM_DUCKS).fill(0);
  if (d.Ducks.length < NUM_DUCKS) d.Ducks = d.Ducks.concat(new Array(NUM_DUCKS - d.Ducks.length).fill(0));
  d.World = d.World || 1;
  d.Backpack = d.Backpack || 0;
  d.Earned = d.Earned || 0;
}

const totalDucks = (d) => d.Ducks.reduce((a, b) => a + b, 0);
const getCapacity = (d) => 10 + (d.Stage * 5); // Backpack grows with stage

function incomePerSec(d) {
  let sum = 0;
  for (let i = 0; i < NUM_DUCKS; i++) if (d.Ducks[i] > 0) sum += d.Ducks[i] * INCOME[i];
  return sum * Config.RebirthMult(d.Rebirths);
}

function handleAction(ws, rec, action, arg) {
  const d = rec.d;
  ensureProg(d);

  if (action === "PickLemons") {
    const now = Date.now();
    if (now - (rec.lastPick || 0) < 500) return; // 0.5s cooldown per pick
    rec.lastPick = now;
    const capacity = getCapacity(d);
    if (d.Backpack < capacity) {
      d.Backpack += 1; // Pick 1 lemon physically
    }
  } else if (action === "SellLemons") {
    if (d.Backpack > 0) {
      const value = d.Backpack * Config.Stage(d.Stage).SellPrice * Config.RebirthMult(d.Rebirths);
      d.Coins += value;
      d.Earned += value;
      d.Lemons += d.Backpack; // Track lifetime lemons gathered
      d.Backpack = 0;
    }
  } else if (action === "BuyDuck") {
    const tier = Number(arg);
    if (tier >= 1 && tier <= NUM_DUCKS && d.Coins >= COST[tier - 1]) {
      d.Coins -= COST[tier - 1];
      d.Ducks[tier - 1]++;
    }
  } else if (action === "Move") {
    if (typeof arg === "object") rec.pos = { x: arg.x || 0, y: arg.y || 0, z: arg.z || 0, yaw: arg.yaw || 0 };
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
  const players = [];
  for (const [ws, r] of online) if (r !== rec && r.pos) players.push({ name: r.name, pos: r.pos });
  return {
    t: "state", Coins: d.Coins, Lemons: d.Lemons, Backpack: d.Backpack, Capacity: getCapacity(d),
    Ducks: d.Ducks, Stage: d.Stage, TotalDucks: totalDucks(d), OtherPlayers: players
  };
}

wss.on("connection", (ws) => {
  let rec = null;
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "login" && !rec) {
      const token = String(m.token || "").slice(0, 64);
      let s = saves[token];
      if (!s) s = saves[token] = { name: "Player", d: newData(), lastSeen: Date.now() };
      rec = { token, name: s.name, d: s.d, pos: { x: 0, y: 0, z: 0, yaw: 0 } };
      online.set(ws, rec);
      send(ws, stateFor(rec));
    } else if (m.t === "act") {
      handleAction(ws, rec, String(m.a), m.arg);
      send(ws, stateFor(rec));
    }
  });
  ws.on("close", () => { if (rec) { pending.add(rec.token); online.delete(ws); } });
});

setInterval(() => {
  for (const [ws, rec] of online) {
    const d = rec.d;
    const inc = incomePerSec(d);
    if (inc > 0) { d.Coins += inc; d.Earned += inc; }
    send(ws, stateFor(rec));
  }
}, 1000);

store.load().then((loaded) => { saves = loaded; server.listen(PORT, () => console.log(`Online on ${PORT}`)); });
