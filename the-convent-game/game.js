// ==========================================
// 1. GAME STATE & 4 CHARACTER PROFILES
// ==========================================
const ROLES = {
  explorer: { gender: 'male', jacket: 0x2c4257, pants: 0x1e242b, hair: 0x181512, pack: true, badge: false },
  investigator: { gender: 'female', jacket: 0x7f1d1d, pants: 0x263028, hair: 0x1a1412, pack: false, badge: false },
  guard: { gender: 'male', jacket: 0x172033, pants: 0x11151f, hair: 0x141414, pack: false, badge: true },
  survivor: { gender: 'female', jacket: 0x6b7280, pants: 0x4b4237, hair: 0x1c1714, pack: false, badge: false }
};

const state = {
  playerName: 'Harsh',
  role: 'explorer',
  isFirstPerson: false,
  isConnected: false,
  isHost: false,
  gameStarted: false,
  startTime: 0,
  hp: 100,
  isHidden: false,
  isCaught: false,
  activeSlot: 0,
  inventory: { flashlight: true, crowbar: false, key: false, cutters: false },
  crateOpened: false,
  chapelUnlocked: false,
  exitCut: false
};

let peer = null;
let conn = null;

// ==========================================
// 2. THREE.JS SCENE & ATMOSPHERIC LIGHTING
// ==========================================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090d);
scene.fog = new THREE.FogExp2(0x07090d, 0.042);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 120);

scene.add(new THREE.HemisphereLight(0x64748b, 0x0f1218, 0.42));
const moonLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
moonLight.position.set(20, 42, 25);
moonLight.castShadow = true;
scene.add(moonLight);

// Checkered Marble Floor (Main Hall & Chapel) + Stone Courtyard
function createCheckeredMarble() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#262930';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#121418';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 26);
  return t;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshStandardMaterial({ map: createCheckeredMarble(), roughness: 0.65, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ==========================================
// 3. 4 CONVENT ZONES: EXTERIOR, MAIN HALL, CHAPEL, BASEMENT
// ==========================================
const colliders = [];
const wallMat = new THREE.MeshStandardMaterial({ color: 0x252830, roughness: 0.88 });
const archMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.85 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.85 });
const lockerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.4 });

function addBox(x, y, z, w, h, d, mat = wallMat, solid = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  if (solid) {
    colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4 });
  }
  return m;
}

// Outer Convent Boundaries
addBox(0, 3, -32, 64, 6, 1.2); // North Chapel Back Wall
addBox(-32, 3, 0, 1.2, 6, 64); // West Wall
addBox(32, 3, 0, 1.2, 6, 64);  // East Wall
addBox(-18, 3, 32, 28, 6, 1.2); // South Exterior Left
addBox(18, 3, 32, 28, 6, 1.2);  // South Exterior Right

// ZONE 1: CHAPEL (North: z < -12)
addBox(-17, 3, -12, 26, 6, 1.2);
addBox(17, 3, -12, 26, 6, 1.2);
// Locked Chapel Door (Center z = -12)
const chapelDoorMesh = addBox(0, 2.3, -12, 8, 4.6, 0.8, new THREE.MeshStandardMaterial({ color: 0x4c1d1d, roughness: 0.7 }));

// Glowing Stained Glass Cross Window in Chapel
const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.6, 0.2), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
crossV.position.set(0, 3.6, -31.2);
const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.2), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
crossH.position.set(0, 4.2, -31.2);
scene.add(crossV, crossH);

// Chapel Wooden Pews
[-22, -18].forEach(pz => {
  addBox(-6, 0.55, pz, 5.5, 1.1, 0.9, woodMat);
  addBox(6, 0.55, pz, 5.5, 1.1, 0.9, woodMat);
});

// ZONE 2: MAIN HALL (Center: z -12 to +14)
[-6, 2, 10].forEach(hz => {
  addBox(-6.5, 3, hz, 1.2, 6, 1.2, archMat);
  addBox(6.5, 3, hz, 1.2, 6, 1.2, archMat);
});
const hallLamp = new THREE.PointLight(0xe2e8f0, 1.2, 22);
hallLamp.position.set(0, 5.2, 0);
scene.add(hallLamp);

