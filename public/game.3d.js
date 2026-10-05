"use strict";

// -------------------------------------------------------------
// 0. Audio Synthesizer (Web Audio API - No external assets)
// -------------------------------------------------------------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (type === "pop") {
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
    gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.start(now); osc.stop(now + 0.08);
  } else if (type === "coin") {
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.setValueAtTime(1200, now + 0.05);
    gain.gain.setValueAtTime(0.25, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if (type === "plant") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  }
}

// -------------------------------------------------------------
// 1. Guaranteed Scene & Canvas Setup
// -------------------------------------------------------------
const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x38bdf8);
scene.fog = new THREE.FogExp2(0x38bdf8, 0.015);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

// FAILSAFE LIGHTING (Guarantees visible map objects even without shadows)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3d5a80, 0.7);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 0.9);
sunLight.position.set(30, 50, 20); sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024; sunLight.shadow.mapSize.height = 1024;
scene.add(sunLight);

// -------------------------------------------------------------
// 2. Procedural Canvas Textures
// -------------------------------------------------------------
function makeGrassTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4ade80"; ctx.fillRect(0,0,256,256);
  for(let i=0; i<800; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#22c55e" : "#16a34a";
    ctx.fillRect(Math.random()*256, Math.random()*256, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16); return tex;
}

// Map Ground
const groundMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.9 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// Map Pond & Water
const pondGroup = new THREE.Group();
const pondWater = new THREE.Mesh(
  new THREE.CylinderGeometry(14, 14, 0.2, 32),
  new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, transparent: true, opacity: 0.85 })
);
pondWater.position.y = 0.1; pondGroup.add(pondWater);
pondGroup.position.set(-20, 0, -20); scene.add(pondGroup);

// 4 Plot Soil Beds for Duck Seeds
const plotMeshes = [];
const plotPositions = [
  new THREE.Vector3(-25, 0.15, -10), new THREE.Vector3(-15, 0.15, -10),
  new THREE.Vector3(-25, 0.15, -5),  new THREE.Vector3(-15, 0.15, -5)
];
plotPositions.forEach((pos, idx) => {
  const plot = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0x78350f }));
  plot.position.copy(pos); scene.add(plot);
  const plantPivot = new THREE.Group(); plantPivot.position.copy(pos); scene.add(plantPivot);
  plotMeshes.push({ bed: plot, pivot: plantPivot, idx: idx });
});

// Map Interactive Zones
const sellStandPos = new THREE.Vector3(0, 0, -5);
const seedShopPos = new THREE.Vector3(-20, 0, 10);

// Build Nursery Shop
function createSeedShopBuilding() {
  const shop = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
  walls.position.y = 2; shop.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0x15803d }));
  roof.position.y = 5.25; roof.rotation.y = Math.PI / 4; shop.add(roof);
  shop.position.copy(seedShopPos); scene.add(shop);
}
createSeedShopBuilding();

// Build Market Stand
function createMarketStand() {
  const stand = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.5), new THREE.MeshStandardMaterial({ color: 0x78350f }));
  table.position.y = 0.6; stand.add(table);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 0.3), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
  sign.position.set(0, 3, 0); stand.add(sign);
  stand.position.copy(sellStandPos); scene.add(stand);
}
createMarketStand();

// Orchard Lemon Trees
const trees = [];
function createLemonTree(x, z) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3.5), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
  trunk.position.y = 1.75; trunk.castShadow = true; tree.add(trunk);
  const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8), new THREE.MeshStandardMaterial({ color: 0x15803d }));
  foliage.position.y = 4.5; foliage.castShadow = true; tree.add(foliage);
  tree.position.set(x, 0, z); scene.add(tree);
  trees.push({ mesh: tree, lemons: 5, lastPicked: 0 });
}
for(let i=0; i<8; i++) createLemonTree(-8 + (i%4)*10, 15 + Math.floor(i/4)*10);

// -------------------------------------------------------------
// 3. Player Character & Dual Controls
// -------------------------------------------------------------
const playerGroup = new THREE.Group();
const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xec4899 }));
playerMesh.position.y = 1; playerMesh.castShadow = true; playerGroup.add(playerMesh);
scene.add(playerGroup);

