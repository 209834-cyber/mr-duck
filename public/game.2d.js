"use strict";

// Helper: Large Number Formatter (Exponential support for extreme endgame)
function formatNum(num) {
  if (num === null || num === undefined) return "0";
  if (num < 1000) return num.toFixed(0);
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  const i = Math.floor(Math.log10(num) / 3);
  if (i > 0 && i <= units.length) {
    return (num / Math.pow(10, i * 3)).toFixed(2) + " " + units[i - 1];
  }
  return num.toExponential(2);
}

// 1. Canvas Setup
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resize); resize();

// 2. World Layout Constants
const WORLD = {
  width: 1400, height: 1000,
  pond: { x: 300, y: 300, r: 120 },
  seedShop: { x: 1000, y: 250, w: 160, h: 120 },
  sellStand: { x: 700, y: 700, w: 160, h: 100 },
  trees: [
    { x: 150, y: 700, lemons: 5, lastPicked: 0 },
    { x: 300, y: 750, lemons: 5, lastPicked: 0 },
    { x: 150, y: 850, lemons: 5, lastPicked: 0 },
    { x: 450, y: 700, lemons: 5, lastPicked: 0 }
  ],
  plots: [
    { x: 500, y: 220, w: 60, h: 60 }, { x: 580, y: 220, w: 60, h: 60 },
    { x: 660, y: 220, w: 60, h: 60 }, { x: 740, y: 220, w: 60, h: 60 },
    { x: 500, y: 300, w: 60, h: 60 }, { x: 580, y: 300, w: 60, h: 60 },
    { x: 660, y: 300, w: 60, h: 60 }, { x: 740, y: 300, w: 60, h: 60 }
  ]
};

// Player State
const player = { x: 700, y: 500, r: 22, speed: 4 };
let gameState = { Coins: 0, Backpack: 0, Capacity: 10, Rebirths: 0, SeedsHeld: 0, Plots: [] };
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, e: false };

// Popups Engine
const popups = [];
function addPopup(text, color, x, y) {
  popups.push({ text, color, x, y, opacity: 1.0, dy: -1.5 });
}