// ZONE 3: BASEMENT STORAGE (East Wing: x > 14, z -10 to +12)
addBox(14, 3, -5, 1.2, 6, 12);
addBox(14, 3, 9, 1.2, 6, 10);
const basementLamp = new THREE.PointLight(0xf59e0b, 1.6, 18);
basementLamp.position.set(23, 4.6, 2);
scene.add(basementLamp);
// Basement Wooden Crate (Holds Bolt Cutters)
const crateMesh = addBox(25, 0.8, 4, 1.8, 1.6, 1.8, woodMat);

// ZONE 4: CONVENT EXTERIOR GATE (South: z = 32)
const exitGateMesh = addBox(0, 2.4, 32, 8, 4.8, 0.8, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 }));
const exitGlow = new THREE.PointLight(0x38bdf8, 1.5, 14);
exitGlow.position.set(0, 3.8, 30);
scene.add(exitGlow);

// Hiding Lockers
const lockers = [
  { x: -11, z: -10.8 },
  { x: 11, z: -10.8 },
  { x: -11, z: 12 },
  { x: 16, z: -10.8 }
];
lockers.forEach(l => addBox(l.x, 1.3, l.z, 1.3, 2.6, 1.1, lockerMat, false));

// World Collectible Items (Crowbar, Chapel Key, Bolt Cutters)
const worldItems = {
  crowbar: { pos: new THREE.Vector3(-24, 0.6, 2), taken: false, mesh: null },
  key: { pos: new THREE.Vector3(24, 0.6, -8), taken: false, mesh: null },
  cutters: { pos: new THREE.Vector3(25, 0.6, 4), taken: true, mesh: null } // Inside Basement Crate
};

function spawnItemGlow(color, x, z) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.9),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
  );
  g.add(bar, new THREE.PointLight(color, 1.3, 7));
  g.position.set(x, 0.6, z);
  scene.add(g);
  return g;
}

worldItems.crowbar.mesh = spawnItemGlow(0xf97316, -24, 2);
worldItems.key.mesh = spawnItemGlow(0xfacc15, 24, -8);
worldItems.cutters.mesh = spawnItemGlow(0x38bdf8, 25, 4);
worldItems.cutters.mesh.visible = false;

// ==========================================
// 4. 4 CHARACTER BUILDER + THE NUN MODEL
// ==========================================
function buildCharacterMesh(roleKey) {
  const cfg = ROLES[roleKey] || ROLES.explorer;
  const root = new THREE.Group();
  const isFemale = cfg.gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd69e76, roughness: 0.65 });
  const topMat = new THREE.MeshStandardMaterial({ color: cfg.jacket, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: cfg.pants, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: cfg.hair, roughness: 0.9 });

  const shoulderW = isFemale ? 0.54 : 0.72;
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), pantsMat);
  leftLeg.position.set(-0.15, 0.44, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), pantsMat);
  rightLeg.position.set(0.15, 0.44, 0);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(shoulderW, isFemale ? 0.72 : 0.8, 0.33), topMat);
  torso.position.set(0, 1.24, 0);

  if (cfg.pack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.22), new THREE.MeshStandardMaterial({ color: 0x292524 }));
    pack.position.set(0, 1.26, -0.25);
    root.add(pack);
  }
  if (cfg.badge) {
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    badge.position.set(0.16, 1.42, 0.18);
    root.add(badge);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.39, 0.35), skinMat);
  head.position.set(0, 1.85, 0);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.39), hairMat);
  hairTop.position.set(0, 2.03, -0.01);
  root.add(hairTop);

  if (isFemale) {
    const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.15), hairMat);
    ponytail.position.set(0, 1.8, -0.23);
    ponytail.rotation.x = 0.25;
    root.add(ponytail);
  }

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.17), roleKey === 'survivor' ? skinMat : topMat);
  leftArm.position.set(-(shoulderW / 2 + 0.1), 1.24, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.17), roleKey === 'survivor' ? skinMat : topMat);
  rightArm.position.set(shoulderW / 2 + 0.1, 1.24, 0);

  // Flashlight Cone
  const flashlight = new THREE.SpotLight(0xfff7ed, 2.8, 28, Math.PI / 5, 0.45, 1);
  flashlight.position.set(0, 1.35, 0.35);
  flashlight.target.position.set(0, 1.15, 8);
  root.add(flashlight, flashlight.target);

  root.add(leftLeg, rightLeg, torso, head, leftArm, rightArm);
  root.userData = { leftLeg, rightLeg, leftArm, rightArm, head, hairTop, flashlight };
  return root;
}

