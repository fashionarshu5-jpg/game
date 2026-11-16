// ==========================================
// 1. GAME STATE & PLAYER PREFERENCES
// ==========================================
const state = {
  gender: 'male',
  jacketColor: '#2b3a42',
  isFirstPerson: false,
  isConnected: false,
  isHost: false,
  relicsCollected: 0,
  totalRelics: 5,
  gameStarted: false
};

let peer = null;
let conn = null;

// ==========================================
// 2. THREE.JS REALISTIC 3D SCENE SETUP
// ==========================================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d131a);
scene.fog = new THREE.FogExp2(0x0d131a, 0.032);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 140);

// Atmospheric Moonlight + Hemisphere Lighting
const hemiLight = new THREE.HemisphereLight(0x6e85a3, 0x1b221c, 0.55);
scene.add(hemiLight);

const moonLight = new THREE.DirectionalLight(0xaec6e8, 0.85);
moonLight.position.set(25, 45, 20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 1024;
moonLight.shadow.mapSize.height = 1024;
moonLight.shadow.camera.near = 5;
moonLight.shadow.camera.far = 110;
const d = 38;
moonLight.shadow.camera.left = -d;
moonLight.shadow.camera.right = d;
moonLight.shadow.camera.top = d;
moonLight.shadow.camera.bottom = -d;
scene.add(moonLight);

// Procedural Ground Texture (Stone & Moss)
function createGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e2620';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  return tex;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
  new THREE.MeshStandardMaterial({ map: createGroundTexture(), roughness: 0.92, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ==========================================
// 3. ENVIRONMENT: ABBEY RUINS, TREES & RELICS
// ==========================================
const colliders = [];
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x454b52, roughness: 0.88, metalness: 0.1 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.9 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a2e22, roughness: 0.85 });

function addBoxObstacle(x, y, z, w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 });
  return mesh;
}

// Central Abbey Pillars & Walls
const pillarCoords = [
  [-8, -8], [8, -8], [-8, 8], [8, 8],
  [-18, -14], [18, -14], [-18, 14], [18, 14]
];
pillarCoords.forEach(([px, pz]) => {
  addBoxObstacle(px, 3, pz, 1.8, 6, 1.8, stoneMat);
});

// Ruined Abbey Perimeter Walls
addBoxObstacle(0, 2.5, -28, 36, 5, 1.5, stoneMat);
addBoxObstacle(-28, 2.5, 0, 1.5, 5, 36, stoneMat);
addBoxObstacle(28, 2.5, 0, 1.5, 5, 36, stoneMat);

// Sanctuary Exit Gate (North)
const gateArch = addBoxObstacle(0, 3.5, 28, 8, 7, 1.8, new THREE.MeshStandardMaterial({ color: 0x6b5638, roughness: 0.7 }));
const gateLight = new THREE.PointLight(0xe2b86b, 1.5, 14);
gateLight.position.set(0, 4, 26);
scene.add(gateLight);

// Surrounding Forest Trees
for (let i = 0; i < 42; i++) {
  const angle = (i / 42) * Math.PI * 2;
  const radius = 22 + (i % 5) * 7;
  const tx = Math.cos(angle) * radius;
  const tz = Math.sin(angle) * radius;
  if (Math.abs(tx) < 6 && tz > 20) continue; // Keep exit path clear
  addBoxObstacle(tx, 2, tz, 0.9, 4, 0.9, woodMat);
  const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.8, 6.5, 7), leafMat);
  foliage.position.set(tx, 6.2, tz);
  foliage.castShadow = true;
  scene.add(foliage);
}

// 5 Collectible Glowing Relics
const relicPositions = [
  [-12, 1.1, -12],
  [14, 1.1, -10],
  [-20, 1.1, 6],
  [19, 1.1, 12],
  [0, 1.1, -21]
];

const relics = relicPositions.map((pos, idx) => {
  const group = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xe29530, emissiveIntensity: 1.4, roughness: 0.2 })
  );
  const glow = new THREE.PointLight(0xffb703, 1.6, 9);
  group.add(orb, glow);
  group.position.set(pos[0], pos[1], pos[2]);
  scene.add(group);
  return { id: idx, mesh: group, collected: false };
});

