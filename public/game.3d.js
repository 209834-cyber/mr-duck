"use strict";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87ceeb, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Environment Lighting (Day/Night)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
scene.add(sunLight);

// World Map
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(150, 150),
  new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Pond
const pond = new THREE.Mesh(
  new THREE.CylinderGeometry(12, 12, 0.2, 32),
  new THREE.MeshStandardMaterial({ color: 0x03a9f4, transparent: true, opacity: 0.8 })
);
pond.position.set(-15, 0.1, -15);
scene.add(pond);

// Interactive Objects
const trees = [];
const sellStandPos = new THREE.Vector3(0, 0, -5);

function createTree(x, z) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
  trunk.position.y = 1.5; trunk.castShadow = true; tree.add(trunk);
  const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
  leaves.position.y = 4; leaves.castShadow = true; tree.add(leaves);
  tree.position.set(x, 0, z);
  scene.add(tree);
  trees.push({ mesh: tree, lemons: 5, lastPicked: 0 });
}

// Plant Orchard
for(let i=0; i<6; i++) createTree(-10 + (i%3)*10, 10 + Math.floor(i/3)*10);

// Sell Stand
const stand = new THREE.Group();
const table = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 2), new THREE.MeshStandardMaterial({ color: 0x795548 }));
table.position.y = 0.5; stand.add(table);
const sign = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 0.2), new THREE.MeshStandardMaterial({ color: 0xffeb3b }));
sign.position.set(0, 3, 0); stand.add(sign);
stand.position.copy(sellStandPos);
scene.add(stand);

// Player Setup
const playerGroup = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xe91e63 }));
body.position.y = 1; body.castShadow = true; playerGroup.add(body);
scene.add(playerGroup);

// Mechanics & Input
let yaw = 0, pitch = 0, speed = 0.2, camDist = 6;
const keys = { w: false, a: false, s: false, d: false, e: false };
let moveInput = { x: 0, z: 0 };
let isInteracting = false;
let serverTotalDucks = 0;

document.addEventListener("keydown", e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
document.addEventListener("keyup", e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
document.addEventListener("mousedown", e => { if(e.target.tagName === "CANVAS") document.body.requestPointerLock(); });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement) {
    yaw -= e.movementX * 0.003;
    pitch -= e.movementY * 0.003;
    pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
  }
});

// Mobile Controls
const joyZone = document.getElementById("joystick-zone");
const joyKnob = document.getElementById("joystick-knob");
let joyId = null;
joyZone.addEventListener("touchstart", e => { joyId = e.changedTouches[0].identifier; }, {passive: false});
joyZone.addEventListener("touchmove", e => {
  for(let t of e.changedTouches) {
    if(t.identifier === joyId) {
      const r = joyZone.getBoundingClientRect();
      const dx = t.clientX - (r.left + r.width/2), dy = t.clientY - (r.top + r.height/2);
      const dist = Math.min(Math.hypot(dx, dy), 40), angle = Math.atan2(dy, dx);
      joyKnob.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
      moveInput.x = Math.cos(angle)*(dist/40); moveInput.z = Math.sin(angle)*(dist/40);
    }
  }
}, {passive: false});
const resetJoy = () => { joyId = null; joyKnob.style.transform = `translate(0,0)`; moveInput.x = moveInput.z = 0; };
joyZone.addEventListener("touchend", resetJoy); joyZone.addEventListener("touchcancel", resetJoy);

const actionBtn = document.getElementById("action-btn");
actionBtn.addEventListener("touchstart", () => isInteracting = true);
actionBtn.addEventListener("touchend", () => isInteracting = false);
window.addEventListener("touchmove", e => {
  if(e.target.tagName === "CANVAS" && joyId === null) {
    yaw -= e.movementX * 0.005; pitch -= e.movementY * 0.005;
    pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
  }
});

// Ducks Ecosystem
const duckMeshes = [];
function spawnDuck() {
  const group = new THREE.Group();
  const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), new THREE.MeshStandardMaterial({color: 0xffeb3b}));
  dBody.position.y = 0.2; group.add(dBody);
  group.position.set(-15 + (Math.random()*10 - 5), 0.2, -15 + (Math.random()*10 - 5));
  group.userData = { tx: group.position.x, tz: group.position.z };
  scene.add(group);
  duckMeshes.push(group);
}