function buildTheNun() {
  const nun = new THREE.Group();
  const habitMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.95 });
  const wimpleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.8 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, emissive: 0x1e293b, emissiveIntensity: 0.45 });

  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.58, 1.78, 14), habitMat);
  robe.position.y = 0.89;
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.36), wimpleMat);
  bib.position.set(0, 1.58, 0.04);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.3), faceMat);
  face.position.set(0, 1.94, 0.04);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  eyeL.position.set(-0.07, 1.97, 0.19);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.07;

  const veil = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.46), habitMat);
  veil.position.set(0, 1.96, -0.04);

  const aura = new THREE.PointLight(0xdc2626, 2.0, 12);
  aura.position.set(0, 1.6, 0.4);

  nun.add(robe, bib, face, eyeL, eyeR, veil, aura);
  nun.position.set(0, 0, -24);
  scene.add(nun);
  return nun;
}

let localPlayer = buildCharacterMesh(state.role);
localPlayer.position.set(-2, 0, 22);
scene.add(localPlayer);

let remotePlayer = null;
const theNun = buildTheNun();
let nunWaypoint = new THREE.Vector3(0, 0, 0);

// ==========================================
// 5. LOBBY & MULTIPLAYER SYNC
// ==========================================
function selectRole(roleKey, cardEl) {
  state.role = roleKey;
  document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
  cardEl.classList.add('active');
  const pos = localPlayer.position.clone();
  scene.remove(localPlayer);
  localPlayer = buildCharacterMesh(roleKey);
  localPlayer.position.copy(pos);
  scene.add(localPlayer);
}

function hostMultiplayer() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('host-box').classList.remove('hidden');
  document.getElementById('room-code-text').textContent = code;
  document.getElementById('host-status').textContent = 'Creating room...';

  peer = new Peer('convent-coop-' + code);
  peer.on('open', () => {
    state.isHost = true;
    document.getElementById('host-status').textContent = 'Share code ' + code + ' with teammate...';
  });
  peer.on('connection', (c) => {
    conn = c;
    setupMultiplayer();
    launchGame();
  });
}

function joinMultiplayer() {
  const raw = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (raw.length < 4) return;
  document.getElementById('join-status').textContent = 'Connecting to ' + raw + '...';
  peer = new Peer();
  peer.on('open', () => {
    conn = peer.connect('convent-coop-' + raw, { reliable: true });
    conn.on('open', () => {
      setupMultiplayer();
      launchGame();
    });
  });
}

function setupMultiplayer() {
  state.isConnected = true;
  const myName = document.getElementById('player-name-input').value.trim() || 'Player 1';
  conn.send({ type: 'profile', name: myName, role: state.role });

  conn.on('data', (data) => {
    if (data.type === 'profile') {
      if (remotePlayer) scene.remove(remotePlayer);
      remotePlayer = buildCharacterMesh(data.role);
      remotePlayer.position.set(2, 0, 22);
      scene.add(remotePlayer);
      document.getElementById('remote-squad-card').classList.remove('hidden');
      document.getElementById('hud-remote-name').textContent = data.name;
      showAlert('info', '!', data.name + ' entered The Convent!');
    } else if (data.type === 'move' && remotePlayer) {
      remotePlayer.position.set(data.x, data.y, data.z);
      remotePlayer.rotation.y = data.ry;
      animateLimbs(remotePlayer, data.speed, performance.now() * 0.008);
    } else if (data.type === 'nun' && !state.isHost) {
      theNun.position.set(data.x, 0, data.z);
      theNun.rotation.y = data.ry;
    } else if (data.type === 'sync') {
      state.crateOpened = data.crateOpened;
      state.chapelUnlocked = data.chapelUnlocked;
      state.exitCut = data.exitCut;
      applyWorldSync();
    }
  });
}