// ==========================================
// 4. REALISTIC MALE & FEMALE 3D CHARACTERS
// ==========================================
function buildCharacterMesh(gender, jacketHex) {
  const root = new THREE.Group();
  const isFemale = gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.65 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(jacketHex), roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x181512, roughness: 0.9 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

  const shoulderW = isFemale ? 0.56 : 0.72;
  const torsoH = isFemale ? 0.72 : 0.8;
  const hipW = isFemale ? 0.54 : 0.58;

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.82, 0.24), pantsMat);
  leftLeg.position.set(-hipW * 0.26, 0.45, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.82, 0.24), pantsMat);
  rightLeg.position.set(hipW * 0.26, 0.45, 0);
  rightLeg.castShadow = true;

  // Boots
  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.32), bootMat);
  leftBoot.position.set(0, -0.38, 0.04);
  leftLeg.add(leftBoot);

  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.32), bootMat);
  rightBoot.position.set(0, -0.38, 0.04);
  rightLeg.add(rightBoot);

  // Torso Jacket
  const torso = new THREE.Mesh(new THREE.BoxGeometry(shoulderW, torsoH, 0.34), jacketMat);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;

  // Explorer Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(shoulderW * 0.72, 0.52, 0.22), new THREE.MeshStandardMaterial({ color: 0x2d333b, roughness: 0.8 }));
  pack.position.set(0, 1.26, -0.25);
  pack.castShadow = true;

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.36), skinMat);
  head.position.set(0, 1.86, 0);
  head.castShadow = true;

  // Hair (Short cropped for Male, Long + Ponytail for Female)
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.16, 0.4), hairMat);
  hairTop.position.set(0, 2.04, -0.01);
  root.add(hairTop);

  if (isFemale) {
    const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), hairMat);
    ponytail.position.set(0, 1.82, -0.24);
    ponytail.rotation.x = 0.25;
    root.add(ponytail);
  }

  // Arms
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), jacketMat);
  leftArm.position.set(-(shoulderW / 2 + 0.11), 1.24, 0);
  leftArm.castShadow = true;

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), jacketMat);
  rightArm.position.set(shoulderW / 2 + 0.11, 1.24, 0);
  rightArm.castShadow = true;

  // Hand Flashlight
  const flashlight = new THREE.SpotLight(0xfff4d6, 2.4, 28, Math.PI / 5.5, 0.45, 1);
  flashlight.position.set(0, 1.35, 0.35);
  flashlight.target.position.set(0, 1.15, 8);
  root.add(flashlight, flashlight.target);

  root.add(leftLeg, rightLeg, torso, pack, head, leftArm, rightArm);
  root.userData = { leftLeg, rightLeg, leftArm, rightArm, head, torso, hairTop };
  return root;
}

let localPlayer = buildCharacterMesh(state.gender, state.jacketColor);
localPlayer.position.set(-2, 0, 18);
scene.add(localPlayer);

let remotePlayer = null;

// ==========================================
// 5. LOBBY UI & PEERJS MULTIPLAYER SYNC
// ==========================================
function selectGender(g) {
  state.gender = g;
  document.getElementById('btn-male').classList.toggle('active', g === 'male');
  document.getElementById('btn-female').classList.toggle('active', g === 'female');
  rebuildLocalPlayer();
}

function selectColor(hex, el) {
  state.jacketColor = hex;
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  rebuildLocalPlayer();
}

function rebuildLocalPlayer() {
  const pos = localPlayer.position.clone();
  scene.remove(localPlayer);
  localPlayer = buildCharacterMesh(state.gender, state.jacketColor);
  localPlayer.position.copy(pos);
  scene.add(localPlayer);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function hostGame() {
  const code = generateRoomCode();
  const peerId = 'abbey-coop-' + code;
  document.getElementById('host-info').classList.remove('hidden');
  document.getElementById('room-code-display').textContent = code;
  document.getElementById('host-status').textContent = 'Creating room...';

  peer = new Peer(peerId);
  peer.on('open', () => {
    state.isHost = true;
    document.getElementById('host-status').textContent = 'Waiting for friend to enter ' + code + '...';
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
    enterGame('Co-op Connected');
  });

  peer.on('error', (err) => {
    document.getElementById('host-status').textContent = 'Connection error: ' + err.type;
  });
}

function joinGame() {
  const raw = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (raw.length < 4) {
    document.getElementById('join-status').textContent = 'Enter the 4-letter Room Code.';
    return;
  }
  document.getElementById('join-status').textContent = 'Connecting to ' + raw + '...';
  peer = new Peer();
  peer.on('open', () => {
    conn = peer.connect('abbey-coop-' + raw, { reliable: true });
    conn.on('open', () => {
      setupConnection();
      enterGame('Co-op Connected');
    });
  });

  peer.on('error', () => {
    document.getElementById('join-status').textContent = 'Room not found. Check code & try again.';
  });
}

function setupConnection() {
  state.isConnected = true;
  // Send initial profile
  conn.send({ type: 'profile', gender: state.gender, color: state.jacketColor });

  conn.on('data', (data) => {
    if (data.type === 'profile') {
      if (remotePlayer) scene.remove(remotePlayer);
      remotePlayer = buildCharacterMesh(data.gender, data.color);
      remotePlayer.position.set(2, 0, 18);
      scene.add(remotePlayer);
      showToast('Your partner joined the Abbey!');
    } else if (data.type === 'move' && remotePlayer) {
      remotePlayer.position.set(data.x, data.y, data.z);
      remotePlayer.rotation.y = data.ry;
      animateLimbs(remotePlayer, data.speed, performance.now() * 0.008);
    } else if (data.type === 'relic') {
      collectRelicLocal(data.id, false);
    }
  });
}

function startSoloPreview() {
  enterGame('Solo Mode');
}

function enterGame(badgeText) {
  state.gameStarted = true;
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('conn-badge').textContent = badgeText;
  showToast('Collect all 5 glowing relics to unlock the gate!');
}

function showToast(msg) {
  const t = document.getElementById('toast-msg');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ==========================================
// 6. MOBILE TOUCH CONTROLS (JOYSTICK + LOOK)
// ==========================================
const input = { moveX: 0, moveY: 0, yaw: Math.PI, pitch: 0.15, jump: false, sprint: false };
let velocityY = 0;
let isGrounded = true;

// Virtual Joystick
const joyZone = document.getElementById('joystick-zone');
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
let joyTouchId = null;

joyZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joyTouchId = touch.identifier;
  updateJoystick(touch);
}, { passive: false });

joyZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (t.identifier === joyTouchId) updateJoystick(t);
  }
}, { passive: false });

joyZone.addEventListener('touchend', (e) => {
  for (let t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      input.moveX = 0;
      input.moveY = 0;
      joyKnob.style.transform = 'translate(0px, 0px)';
    }
  }
});

function updateJoystick(touch) {
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxR = 38;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.moveX = dx / maxR;
  input.moveY = dy / maxR;
}

// Right-Side Touch Camera Look
const lookZone = document.getElementById('look-zone');
let lookTouchId = null;
let lastLookX = 0;
let lastLookY = 0;

lookZone.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  lookTouchId = t.identifier;
  lastLookX = t.clientX;
  lastLookY = t.clientY;
});

lookZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (t.identifier === lookTouchId) {
      const dx = t.clientX - lastLookX;
      const dy = t.clientY - lastLookY;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
      input.yaw -= dx * 0.0065;
      input.pitch = Math.max(-0.45, Math.min(0.65, input.pitch + dy * 0.005));
    }
  }
}, { passive: false });

lookZone.addEventListener('touchend', (e) => {
  for (let t of e.changedTouches) {
    if (t.identifier === lookTouchId) lookTouchId = null;
  }
});

// Action Buttons
const btnSprint = document.getElementById('btn-sprint');
btnSprint.addEventListener('touchstart', (e) => { e.preventDefault(); input.sprint = true; btnSprint.classList.add('active'); });
btnSprint.addEventListener('touchend', () => { input.sprint = false; btnSprint.classList.remove('active'); });

document.getElementById('btn-jump').addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (isGrounded) {
    velocityY = 6.8;
    isGrounded = false;
  }
});

document.getElementById('btn-interact').addEventListener('touchstart', (e) => {
  e.preventDefault();
  tryCollectNearestRelic();
});

function toggleCamera() {
  state.isFirstPerson = !state.isFirstPerson;
  document.getElementById('btn-cam').textContent = state.isFirstPerson ? '1st Person' : '3rd Person';
  // Hide head/hair in 1st person so camera doesn't clip inside head
  localPlayer.userData.head.visible = !state.isFirstPerson;
  localPlayer.userData.hairTop.visible = !state.isFirstPerson;
}

// ==========================================
// 7. RELIC INTERACTION & COLLISIONS
// ==========================================
function tryCollectNearestRelic() {
  relics.forEach((r) => {
    if (!r.collected && localPlayer.position.distanceTo(r.mesh.position) < 2.6) {
      collectRelicLocal(r.id, true);
    }
  });
}

function collectRelicLocal(id, broadcast) {
  const relic = relics[id];
  if (!relic || relic.collected) return;
  relic.collected = true;
  relic.mesh.visible = false;
  state.relicsCollected++;
  document.getElementById('relic-count').textContent = state.relicsCollected;
  showToast(`Relic ${state.relicsCollected}/5 recovered!`);

  if (broadcast && state.isConnected && conn) {
    conn.send({ type: 'relic', id });
  }

  if (state.relicsCollected >= state.totalRelics) {
    gateArch.visible = false;
    colliders.length = 0; // Open sanctuary exit
    showToast('Sanctuary Gate Unlocked! Walk to the golden beacon!');
  }
}

