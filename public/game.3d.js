// public/game3d.js
"use strict";

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
scene.add(dirLight);

// Ground Plane
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Player Character
const playerGroup = new THREE.Group();
scene.add(playerGroup);

const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2196f3 });
const playerMesh = new THREE.Mesh(bodyGeo, bodyMat);
playerMesh.position.y = 0.9;
playerMesh.castShadow = true;
playerGroup.add(playerMesh);

// Controls & Camera Settings
const keys = { w: false, a: false, s: false, d: false };
let yaw = 0;
let pitch = 0;
const speed = 0.15;
const cameraDistance = 5;

document.body.addEventListener("click", () => {
  document.body.requestPointerLock();
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === document.body) {
    yaw -= e.movementX * 0.003;
    pitch -= e.movementY * 0.003;
    pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
  }
});

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = true;
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = false;
});

function updatePlayerMovement() {
  const moveVector = new THREE.Vector3();

  if (keys.w) moveVector.z -= 1;
  if (keys.s) moveVector.z += 1;
  if (keys.a) moveVector.x -= 1;
  if (keys.d) moveVector.x += 1;

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize();
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    playerGroup.position.addScaledVector(moveVector, speed);
    playerMesh.rotation.y = Math.atan2(moveVector.x, moveVector.z);

    // Send updated position to server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        t: "act",
        a: "Move",
        arg: {
          x: playerGroup.position.x,
          y: playerGroup.position.y,
          z: playerGroup.position.z,
          yaw: playerMesh.rotation.y,
        },
      }));
    }
  }

  const camX = playerGroup.position.x + cameraDistance * Math.sin(yaw) * Math.cos(pitch);
  const camY = playerGroup.position.y + 1.8 + cameraDistance * Math.sin(pitch) + 1.5;
  const camZ = playerGroup.position.z + cameraDistance * Math.cos(yaw) * Math.cos(pitch);

  camera.position.set(camX, camY, camZ);
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.2, playerGroup.position.z);
}

// 3D Duck Objects
const duckGroup = new THREE.Group();
scene.add(duckGroup);

function create3DDuck(x, z, color = 0xffeb3b) {
  const duck = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 1),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.3;
  duck.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color })
  );
  head.position.set(0, 0.7, 0.3);
  duck.add(head);

  const beak = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xff9800 })
  );
  beak.position.set(0, 0.65, 0.6);
  duck.add(beak);

  duck.position.set(x, 0, z);
  return duck;
}

for (let i = 0; i < 5; i++) {
  const angle = (i / 5) * Math.PI * 2;
  const duck = create3DDuck(Math.cos(angle) * 4, Math.sin(angle) * 4);
  duckGroup.add(duck);
}

// WebSocket Connection
const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocol}//${location.host}`);

ws.onopen = () => {
  ws.send(JSON.stringify({ t: "login", name: "Player", token: "player-token-" + Math.random() }));
};

ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.t === "state") {
    document.getElementById("coins-display").innerText = `Coins: ${Math.floor(msg.Coins)}`;
    document.getElementById("lemons-display").innerText = `Lemons: ${Math.floor(msg.Lemons)}`;
  }
};

function animate() {
  requestAnimationFrame(animate);

  updatePlayerMovement();

  const time = Date.now() * 0.003;
  duckGroup.children.forEach((duck, idx) => {
    duck.position.y = Math.sin(time + idx) * 0.1;
  });

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