function startSoloPlay() {
  state.isHost = true;
  launchGame();
}

function launchGame() {
  state.playerName = document.getElementById('player-name-input').value.trim() || 'Harsh';
  document.getElementById('hud-local-name').textContent = state.playerName;
  state.gameStarted = true;
  state.startTime = performance.now();
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
}

function showAlert(type, icon, text) {
  const banner = document.getElementById('alert-banner');
  banner.className = 'alert-banner ' + type;
  document.getElementById('alert-icon').textContent = icon;
  document.getElementById('alert-text').textContent = text;
}

// ==========================================
// 6. TOUCH & KEYBOARD CONTROLS + HOTBAR
// ==========================================
const input = { moveX: 0, moveY: 0, yaw: Math.PI, pitch: 0.12, sprint: false, crouch: false };
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'ShiftLeft') input.sprint = true;
  if (e.code === 'KeyC') toggleCrouch();
  if (e.code === 'KeyE') interactAction();
  if (e.code === 'Digit1') selectSlot(0);
  if (e.code === 'Digit2') selectSlot(1);
  if (e.code === 'Digit3') selectSlot(2);
  if (e.code === 'Digit4') selectSlot(3);
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'ShiftLeft') input.sprint = false;
});

function selectSlot(idx) {
  state.activeSlot = idx;
  document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('active', i === idx));
  localPlayer.userData.flashlight.visible = (idx === 0);
}

// Virtual Joystick
const joyZone = document.getElementById('joystick-zone');
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
let joyId = null;

joyZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  joyId = e.changedTouches[0].identifier;
  moveJoy(e.changedTouches[0]);
}, { passive: false });
joyZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let t of e.changedTouches) if (t.identifier === joyId) moveJoy(t);
}, { passive: false });
joyZone.addEventListener('touchend', (e) => {
  for (let t of e.changedTouches) if (t.identifier === joyId) {
    joyId = null; input.moveX = 0; input.moveY = 0;
    joyKnob.style.transform = 'translate(0px,0px)';
  }
});

function moveJoy(t) {
  const r = joyBase.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2);
  let dy = t.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > 34) { dx = (dx / d) * 34; dy = (dy / d) * 34; }
  joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  input.moveX = dx / 34; input.moveY = dy / 34;
}

// Look Swipe / Mouse Drag
const lookZone = document.getElementById('look-zone');
let lookId = null, lx = 0, ly = 0, dragging = false;

lookZone.addEventListener('touchstart', (e) => { lookId = e.changedTouches[0].identifier; lx = e.changedTouches[0].clientX; ly = e.changedTouches[0].clientY; });
lookZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let t of e.changedTouches) if (t.identifier === lookId) {
    input.yaw -= (t.clientX - lx) * 0.0065;
    input.pitch = Math.max(-0.4, Math.min(0.6, input.pitch + (t.clientY - ly) * 0.005));
    lx = t.clientX; ly = t.clientY;
  }
}, { passive: false });
lookZone.addEventListener('touchend', () => { lookId = null; });