function checkCollision(nx, nz) {
  for (let box of colliders) {
    if (nx > box.minX && nx < box.maxX && nz > box.minZ && nz < box.maxZ) return true;
  }
  return Math.abs(nx) > 33 || Math.abs(nz) > 33;
}

function animateLimbs(charMesh, speed, time) {
  const { leftLeg, rightLeg, leftArm, rightArm } = charMesh.userData;
  if (speed > 0.05) {
    const swing = Math.sin(time * 1.6) * 0.55;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.7;
    rightArm.rotation.x = swing * 0.7;
  } else {
    leftLeg.rotation.x = 0;
    rightLeg.rotation.x = 0;
    leftArm.rotation.x = 0;
    rightArm.rotation.x = 0;
  }
}

// ==========================================
// 8. MAIN GAME LOOP
// ==========================================
let lastTime = performance.now();
let netTick = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Rotate glowing relics
  relics.forEach((r, idx) => {
    if (!r.collected) {
      r.mesh.rotation.y += dt * 1.8;
      r.mesh.position.y = 1.1 + Math.sin(now * 0.003 + idx) * 0.15;
    }
  });

  if (state.gameStarted) {
    // Movement relative to camera yaw
    const moveMag = Math.hypot(input.moveX, input.moveY);
    const speed = (input.sprint ? 7.2 : 4.2) * Math.min(moveMag, 1);

    if (moveMag > 0.08) {
      const forwardX = -Math.sin(input.yaw);
      const forwardZ = -Math.cos(input.yaw);
      const rightX = Math.cos(input.yaw);
      const rightZ = -Math.sin(input.yaw);

      const dirX = forwardX * (-input.moveY) + rightX * input.moveX;
      const dirZ = forwardZ * (-input.moveY) + rightZ * input.moveX;
      const norm = Math.hypot(dirX, dirZ) || 1;

      const vx = (dirX / norm) * speed * dt;
      const vz = (dirZ / norm) * speed * dt;

      if (!checkCollision(localPlayer.position.x + vx, localPlayer.position.z)) {
        localPlayer.position.x += vx;
      }
      if (!checkCollision(localPlayer.position.x, localPlayer.position.z + vz)) {
        localPlayer.position.z += vz;
      }

      localPlayer.rotation.y = Math.atan2(dirX, dirZ);
    }

    // Gravity & Jump
    velocityY -= 16 * dt;
    localPlayer.position.y += velocityY * dt;
    if (localPlayer.position.y <= 0) {
      localPlayer.position.y = 0;
      velocityY = 0;
      isGrounded = true;
    }

    animateLimbs(localPlayer, speed, now * 0.008);

    // Auto-check relic proximity
    tryCollectNearestRelic();

    // Check Escape Win Condition
    if (state.relicsCollected >= state.totalRelics && localPlayer.position.z > 27) {
      state.gameStarted = false;
      document.getElementById('win-screen').classList.remove('hidden');
    }

    // Sync Position to Partner (20 times/sec)
    netTick += dt;
    if (state.isConnected && conn && netTick > 0.05) {
      netTick = 0;
      conn.send({
        type: 'move',
        x: localPlayer.position.x,
        y: localPlayer.position.y,
        z: localPlayer.position.z,
        ry: localPlayer.rotation.y,
        speed
      });
    }
  }

  // Camera Positioning (1st Person vs 3rd Person)
  if (state.isFirstPerson) {
    camera.position.set(
      localPlayer.position.x,
      localPlayer.position.y + 1.82,
      localPlayer.position.z
    );
    const lookX = camera.position.x - Math.sin(input.yaw) * Math.cos(input.pitch);
    const lookY = camera.position.y - Math.sin(input.pitch);
    const lookZ = camera.position.z - Math.cos(input.yaw) * Math.cos(input.pitch);
    camera.lookAt(lookX, lookY, lookZ);
    localPlayer.rotation.y = input.yaw + Math.PI;
  } else {
    const camDist = 4.4;
    const camHeight = 2.4 + input.pitch * 2.2;
    const camX = localPlayer.position.x + Math.sin(input.yaw) * camDist;
    const camZ = localPlayer.position.z + Math.cos(input.yaw) * camDist;
    camera.position.lerp(new THREE.Vector3(camX, localPlayer.position.y + camHeight, camZ), 0.22);
    camera.lookAt(localPlayer.position.x, localPlayer.position.y + 1.45, localPlayer.position.z);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(performance.now());