let yaw = 0, pitch = 0, baseSpeed = 0.22, camDist = 7;
const keys = { w: false, a: false, s: false, d: false, e: false, u: false };
let moveInput = { x: 0, z: 0 }, isInteracting = false;
let gameState = { BackpackLvl: 1, SpeedLvl: 1, Backpack: 0, Capacity: 10, Coins: 0 };

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = true;
  if (k === "u") toggleModal("upgrades-modal");
});
document.addEventListener("keyup", e => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = false; });

document.addEventListener("mousedown", e => { if (e.target.tagName === "CANVAS") document.body.requestPointerLock(); });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement) {
    yaw -= e.movementX * 0.003; pitch -= e.movementY * 0.003;
    pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
  }
});

// Mobile Joystick Logic
const joyZone = document.getElementById("joystick-zone"), joyKnob = document.getElementById("joystick-knob");
let joyId = null;
joyZone.addEventListener("touchstart", e => { joyId = e.changedTouches[0].identifier; }, {passive: false});
joyZone.addEventListener("touchmove", e => {
  for (let t of e.changedTouches) {
    if (t.identifier === joyId) {
      const r = joyZone.getBoundingClientRect(), dx = t.clientX - (r.left + r.width/2), dy = t.clientY - (r.top + r.height/2);
      const dist = Math.min(Math.hypot(dx, dy), 40), angle = Math.atan2(dy, dx);
      joyKnob.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
      moveInput.x = Math.cos(angle)*(dist/40); moveInput.z = Math.sin(angle)*(dist/40);
    }
  }
}, {passive: false});
const resetJoy = () => { joyId = null; joyKnob.style.transform = `translate(0,0)`; moveInput.x = moveInput.z = 0; };
joyZone.addEventListener("touchend", resetJoy); joyZone.addEventListener("touchcancel", resetJoy);

document.getElementById("action-btn").addEventListener("touchstart", () => isInteracting = true);
document.getElementById("action-btn").addEventListener("touchend", () => isInteracting = false);

// -------------------------------------------------------------
// 4. Floating 3D Text Popups & Minimap Engine
// -------------------------------------------------------------
const popups = [];
function spawnFloatingText(text, color, pos) {
  const div = document.createElement("div");
  div.innerText = text; div.style.position = "absolute"; div.style.color = color;
  div.style.fontWeight = "900"; div.style.fontSize = "18px"; div.style.textShadow = "2px 2px 4px #000";
  div.style.pointerEvents = "none"; div.style.zIndex = "15";
  document.body.appendChild(div);
  popups.push({ el: div, pos: pos.clone().add(new THREE.Vector3(0, 2, 0)), life: 1.0 });
}

function updatePopups() {
  const tempV = new THREE.Vector3();
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life -= 0.02; p.pos.y += 0.03;
    if (p.life <= 0) { document.body.removeChild(p.el); popups.splice(i, 1); continue; }
    tempV.copy(p.pos); tempV.project(camera);
    const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;
    p.el.style.left = `${x}px`; p.el.style.top = `${y}px`; p.el.style.opacity = p.life;
  }
}

// Minimap Renderer
const minimapCanvas = document.getElementById("minimap");
const mctx = minimapCanvas.getContext("2d");
function drawMinimap() {
  mctx.clearRect(0,0,120,120);
  mctx.fillStyle = "#1e293b"; mctx.fillRect(0,0,120,120);

  const cx = 60, cy = 60, scale = 0.7;
  
  // Draw Pond
  mctx.fillStyle = "#0284c7";
  mctx.beginPath(); mctx.arc(cx + (-20)*scale, cy + (-20)*scale, 10, 0, Math.PI*2); mctx.fill();

  // Draw Trees
  mctx.fillStyle = "#22c55e";
  trees.forEach(t => {
    mctx.beginPath(); mctx.arc(cx + t.mesh.position.x*scale, cy + t.mesh.position.z*scale, 3, 0, Math.PI*2); mctx.fill();
  });

  // Draw Player
  mctx.fillStyle = "#ec4899";
  mctx.beginPath(); mctx.arc(cx + playerGroup.position.x*scale, cy + playerGroup.position.z*scale, 4, 0, Math.PI*2); mctx.fill();
}