// 3. Input Handling
document.addEventListener("keydown", e => {
  if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
  if (e.key.toLowerCase() === "e" || e.key === " ") interact();
});
document.addEventListener("keyup", e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// Mobile Controls
const joyZone = document.getElementById("joystick-zone"), joyKnob = document.getElementById("joystick-knob");
let moveInput = { x: 0, y: 0 };
joyZone.addEventListener("touchmove", e => {
  const r = joyZone.getBoundingClientRect(), t = e.touches[0];
  const dx = t.clientX - (r.left + r.width/2), dy = t.clientY - (r.top + r.height/2);
  const dist = Math.min(Math.hypot(dx, dy), 40), angle = Math.atan2(dy, dx);
  joyKnob.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
  moveInput.x = Math.cos(angle)*(dist/40); moveInput.y = Math.sin(angle)*(dist/40);
});
const resetJoy = () => { joyKnob.style.transform = `translate(0,0)`; moveInput.x = moveInput.y = 0; };
joyZone.addEventListener("touchend", resetJoy); joyZone.addEventListener("touchcancel", resetJoy);
document.getElementById("action-btn").addEventListener("touchstart", () => interact());

// 4. WebSocket Sync & Modals
const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`);
ws.onopen = () => ws.send(JSON.stringify({ t: "login", token: localStorage.getItem("token") || "tok_"+Math.random() }));

window.toggleModal = (id) => {
  const m = document.getElementById(id); const show = m.style.display !== "block";
  closeModals(); if (show) m.style.display = "block";
};
window.closeModals = () => document.querySelectorAll(".game-modal").forEach(m => m.style.display = "none");

document.getElementById("open-seed-btn").onclick = () => toggleModal("seed-shop-modal");
document.getElementById("open-upgrades-btn").onclick = () => toggleModal("upgrades-modal");
document.getElementById("open-rebirth-btn").onclick = () => toggleModal("rebirth-modal");

ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.t === "state") {
    gameState = msg;
    document.getElementById("coins-display").innerText = `💰 Coins: ${formatNum(msg.Coins)}`;
    document.getElementById("lemons-display").innerText = `🍋 Lemons Sold: ${formatNum(msg.Lemons)}`;
    document.getElementById("rebirth-display").innerText = `⭐ Rebirths: ${formatNum(msg.Rebirths)} (x${msg.Multiplier.toFixed(1)} Multiplier)`;
    document.getElementById("tokens-display").innerText = `🔮 Rebirth Tokens: ${msg.RebirthTokens}`;
    document.getElementById("capacity-text").innerText = `Backpack: ${msg.Backpack} / ${msg.Capacity}`;
    document.getElementById("inventory-fill").style.width = `${(msg.Backpack / msg.Capacity) * 100}%`;

    // Seed Shop Grid
    if (msg.DuckTiers) {
      const grid = document.getElementById("seed-grid"); grid.innerHTML = "";
      msg.DuckTiers.forEach((tier, i) => {
        const disc = 1 - ((msg.Perks.SeedDiscount || 0) * 0.1);
        const cost = Math.floor(tier.cost * disc);
        const card = document.createElement("div"); card.className = "shop-card";
        card.innerHTML = `
          <strong>🌱 ${tier.name}</strong>
          <p style="font-size:11px; margin:4px 0;">Yields: $${formatNum(tier.income)}/sec</p>
          <p style="font-size:11px; margin:2px 0;">Owned: ${msg.Ducks[i]}</p>
          <button onclick="buySeed(${i+1})">Buy 💰${formatNum(cost)}</button>
        `;
        grid.appendChild(card);
      });
    }

    // Upgrades Grid
    const upGrid = document.getElementById("upgrades-grid"); upGrid.innerHTML = "";
    upGrid.innerHTML = `
      <div class="shop-card">
        <strong>🎒 Backpack (Lvl ${msg.BackpackLvl})</strong>
        <button onclick="upgrade('backpack')">Upgrade 💰${formatNum(msg.UpgradeCostBackpack)}</button>
      </div>
      <div class="shop-card">
        <strong>⚡ Speed (Lvl ${msg.SpeedLvl})</strong>
        <button onclick="upgrade('speed')">Upgrade 💰${formatNum(msg.UpgradeCostSpeed)}</button>
      </div>
      <div class="shop-card">
        <strong>🤖 Auto Worker (${msg.Workers})</strong>
        <button onclick="upgrade('worker')">Hire 💰${formatNum(msg.WorkerCost)}</button>
      </div>
    `;

    // Rebirth Tree Grid
    document.getElementById("rebirth-status-text").innerText = `Current Rebirth Cost: 💰${formatNum(msg.RebirthCost)}`;
    const treeGrid = document.getElementById("rebirth-tree-grid"); treeGrid.innerHTML = "";
    const perks = [
      { id: "IncomeBoost", name: "📈 Mega Boost", desc: "+50% Universal Multiplier" },
      { id: "SpeedBoost", name: "👟 Hyper Speed", desc: "+1 Permanent Speed Lvl" },
      { id: "SeedDiscount", name: "🏷️ Bargain Seeds", desc: "-10% Seed Purchase Cost" }
    ];
    perks.forEach(p => {
      const lvl = msg.Perks[p.id] || 0; const cost = (lvl + 1) * 2;
      const card = document.createElement("div"); card.className = "shop-card";
      card.innerHTML = `
        <strong>${p.name} (Lvl ${lvl})</strong>
        <p style="font-size:11px; margin:4px 0; color:#94a3b8;">${p.desc}</p>
        <button onclick="buyPerk('${p.id}')">Unlock 🔮${cost} Tokens</button>
      `;
      treeGrid.appendChild(card);
    });
  }
};

window.buySeed = (t) => ws.send(JSON.stringify({t:"act", a:"BuyDuckSeed", arg:t}));
window.upgrade = (type) => ws.send(JSON.stringify({t:"act", a:"Upgrade", arg:type}));
window.executeRebirth = () => ws.send(JSON.stringify({t:"act", a:"PerformRebirth"}));
window.buyPerk = (p) => ws.send(JSON.stringify({t:"act", a:"BuyPerk", arg:p}));

// 5. Interaction Engine
function interact() {
  const now = Date.now();
  // Check Trees
  WORLD.trees.forEach(t => {
    if (Math.hypot(player.x - t.x, player.y - t.y) < 50 && t.lemons > 0 && gameState.Backpack < gameState.Capacity) {
      t.lemons--; t.lastPicked = now;
      ws.send(JSON.stringify({ t: "act", a: "PickLemons" }));
      addPopup("+1 🍋", "#facc15", t.x, t.y - 20);
    }
  });
  // Check Sell Stand
  if (player.x > WORLD.sellStand.x && player.x < WORLD.sellStand.x + WORLD.sellStand.w &&
      player.y > WORLD.sellStand.y && player.y < WORLD.sellStand.y + WORLD.sellStand.h) {
    if (gameState.Backpack > 0) {
      ws.send(JSON.stringify({ t: "act", a: "SellLemons" }));
      addPopup(`+$${formatNum(gameState.Backpack * 25 * gameState.Multiplier)}`, "#4ade80", player.x, player.y - 30);
    }
  }
  // Check Seed Shop
  if (player.x > WORLD.seedShop.x && player.x < WORLD.seedShop.x + WORLD.seedShop.w &&
      player.y > WORLD.seedShop.y && player.y < WORLD.seedShop.y + WORLD.seedShop.h) {
    toggleModal("seed-shop-modal");
  }
  // Check Soil Plots
  WORLD.plots.forEach((p, idx) => {
    if (player.x > p.x && player.x < p.x + p.w && player.y > p.y && player.y < p.y + p.h) {
      if (gameState.SeedsHeld > 0) {
        ws.send(JSON.stringify({ t: "act", a: "PlantSeed", arg: idx }));
        addPopup("🌱 Planted!", "#22c55e", p.x + 30, p.y);
      }
    }
  });
}

// 6. Main 2D Render & Physics Loop
function update() {
  const moveSpeed = player.speed + (gameState.SpeedLvl || 1) * 0.4;
  let dx = moveInput.x, dy = moveInput.y;
  if (keys.w || keys.ArrowUp) dy = -1; if (keys.s || keys.ArrowDown) dy = 1;
  if (keys.a || keys.ArrowLeft) dx = -1; if (keys.d || keys.ArrowRight) dx = 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * moveSpeed;
    player.y += (dy / len) * moveSpeed;
  }

  // World Bounds Clamp
  player.x = Math.max(player.r, Math.min(WORLD.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(WORLD.height - player.r, player.y));

  // Regrow Trees
  const now = Date.now();
  WORLD.trees.forEach(t => {
    if (t.lemons < 5 && now - t.lastPicked > 3000) { t.lemons++; t.lastPicked = now; }
  });

  // Action Prompt Status
  const prompt = document.getElementById("action-prompt");
  let near = false;
  if (player.x > WORLD.seedShop.x && player.x < WORLD.seedShop.x + WORLD.seedShop.w &&
      player.y > WORLD.seedShop.y && player.y < WORLD.seedShop.y + WORLD.seedShop.h) {
    prompt.style.display = "block"; prompt.innerText = "Press E to Open Nursery"; near = true;
  } else if (player.x > WORLD.sellStand.x && player.x < WORLD.sellStand.x + WORLD.sellStand.w &&
             player.y > WORLD.sellStand.y && player.y < WORLD.sellStand.y + WORLD.sellStand.h) {
    prompt.style.display = "block"; prompt.innerText = "Press E to Sell Lemons"; near = true;
  } else {
    WORLD.trees.forEach(t => {
      if (Math.hypot(player.x - t.x, player.y - t.y) < 50 && t.lemons > 0) {
        prompt.style.display = "block"; prompt.innerText = "Press E to Pick Lemon"; near = true;
      }
    });
    WORLD.plots.forEach(p => {
      if (player.x > p.x && player.x < p.x + p.w && player.y > p.y && player.y < p.y + p.h) {
        prompt.style.display = "block"; prompt.innerText = gameState.SeedsHeld > 0 ? "Press E to Plant Seed" : "Buy Seeds at Shop!"; near = true;
      }
    });
  }
  if (!near) prompt.style.display = "none";
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Smooth Camera Follow
  ctx.save();
  ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

  // Ground Grass
  ctx.fillStyle = "#15803d"; ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Draw Pond
  ctx.fillStyle = "#0284c7"; ctx.beginPath();
  ctx.arc(WORLD.pond.x, WORLD.pond.y, WORLD.pond.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 6; ctx.stroke();

  // Swimming Ducks in Pond
  const totalDucks = gameState.Ducks ? gameState.Ducks.reduce((a,b)=>a+b, 0) : 0;
  for (let i = 0; i < Math.min(totalDucks, 15); i++) {
    const angle = (Date.now() * 0.001) + (i * 0.8);
    const dx = WORLD.pond.x + Math.cos(angle) * (40 + (i % 3) * 20);
    const dy = WORLD.pond.y + Math.sin(angle) * (40 + (i % 3) * 20);
    ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(dx, dy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f97316"; ctx.fillRect(dx + 5, dy - 2, 4, 4); // Beak
  }

  // Draw Soil Plots
  WORLD.plots.forEach((p, idx) => {
    ctx.fillStyle = "#78350f"; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#451a03"; ctx.lineWidth = 3; ctx.strokeRect(p.x, p.y, p.w, p.h);
    const serverPlot = gameState.Plots ? gameState.Plots[idx] : null;
    if (serverPlot && serverPlot.planted) {
      ctx.fillStyle = "#22c55e"; ctx.beginPath();
      ctx.arc(p.x + p.w/2, p.y + p.h/2, 6 + (serverPlot.progress/100)*10, 0, Math.PI*2); ctx.fill();
    }
  });

  // Seed Nursery Building
  ctx.fillStyle = "#854d0e"; ctx.fillRect(WORLD.seedShop.x, WORLD.seedShop.y, WORLD.seedShop.w, WORLD.seedShop.h);
  ctx.fillStyle = "#facc15"; ctx.font = "bold 16px sans-serif";
  ctx.fillText("🌱 Seed Nursery", WORLD.seedShop.x + 15, WORLD.seedShop.y + 60);

  // Market Stand Building
  ctx.fillStyle = "#a16207"; ctx.fillRect(WORLD.sellStand.x, WORLD.sellStand.y, WORLD.sellStand.w, WORLD.sellStand.h);
  ctx.fillStyle = "#22c55e"; ctx.font = "bold 16px sans-serif";
  ctx.fillText("💰 Sell Stand", WORLD.sellStand.x + 25, WORLD.sellStand.y + 55);

  // Orchard Lemon Trees
  WORLD.trees.forEach(t => {
    ctx.fillStyle = "#451a03"; ctx.fillRect(t.x - 6, t.y, 12, 20); // Trunk
    ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(t.x, t.y - 10, 30, 0, Math.PI*2); ctx.fill(); // Canopy
    for (let i = 0; i < t.lemons; i++) {
      ctx.fillStyle = "#facc15"; ctx.beginPath();
      ctx.arc(t.x - 12 + (i % 3) * 12, t.y - 20 + Math.floor(i / 3) * 12, 5, 0, Math.PI*2); ctx.fill();
    }
  });

  // Player Character
  ctx.fillStyle = "#ec4899"; ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();

  // Draw Popups
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y += p.dy; p.opacity -= 0.02;
    if (p.opacity <= 0) { popups.splice(i, 1); continue; }
    ctx.fillStyle = p.color; ctx.globalAlpha = p.opacity;
    ctx.font = "bold 18px sans-serif"; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

loop();