function updateDucks() {
  while(duckMeshes.length < Math.min(serverTotalDucks, 30)) spawnDuck();
  duckMeshes.forEach(d => {
    const dx = d.userData.tx - d.position.x;
    const dz = d.userData.tz - d.position.z;
    if (Math.hypot(dx, dz) < 0.5) {
      d.userData.tx = -15 + (Math.random()*16 - 8);
      d.userData.tz = -15 + (Math.random()*16 - 8);
    } else {
      d.position.x += dx * 0.01;
      d.position.z += dz * 0.01;
      d.rotation.y = Math.atan2(dx, dz);
      d.position.y = 0.2 + Math.sin(Date.now() * 0.01 + d.position.x) * 0.1; // Waddling
    }
  });
}

// Websocket sync
const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`);
ws.onopen = () => ws.send(JSON.stringify({ t: "login", token: localStorage.getItem("token") || "tok_"+Math.random() }));

ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.t === "state") {
    document.getElementById("coins-display").innerText = `💰 Coins: ${Math.floor(msg.Coins)}`;
    document.getElementById("lemons-display").innerText = `🍋 Banked Lemons: ${Math.floor(msg.Lemons)}`;
    document.getElementById("capacity-text").innerText = `Backpack: ${msg.Backpack} / ${msg.Capacity}`;
    document.getElementById("inventory-fill").style.width = `${(msg.Backpack / msg.Capacity) * 100}%`;
    serverTotalDucks = msg.TotalDucks;
  }
};

let lastAction = 0;

function animate() {
  requestAnimationFrame(animate);

  // Day / Night Cycle
  const time = Date.now() * 0.0005;
  sunLight.position.x = Math.cos(time) * 50;
  sunLight.position.y = Math.sin(time) * 50;
  const isDay = sunLight.position.y > 0;
  scene.background = new THREE.Color(isDay ? 0x87ceeb : 0x0a0a2a);
  scene.fog.color = scene.background;
  ambientLight.intensity = isDay ? 0.4 : 0.1;
  sunLight.intensity = isDay ? 1 : 0;

  // Movement
  let mx = moveInput.x, mz = moveInput.z;
  if(keys.w) mz = -1; if(keys.s) mz = 1; if(keys.a) mx = -1; if(keys.d) mx = 1;
  const moveVec = new THREE.Vector3(mx, 0, mz);
  if(moveVec.lengthSq() > 0) {
    moveVec.normalize().applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    playerGroup.position.addScaledVector(moveVec, speed);
    body.rotation.y = Math.atan2(moveVec.x, moveVec.z);
    body.position.y = 1 + Math.abs(Math.sin(Date.now()*0.01))*0.2; // Bobbing
    if(ws.readyState === 1 && Math.random() < 0.1) ws.send(JSON.stringify({t:"act", a:"Move", arg:{x:playerGroup.position.x, z:playerGroup.position.z, yaw:body.rotation.y}}));
  }

  // Camera
  camera.position.set(playerGroup.position.x + camDist*Math.sin(yaw)*Math.cos(pitch), playerGroup.position.y + 2 + camDist*Math.sin(pitch), playerGroup.position.z + camDist*Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1, playerGroup.position.z);

  // Interaction Logic
  let nearObj = null;
  const now = Date.now();
  
  // Regrow trees
  trees.forEach(t => {
    if (t.lemons < 5 && now - t.lastPicked > 3000) { t.lemons++; t.lastPicked = now; }
    t.mesh.scale.setScalar(0.8 + (t.lemons * 0.04));
    if (playerGroup.position.distanceTo(t.mesh.position) < 4 && t.lemons > 0) nearObj = "tree";
  });
  
  if (playerGroup.position.distanceTo(sellStandPos) < 5) nearObj = "stand";

  const prompt = document.getElementById("action-prompt");
  if (nearObj) {
    prompt.style.display = "block";
    prompt.innerText = nearObj === "tree" ? "Press E to Pick Lemon" : "Press E to Sell Lemons";
    if ((keys.e || isInteracting) && now - lastAction > 500) {
      if (nearObj === "tree") {
        const targetTree = trees.find(t => playerGroup.position.distanceTo(t.mesh.position) < 4 && t.lemons > 0);
        if (targetTree) { targetTree.lemons--; targetTree.lastPicked = now; ws.send(JSON.stringify({t: "act", a: "PickLemons"})); }
      } else {
        ws.send(JSON.stringify({t: "act", a: "SellLemons"}));
      }
      lastAction = now;
    }
  } else { prompt.style.display = "none"; }

  updateDucks();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