lookZone.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  input.yaw -= (e.clientX - lx) * 0.005;
  input.pitch = Math.max(-0.4, Math.min(0.6, input.pitch + (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });

// Action Buttons
function toggleCrouch() {
  input.crouch = !input.crouch;
  document.getElementById('btn-crouch').classList.toggle('active', input.crouch);
  localPlayer.scale.y = input.crouch ? 0.65 : 1;
}
document.getElementById('btn-crouch').addEventListener('click', toggleCrouch);

const btnSprint = document.getElementById('btn-sprint');
btnSprint.addEventListener('touchstart', (e) => { e.preventDefault(); input.sprint = true; btnSprint.classList.add('active'); });
btnSprint.addEventListener('touchend', () => { input.sprint = false; btnSprint.classList.remove('active'); });
btnSprint.addEventListener('mousedown', () => { input.sprint = true; btnSprint.classList.add('active'); });
btnSprint.addEventListener('mouseup', () => { input.sprint = false; btnSprint.classList.remove('active'); });

document.getElementById('btn-interact').addEventListener('click', interactAction);

function toggleCamera() {
  state.isFirstPerson = !state.isFirstPerson;
  document.getElementById('btn-cam').textContent = state.isFirstPerson ? '1ST PERSON' : '3RD PERSON';
  localPlayer.userData.head.visible = !state.isFirstPerson;
  localPlayer.userData.hairTop.visible = !state.isFirstPerson;
}

// ==========================================
// 7. INTERACTIONS: LOCKERS, ITEMS, DOORS
// ==========================================
function interactAction() {
  if (state.isCaught) return;

  // Toggle Locker Hide
  if (state.isHidden) {
    state.isHidden = false;
    localPlayer.visible = true;
    showAlert('info', '!', 'Stepped out of locker.');
    return;
  }
  for (let l of lockers) {
    if (Math.hypot(localPlayer.position.x - l.x, localPlayer.position.z - l.z) < 2.2) {
      state.isHidden = true;
      localPlayer.visible = false;
      showAlert('success', '✔', 'Hidden inside locker! The Nun cannot see you.');
      return;
    }
  }

  // Pick up World Items
  if (!worldItems.crowbar.taken && localPlayer.position.distanceTo(worldItems.crowbar.pos) < 2.6) {
    worldItems.crowbar.taken = true;
    worldItems.crowbar.mesh.visible = false;
    state.inventory.crowbar = true;
    document.getElementById('icon-crowbar').textContent = '🪓';
    selectSlot(1);
    showAlert('success', '✔', 'Picked up Crowbar! Break open the Basement crate.');
    return;
  }
  if (!worldItems.key.taken && localPlayer.position.distanceTo(worldItems.key.pos) < 2.6) {
    worldItems.key.taken = true;
    worldItems.key.mesh.visible = false;
    state.inventory.key = true;
    document.getElementById('icon-key').textContent = '🗝️';
    selectSlot(2);
    showAlert('success', '✔', 'Found the Chapel Key!');
    return;
  }
  if (!worldItems.cutters.taken && localPlayer.position.distanceTo(worldItems.cutters.pos) < 2.6) {
    worldItems.cutters.taken = true;
    worldItems.cutters.mesh.visible = false;
    state.inventory.cutters = true;
    document.getElementById('icon-cutters').textContent = '✂️';
    selectSlot(3);
    showAlert('success', '✔', 'Found Bolt Cutters! Cut the Convent Exterior Gate chains!');
    return;
  }

  // Use Crowbar on Basement Crate
  if (!state.crateOpened && localPlayer.position.distanceTo(crateMesh.position) < 2.8) {
    if (state.inventory.crowbar) {
      state.crateOpened = true;
      worldItems.cutters.taken = false;
      worldItems.cutters.mesh.visible = true;
      applyWorldSync();
      broadcastSync();
      showAlert('success', '✔', 'Crate pried open! Grab the Bolt Cutters inside!');
    } else {
      showAlert('info', '!', 'Locked wooden crate! Find the Crowbar in the West Wing.');
    }
    return;
  }

  // Unlock Chapel Door
  if (!state.chapelUnlocked && localPlayer.position.distanceTo(chapelDoorMesh.position) < 3.4) {
    if (state.inventory.key) {
      state.chapelUnlocked = true;
      applyWorldSync();
      broadcastSync();
      showAlert('success', '✔', 'Chapel Door unlocked!');
    } else {
      showAlert('info', '!', 'Chapel Door is locked. Find the hidden Chapel Key!');
    }
    return;
  }

  // Cut Convent Exterior Gate
  if (!state.exitCut && localPlayer.position.distanceTo(exitGateMesh.position) < 3.6) {
    if (state.inventory.cutters && state.chapelUnlocked) {
      state.exitCut = true;
      applyWorldSync();
      broadcastSync();
      showAlert('success', '✔', 'Exterior Gate unlocked! Step outside to escape!');
    } else {
      showAlert('info', '!', 'Unlock the Chapel & get Bolt Cutters from the Basement first!');
    }
  }
}

function applyWorldSync() {
  if (state.crateOpened) crateMesh.visible = false;
  if (state.chapelUnlocked) chapelDoorMesh.visible = false;
  if (state.exitCut) {
    exitGateMesh.visible = false;
    exitGlow.color.setHex(0x22c55e);
  }
}

function broadcastSync() {
  if (state.isConnected && conn) {
    conn.send({
      type: 'sync',
      crateOpened: state.crateOpened,
      chapelUnlocked: state.chapelUnlocked,
      exitCut: state.exitCut
    });
  }
}

function respawnInLocker() {
  state.isCaught = false;
  state.isHidden = true;
  localPlayer.visible = false;
  localPlayer.position.set(-11, 0, 10.5);
  document.getElementById('caught-screen').classList.add('hidden');
  showAlert('info', '!', 'Hidden inside a locker! Press Hand icon when safe.');
}

function checkCollision(nx, nz) {
  if (state.chapelUnlocked && Math.abs(nx) < 3.6 && nz > -13 && nz < -11) return false;
  if (state.exitCut && Math.abs(nx) < 3.6 && nz > 30) return false;
  for (let b of colliders) {
    if (nx > b.minX && nx < b.maxX && nz > b.minZ && nz < b.maxZ) return true;
  }
  return Math.abs(nx) > 31 || Math.abs(nz) > 33;
}

function animateLimbs(mesh, speed, time) {
  const { leftLeg, rightLeg, leftArm, rightArm } = mesh.userData;
  if (speed > 0.05) {
    const s = Math.sin(time * 1.7) * 0.55;
    leftLeg.rotation.x = s; rightLeg.rotation.x = -s;
    leftArm.rotation.x = -s * 0.7; rightArm.rotation.x = s * 0.7;
  } else {
    leftLeg.rotation.x = rightLeg.rotation.x = leftArm.rotation.x = rightArm.rotation.x = 0;
  }
}

// ==========================================
// 8. RADAR MINIMAP RENDERER
// ==========================================
const radarCtx = document.getElementById('radar-canvas').getContext('2d');
function drawRadar() {
  radarCtx.clearRect(0, 0, 96, 96);
  const cx = 48, cy = 48, scale = 1.35;
  radarCtx.save();
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, 46, 0, Math.PI * 2);
  radarCtx.clip();

  // Player dot (Center)
  radarCtx.fillStyle = '#38bdf8';
  radarCtx.beginPath();
  radarCtx.arc(cx, cy, 4, 0, Math.PI * 2);
  radarCtx.fill();

  // Helper to plot relative points
  const plot = (wx, wz, color, r = 3.5) => {
    const dx = (wx - localPlayer.position.x) * scale;
    const dz = (wz - localPlayer.position.z) * scale;
    const cos = Math.cos(-input.yaw), sin = Math.sin(-input.yaw);
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    radarCtx.fillStyle = color;
    radarCtx.beginPath();
    radarCtx.arc(cx + rx, cy + rz, r, 0, Math.PI * 2);
    radarCtx.fill();
  };

  // Plot Items, Remote Teammate & The Nun
  if (!worldItems.crowbar.taken) plot(worldItems.crowbar.pos.x, worldItems.crowbar.pos.z, '#f97316', 3);
  if (!worldItems.key.taken) plot(worldItems.key.pos.x, worldItems.key.pos.z, '#facc15', 3);
  if (remotePlayer) plot(remotePlayer.position.x, remotePlayer.position.z, '#22c55e', 4);
  plot(theNun.position.x, theNun.position.z, '#ef4444', 4.5);

  radarCtx.restore();
}