// -------------------------------------------------------------
// 5. Websocket Synchronization & Modals
// -------------------------------------------------------------
const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`);
ws.onopen = () => ws.send(JSON.stringify({ t: "login", token: localStorage.getItem("token") || "tok_"+Math.random() }));

window.toggleModal = (id) => {
  const m = document.getElementById(id);
  const show = m.style.display !== "block";
  closeModals();
  if (show) { m.style.display = "block"; document.exitPointerLock(); }
};
window.closeModals = () => {
  document.querySelectorAll(".game-modal").forEach(m => m.style.display = "none");
};

document.getElementById("open-upgrades-btn").onclick = () => toggleModal("upgrades-modal");

ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.t === "state") {
    gameState = msg;
    document.getElementById("coins-display").innerText = `💰 Coins: ${Math.floor(msg.Coins)}`;
    document.getElementById("lemons-display").innerText = `🍋 Lemons: ${Math.floor(msg.Lemons)}`;
    document.getElementById("rebirth-display").innerText = `⭐ Rebirths: ${msg.Rebirths} (x${msg.Multiplier})`;
    document.getElementById("capacity-text").innerText = `Backpack: ${msg.Backpack} / ${msg.Capacity}`;
    document.getElementById("inventory-fill").style.width = `${(msg.Backpack / msg.Capacity) * 100}%`;

    // Render Plots Seed Growth State
    if (msg.Plots) {
      msg.Plots.forEach((p, idx) => {
        const pm = plotMeshes[idx];
        pm.pivot.clear();
        if (p.planted) {
          const sprout = new THREE.Mesh(
            new THREE.SphereGeometry(0.3 + (p.progress/100)*0.5),
            new THREE.MeshStandardMaterial({ color: 0xfacc15 })
          );
          sprout.position.y = 0.5; pm.pivot.add(sprout);
        }
      });
    }

    // Build Nursery UI Grid
    if (msg.DuckNames) {
      const grid = document.getElementById("seed-grid"); grid.innerHTML = "";
      msg.DuckNames.forEach((name, i) => {
        const card = document.createElement("div"); card.className = "shop-card";
        card.innerHTML = `
          <strong>🌱 ${name} Seed</strong>
          <p style="font-size:12px; margin:4px 0;">Owned: ${msg.Ducks[i]}</p>
          <button onclick="buySeed(${i+1})">Buy 💰${msg.DuckCosts[i]}</button>
        `;
        grid.appendChild(card);
      });
    }

    // Build Upgrades UI Grid
    const upGrid = document.getElementById("upgrades-grid"); upGrid.innerHTML = "";
    upGrid.innerHTML = `
      <div class="shop-card">
        <strong>🎒 Capacity (Lvl ${msg.BackpackLvl})</strong>
        <button onclick="upgrade('backpack')">Upgrade 💰${msg.UpgradeCostBackpack}</button>
      </div>
      <div class="shop-card">
        <strong>⚡ Speed (Lvl ${msg.SpeedLvl})</strong>
        <button onclick="upgrade('speed')">Upgrade 💰${msg.UpgradeCostSpeed}</button>
      </div>
      <div class="shop-card">
        <strong>🤖 Worker (${msg.Workers})</strong>
        <button onclick="upgrade('worker')">Hire 💰${msg.WorkerCost}</button>
      </div>
      <div class="shop-card" style="border-color:#facc15;">
        <strong>⭐ Rebirth</strong>
        <button onclick="upgrade('rebirth')">Reset & Boost 💰${msg.RebirthCost}</button>
      </div>
    `;
  }
};

window.buySeed = (t) => { ws.send(JSON.stringify({t:"act", a:"BuyDuckSeed", arg:t})); playSound("coin"); };
window.upgrade = (type) => { ws.send(JSON.stringify({t:"act", a:"Upgrade", arg:type})); playSound("coin"); };

// -------------------------------------------------------------
// 6. Main Dynamic Render Loop
// -------------------------------------------------------------
let lastAction = 0;

function animate() {
  requestAnimationFrame(animate);

  const speed = baseSpeed + (gameState.SpeedLvl || 1) * 0.02;

  // Movement Physics
  let mx = moveInput.x, mz = moveInput.z;
  if (keys.w) mz = -1; if (keys.s) mz = 1; if (keys.a) mx = -1; if (keys.d) mx = 1;
  const moveVec = new THREE.Vector3(mx, 0, mz);
  if (moveVec.lengthSq() > 0) {
    moveVec.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    playerGroup.position.addScaledVector(moveVec, speed);
    playerMesh.rotation.y = Math.atan2(moveVec.x, moveVec.z);
    playerMesh.position.y = 1 + Math.abs(Math.sin(Date.now() * 0.01)) * 0.15; // Running bounce
    if (ws.readyState === 1 && Math.random() < 0.1) {
      ws.send(JSON.stringify({ t: "act", a: "Move", arg: { x: playerGroup.position.x, z: playerGroup.position.z } }));
    }
  }

  // Camera Third-Person Lock
  camera.position.set(
    playerGroup.position.x + camDist * Math.sin(yaw) * Math.cos(pitch),
    playerGroup.position.y + 2.5 + camDist * Math.sin(pitch),
    playerGroup.position.z + camDist * Math.cos(yaw) * Math.cos(pitch)
  );
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1, playerGroup.position.z);

  // Regrow Trees Animation
  const now = Date.now();
  trees.forEach(t => {
    if (t.lemons < 5 && now - t.lastPicked > 3000) { t.lemons++; t.lastPicked = now; }
    t.mesh.scale.setScalar(0.8 + (t.lemons * 0.04));
  });

  // Interaction Zone Checks
  let nearObj = null, nearPlotIdx = -1;
  if (playerGroup.position.distanceTo(seedShopPos) < 5) nearObj = "seedShop";
  else if (playerGroup.position.distanceTo(sellStandPos) < 5) nearObj = "sellStand";
  else {
    plotMeshes.forEach(p => {
      if (playerGroup.position.distanceTo(p.bed.position) < 3.5) { nearObj = "plot"; nearPlotIdx = p.idx; }
    });
    if (!nearObj) {
      trees.forEach(t => {
        if (playerGroup.position.distanceTo(t.mesh.position) < 3.5 && t.lemons > 0) nearObj = "tree";
      });
    }
  }

  const prompt = document.getElementById("action-prompt");
  if (nearObj) {
    prompt.style.display = "block";
    if (nearObj === "seedShop") prompt.innerText = "Press E to Open Seed Nursery";
    else if (nearObj === "sellStand") prompt.innerText = "Press E to Sell Lemons";
    else if (nearObj === "plot") prompt.innerText = gameState.SeedsHeld > 0 ? "Press E to Plant Seed" : "Buy Duck Seeds at Shop";
    else if (nearObj === "tree") prompt.innerText = "Press E to Pick Lemon";

    if ((keys.e || isInteracting) && now - lastAction > 350) {
      if (nearObj === "seedShop") toggleModal("seed-shop-modal");
      else if (nearObj === "sellStand" && gameState.Backpack > 0) {
        ws.send(JSON.stringify({ t: "act", a: "SellLemons" }));
        spawnFloatingText(`+$${gameState.Backpack * 50}`, "#4ade80", playerGroup.position);
        playSound("coin");
      } else if (nearObj === "plot" && gameState.SeedsHeld > 0) {
        ws.send(JSON.stringify({ t: "act", a: "PlantSeed", arg: nearPlotIdx }));
        playSound("plant");
      } else if (nearObj === "tree") {
        const target = trees.find(t => playerGroup.position.distanceTo(t.mesh.position) < 3.5 && t.lemons > 0);
        if (target && gameState.Backpack < gameState.Capacity) {
          target.lemons--; target.lastPicked = now;
          ws.send(JSON.stringify({ t: "act", a: "PickLemons" }));
          spawnFloatingText("+1 🍋", "#facc15", playerGroup.position);
          playSound("pop");
        }
      }
      lastAction = now;
    }
  } else { prompt.style.display = "none"; }

  updatePopups();
  drawMinimap();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start loop instantly
animate();