// ==========================================
// 9. MAIN ANIMATION & AI LOOP
// ==========================================
let lastTime = performance.now();
let netTick = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  Object.values(worldItems).forEach(it => { if (!it.taken && it.mesh) it.mesh.rotation.y += dt * 2; });

  if (state.gameStarted && !state.isCaught) {
    // Update Timer & Zone Label
    const elapsed = Math.floor((now - state.startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.getElementById('game-timer').textContent = `${mins}:${secs}`;

    const pz = localPlayer.position.z, px = localPlayer.position.x;
    document.getElementById('hud-zone-label').textContent =
      pz < -12 ? 'Chapel' : (px > 14 ? 'Basement' : (pz > 16 ? 'Exterior' : 'Main Hall'));

    // Movement
    let mx = input.moveX, my = input.moveY;
    if (keys['KeyW'] || keys['ArrowUp']) my = -1;
    if (keys['KeyS'] || keys['ArrowDown']) my = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) mx = 1;

    const mag = Math.hypot(mx, my);
    const baseSpeed = input.crouch ? 2.2 : (input.sprint ? 6.8 : 4.0);
    const speed = state.isHidden ? 0 : baseSpeed * Math.min(mag, 1);

    if (mag > 0.08 && !state.isHidden) {
      const fx = -Math.sin(input.yaw), fz = -Math.cos(input.yaw);
      const rx = Math.cos(input.yaw), rz = -Math.sin(input.yaw);
      const dx = fx * (-my) + rx * mx;
      const dz = fz * (-my) + rz * mx;
      const n = Math.hypot(dx, dz) || 1;
      const vx = (dx / n) * speed * dt;
      const vz = (dz / n) * speed * dt;
      if (!checkCollision(localPlayer.position.x + vx, localPlayer.position.z)) localPlayer.position.x += vx;
      if (!checkCollision(localPlayer.position.x, localPlayer.position.z + vz)) localPlayer.position.z += vz;
      localPlayer.rotation.y = Math.atan2(dx, dz);
    }

    animateLimbs(localPlayer, speed, now * 0.008);

    // THE NUN AI PATROL & CHASE
    if (state.isHost) {
      const d = theNun.position.distanceTo(localPlayer.position);
      const spotted = !state.isHidden && (d < (input.crouch ? 7 : 13) || (input.sprint && speed > 4.5 && d < 18));
      if (spotted) {
        nunWaypoint.copy(localPlayer.position);
      } else if (theNun.position.distanceTo(nunWaypoint) < 1.5) {
        const patrolPts = [
          new THREE.Vector3(0, 0, -22),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(22, 0, 0),
          new THREE.Vector3(-20, 0, 4),
          new THREE.Vector3(0, 0, 20)
        ];
        nunWaypoint.copy(patrolPts[Math.floor(Math.random() * patrolPts.length)]);
      }

      const toW = new THREE.Vector3().subVectors(nunWaypoint, theNun.position);
      toW.y = 0;
      if (toW.length() > 0.2) {
        toW.normalize();
        theNun.position.addScaledVector(toW, (spotted ? 4.4 : 2.4) * dt);
        theNun.rotation.y = Math.atan2(toW.x, toW.z);
      }
    }

    // Proximity Warning & Catch
    const nunDist = theNun.position.distanceTo(localPlayer.position);
    const nearNun = nunDist < 11 && !state.isHidden;
    document.getElementById('danger-vignette').classList.toggle('hidden', !nearNun);
    if (nearNun) showAlert('danger', '⚠', 'The Nun is near...!');

    if (!state.isHidden && nunDist < 1.35) {
      state.isCaught = true;
      document.getElementById('caught-screen').classList.remove('hidden');
    }

    // Escape Victory Check
    if (state.exitCut && localPlayer.position.z > 32) {
      state.gameStarted = false;
      document.getElementById('final-time').textContent = document.getElementById('game-timer').textContent;
      document.getElementById('win-screen').classList.remove('hidden');
    }

    // Sync Co-op State
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
      if (state.isHost) {
        conn.send({ type: 'nun', x: theNun.position.x, z: theNun.position.z, ry: theNun.rotation.y });
      }
    }

    drawRadar();
  }

  // Camera Positioning
  if (state.isFirstPerson) {
    camera.position.set(localPlayer.position.x, input.crouch ? 1.15 : 1.8, localPlayer.position.z);
    const lx = camera.position.x - Math.sin(input.yaw) * Math.cos(input.pitch);
    const ly = camera.position.y - Math.sin(input.pitch);
    const lz = camera.position.z - Math.cos(input.yaw) * Math.cos(input.pitch);
    camera.lookAt(lx, ly, lz);
    localPlayer.rotation.y = input.yaw + Math.PI;
  } else {
    const dist = 4.2;
    const h = 2.3 + input.pitch * 2.0;
    const cx = localPlayer.position.x + Math.sin(input.yaw) * dist;
    const cz = localPlayer.position.z + Math.cos(input.yaw) * dist;
    camera.position.lerp(new THREE.Vector3(cx, h, cz), 0.22);
    camera.lookAt(localPlayer.position.x, 1.4, localPlayer.position.z);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// animation loop started by the UI bridge below

// ==========================================
// 10. UI BRIDGE & QUALITY-OF-LIFE FIXES
// ==========================================
window.selectRole = selectRole;
window.hostMultiplayer = hostMultiplayer;
window.joinMultiplayer = joinMultiplayer;
window.startSoloPlay = startSoloPlay;
window.respawnInLocker = respawnInLocker;

const _showAlert = showAlert;
let alertHideAt = 0;
showAlert = function(type, icon, message) {
  _showAlert(type, icon, message);
  const banner = document.getElementById('alert-banner');
  if (banner) {
    banner.className = 'alert-banner ' + type;
    alertHideAt = performance.now() + (type === 'danger' ? 1600 : 2600);
  }
};

const _launchGame = launchGame;
launchGame = function() {
  _launchGame();
  const count = document.getElementById('team-count');
  if (count) count.textContent = state.isConnected ? '2/4' : '1/4';
  const task = document.getElementById('task-pill');
  if (task) task.textContent = 'Find the crowbar, key and bolt cutters';
};

const _selectSlot = selectSlot;
selectSlot = function(idx) {
  _selectSlot(idx);
  document.querySelectorAll('.slot').forEach((slot, i) => slot.classList.toggle('active', i === idx));
};

document.getElementById('btn-jump').addEventListener('click', () => {
  if (!state.gameStarted || state.isHidden || state.isCaught) return;
  if (localPlayer.position.y < 0.03) {
    localPlayer.position.y = 0.32;
    setTimeout(() => { if (localPlayer) localPlayer.position.y = 0; }, 260);
  }
  showAlert('info', '↑', 'Keep moving — the Nun can hear you!');
});

document.getElementById('btn-jump').addEventListener('touchstart', e => {
  e.preventDefault();
  if (!state.gameStarted || state.isHidden || state.isCaught) return;
  localPlayer.position.y = 0.32;
  setTimeout(() => { if (localPlayer) localPlayer.position.y = 0; }, 260);
}, {passive:false});

document.getElementById('btn-sprint').addEventListener('touchcancel', () => {
  input.sprint = false;
  document.getElementById('btn-sprint').classList.remove('active');
});

document.getElementById('join-code-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});

const originalAnimate = animate;
const alertBanner = document.getElementById('alert-banner');
function updateExtraHud(now) {
  if (alertBanner && alertHideAt && now > alertHideAt && !state.isCaught) {
    alertBanner.classList.add('hidden');
    alertHideAt = 0;
  }
  if (state.inventory.crowbar && state.inventory.key && state.inventory.cutters) {
    const task = document.getElementById('task-pill');
    if (task && !state.exitCut) task.textContent = 'Unlock the exterior gate';
  } else if (state.inventory.crowbar && !state.crateOpened) {
    const task = document.getElementById('task-pill');
    if (task) task.textContent = 'Open the basement crate';
  } else if (state.inventory.key && !state.chapelUnlocked) {
    const task = document.getElementById('task-pill');
    if (task) task.textContent = 'Unlock the chapel door';
  }
}
const _animateForHud = animate;
animate = function(now) {
  updateExtraHud(now);
  _animateForHud(now);
};
requestAnimationFrame(animate);

// Keep the mobile action buttons usable without triggering browser gestures.
['btn-crouch','btn-sprint','btn-jump','btn-interact','btn-cam'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('contextmenu', e => e.preventDefault());
});
