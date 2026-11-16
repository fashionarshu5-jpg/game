// ==========================================
// 1. STATE & INVENTORY
// ==========================================
const state = {
  gender: 'male',
  jacketColor: '#263238',
  isFirstPerson: false,
  isConnected: false,
  isHost: false,
  gameStarted: false,
  isHiddenInLocker: false,
  isCaught: false,
  heldItem: null, // 'crowbar' | 'key' | 'cutters'
  crateOpened: false,
  chainCut: false,
  keyUnlocked: false
};

let peer = null;
let conn = null;

// ==========================================
// 2. THREE.JS DARK CONVENT SCENE
// ==========================================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060709);
scene.fog = new THREE.FogExp2(0x060709, 0.048);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 110);

// Eerie Dim Convent Lighting
scene.add(new THREE.HemisphereLight(0x475569, 0x0f1115, 0.35));

const moonLight = new THREE.DirectionalLight(0x64748b, 0.45);
moonLight.position.set(18, 35, 15);
moonLight.castShadow = true;
scene.add(moonLight);

// Checkered Convent Floor
function createFloorTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#181a1f';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#111317';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(22, 22);
  return t;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ map: createFloorTex(), roughness: 0.85 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ==========================================
// 3. SCHOOL / CONVENT HALLS, LOCKERS & ESCAPE OBJECTS
// ==========================================
const colliders = [];
const wallMat = new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2516, roughness: 0.85 });
const lockerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.4 });

function addWall(x, y, z, w, h, d, mat = wallMat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  colliders.push({ minX: x - w / 2 - 0.42, maxX: x + w / 2 + 0.42, minZ: z - d / 2 - 0.42, maxZ: z + d / 2 + 0.42 });
  return m;
}

// Outer Convent Walls
addWall(0, 2.5, -26, 52, 5, 1.2);
addWall(-26, 2.5, 0, 1.2, 5, 52);
addWall(26, 2.5, 0, 1.2, 5, 52);
addWall(-15, 2.5, 26, 22, 5, 1.2);
addWall(15, 2.5, 26, 22, 5, 1.2);

// Interior Classroom / Hallway Partitions
addWall(-10, 2.5, -10, 12, 5, 1);
addWall(10, 2.5, -10, 12, 5, 1);
addWall(-10, 2.5, 8, 12, 5, 1);
addWall(10, 2.5, 8, 12, 5, 1);

// Hiding Lockers around the school
const lockers = [
  { x: -15, z: -8.8 },
  { x: 15, z: -8.8 },
  { x: -15, z: 9.2 },
  { x: 15, z: 9.2 },
  { x: -24.5, z: 0 }
];
lockers.forEach(l => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.5, 1.1), lockerMat);
  mesh.position.set(l.x, 1.25, l.z);
  mesh.castShadow = true;
  scene.add(mesh);
});

// Locked Front Exit Gate (North z = 26)
const exitDoorMesh = addWall(0, 2.2, 26, 8, 4.4, 0.8, new THREE.MeshStandardMaterial({ color: 0x451a1a, roughness: 0.7 }));
const exitBeacon = new THREE.PointLight(0xef4444, 1.4, 12);
exitBeacon.position.set(0, 3.6, 24.5);
scene.add(exitBeacon);

// Boarded Wooden Crate (Contains Main Gate Key)
const crateMesh = addWall(-19, 0.75, -19, 1.6, 1.5, 1.6, woodMat);

// Collectible Escape Tools (Crowbar & Bolt Cutters)
const tools = {
  crowbar: {
    name: 'Rusty Crowbar',
    pos: new THREE.Vector3(19, 0.6, -18),
    taken: false,
    mesh: null
  },
  cutters: {
    name: 'Bolt Cutters',
    pos: new THREE.Vector3(19, 0.6, 17),
    taken: false,
    mesh: null
  },
  key: {
    name: 'Main Gate Key',
    pos: new THREE.Vector3(-19, 0.6, -19),
    taken: true, // Hidden inside crate until crowbar opens it
    mesh: null
  }
};

function createToolProp(colorHex, x, z) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.95),
    new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.35 })
  );
  const light = new THREE.PointLight(colorHex, 1.1, 6);
  g.add(bar, light);
  g.position.set(x, 0.55, z);
  scene.add(g);
  return g;
}

tools.crowbar.mesh = createToolProp(0xf59e0b, tools.crowbar.pos.x, tools.crowbar.pos.z);
tools.cutters.mesh = createToolProp(0x38bdf8, tools.cutters.pos.x, tools.cutters.pos.z);
tools.key.mesh = createToolProp(0xfacc15, tools.key.pos.x, tools.key.pos.z);
tools.key.mesh.visible = false;

// ==========================================
// 4. REALISTIC MALE & FEMALE STUDENTS + THE NUN
// ==========================================
function buildStudentMesh(gender, jacketHex) {
  const root = new THREE.Group();
  const isFemale = gender === 'female';

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.65 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(jacketHex), roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x161310, roughness: 0.9 });

  const shoulderW = isFemale ? 0.54 : 0.7;
  const torsoH = isFemale ? 0.72 : 0.8;

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), pantsMat);
  leftLeg.position.set(-0.15, 0.44, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), pantsMat);
  rightLeg.position.set(0.15, 0.44, 0);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(shoulderW, torsoH, 0.33), jacketMat);
  torso.position.set(0, 1.24, 0);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.39, 0.35), skinMat);
  head.position.set(0, 1.85, 0);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.39), hairMat);
  hairTop.position.set(0, 2.03, -0.01);
  root.add(hairTop);

  if (isFemale) {
    const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.15), hairMat);
    ponytail.position.set(0, 1.82, -0.23);
    ponytail.rotation.x = 0.25;
    root.add(ponytail);
  }

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.17), jacketMat);
  leftArm.position.set(-(shoulderW / 2 + 0.1), 1.24, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.17), jacketMat);
  rightArm.position.set(shoulderW / 2 + 0.1, 1.24, 0);

  // Flashlight Beam
  const flashlight = new THREE.SpotLight(0xfff3d1, 2.6, 26, Math.PI / 5, 0.45, 1);
  flashlight.position.set(0, 1.35, 0.35);
  flashlight.target.position.set(0, 1.15, 8);
  root.add(flashlight, flashlight.target);

  root.add(leftLeg, rightLeg, torso, head, leftArm, rightArm);
  root.userData = { leftLeg, rightLeg, leftArm, rightArm, head, hairTop };
  return root;
}

// Build THE NUN (Sister Madeline) 3D Horror Character
function buildNunCharacter() {
  const nun = new THREE.Group();
  const blackRobeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.95 });
  const whiteWimpleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.8 });
  const paleFaceMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, emissive: 0x1e293b, emissiveIntensity: 0.4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  // Long Flowing Black Habit Robe
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.56, 1.75, 12), blackRobeMat);
  robe.position.y = 0.88;
  robe.castShadow = true;

  // White Chest Bib / Wimple
  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.36), whiteWimpleMat);
  bib.position.set(0, 1.56, 0.04);

  // Pale Gaunt Face
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.3), paleFaceMat);
  face.position.set(0, 1.92, 0.04);

  // Glowing Demon Eyes
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.04), eyeMat);
  eyeL.position.set(-0.07, 1.95, 0.19);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.04), eyeMat);
  eyeR.position.set(0.07, 1.95, 0.19);

  // Black Veil Hood
  const veil = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.44), blackRobeMat);
  veil.position.set(0, 1.94, -0.04);

  // Creepy Red Terror Aura Light
  const terrorLight = new THREE.PointLight(0xdc2626, 1.8, 11);
  terrorLight.position.set(0, 1.6, 0.4);

  nun.add(robe, bib, face, eyeL, eyeR, veil, terrorLight);
  nun.position.set(0, 0, -20);
  scene.add(nun);
  return nun;
}

let localPlayer = buildStudentMesh(state.gender, state.jacketColor);
localPlayer.position.set(-2, 0, 19);
scene.add(localPlayer);

let remotePlayer = null;
const theNun = buildNunCharacter();
let nunTarget = new THREE.Vector3(14, 0, -16);
let nunChasing = false;

// ==========================================
// 5. LOBBY & PEERJS MULTIPLAYER SYNC
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
  localPlayer = buildStudentMesh(state.gender, state.jacketColor);
  localPlayer.position.copy(pos);
  scene.add(localPlayer);
}

function hostGame() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('host-info').classList.remove('hidden');
  document.getElementById('room-code-display').textContent = code;
  document.getElementById('host-status').textContent = 'Creating room...';

  peer = new Peer('nun-coop-' + code);
  peer.on('open', () => {
    state.isHost = true;
    document.getElementById('host-status').textContent = 'Share code ' + code + ' with friend...';
  });
  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
    enterGame();
  });
}

function joinGame() {
  const raw = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (raw.length < 4) return;
  document.getElementById('join-status').textContent = 'Joining ' + raw + '...';
  peer = new Peer();
  peer.on('open', () => {
    conn = peer.connect('nun-coop-' + raw, { reliable: true });
    conn.on('open', () => {
      setupConnection();
      enterGame();
    });
  });
}

function setupConnection() {
  state.isConnected = true;
  conn.send({ type: 'profile', gender: state.gender, color: state.jacketColor });
  conn.on('data', (data) => {
    if (data.type === 'profile') {
      if (remotePlayer) scene.remove(remotePlayer);
      remotePlayer = buildStudentMesh(data.gender, data.color);
      remotePlayer.position.set(2, 0, 19);
      scene.add(remotePlayer);
      showToast('Your friend joined! Escape the Nun together!');
    } else if (data.type === 'move' && remotePlayer) {
      remotePlayer.position.set(data.x, data.y, data.z);
      remotePlayer.rotation.y = data.ry;
      animateLimbs(remotePlayer, data.speed, performance.now() * 0.008);
    } else if (data.type === 'nun' && !state.isHost) {
      theNun.position.set(data.x, 0, data.z);
      theNun.rotation.y = data.ry;
    } else if (data.type === 'progress') {
      state.crateOpened = data.crateOpened;
      state.chainCut = data.chainCut;
      state.keyUnlocked = data.keyUnlocked;
      updateWorldProgress();
    }
  });
}

function startSoloPreview() {
  state.isHost = true;
  enterGame();
}

function enterGame() {
  state.gameStarted = true;
  document.getElementById('lobby-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  showToast('Find Crowbar & Bolt Cutters to open the Front Gate!');
}

function showToast(msg) {
  const t = document.getElementById('toast-msg');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => t.classList.add('hidden'), 3600);
}

// ==========================================
// 6. DUAL CONTROLS: PHONE TOUCH + PC KEYBOARD/MOUSE
// ==========================================
const input = { moveX: 0, moveY: 0, yaw: Math.PI, pitch: 0.12, sprint: false, crouch: false };
const keys = {};
let velocityY = 0;
let isGrounded = true;

// PC Keyboard Listeners
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
  if (e.code === 'KeyC') toggleCrouch();
  if (e.code === 'KeyE') handleInteract();
  if (e.code === 'Space' && isGrounded && !state.isHiddenInLocker) {
    velocityY = 6.5;
    isGrounded = false;
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
});

// Phone Virtual Joystick
const joyZone = document.getElementById('joystick-zone');
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
let joyTouchId = null;

joyZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  joyTouchId = e.changedTouches[0].identifier;
  updateJoystick(e.changedTouches[0]);
}, { passive: false });

joyZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let t of e.changedTouches) if (t.identifier === joyTouchId) updateJoystick(t);
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
  const maxR = 36;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.moveX = dx / maxR;
  input.moveY = dy / maxR;
}

// Camera Look (Phone Touch + PC Mouse Drag)
const lookZone = document.getElementById('look-zone');
let lookTouchId = null;
let lastLookX = 0, lastLookY = 0;
let isMouseDragging = false;

lookZone.addEventListener('touchstart', (e) => {
  lookTouchId = e.changedTouches[0].identifier;
  lastLookX = e.changedTouches[0].clientX;
  lastLookY = e.changedTouches[0].clientY;
});
lookZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let t of e.changedTouches) {
    if (t.identifier === lookTouchId) {
      input.yaw -= (t.clientX - lastLookX) * 0.0065;
      input.pitch = Math.max(-0.4, Math.min(0.6, input.pitch + (t.clientY - lastLookY) * 0.005));
      lastLookX = t.clientX; lastLookY = t.clientY;
    }
  }
}, { passive: false });
lookZone.addEventListener('touchend', () => { lookTouchId = null; });

lookZone.addEventListener('mousedown', (e) => { isMouseDragging = true; lastLookX = e.clientX; lastLookY = e.clientY; });
window.addEventListener('mousemove', (e) => {
  if (!isMouseDragging) return;
  input.yaw -= (e.clientX - lastLookX) * 0.005;
  input.pitch = Math.max(-0.4, Math.min(0.6, input.pitch + (e.clientY - lastLookY) * 0.004));
  lastLookX = e.clientX; lastLookY = e.clientY;
});
window.addEventListener('mouseup', () => { isMouseDragging = false; });

// HUD Action Buttons (Touch + Mouse Click)
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

document.getElementById('btn-jump').addEventListener('click', () => {
  if (isGrounded && !state.isHiddenInLocker) { velocityY = 6.5; isGrounded = false; }
});

document.getElementById('btn-interact').addEventListener('click', handleInteract);

function toggleCamera() {
  state.isFirstPerson = !state.isFirstPerson;
  document.getElementById('btn-cam').textContent = state.isFirstPerson ? '1st Person' : '3rd Person';
  localPlayer.userData.head.visible = !state.isFirstPerson;
  localPlayer.userData.hairTop.visible = !state.isFirstPerson;
}

// ==========================================
// 7. THE NUN ESCAPE TASKS & LOCKER HIDING
// ==========================================
function handleInteract() {
  if (state.isCaught) return;

  // 1. Toggle Hiding in Nearest Locker
  if (state.isHiddenInLocker) {
    state.isHiddenInLocker = false;
    localPlayer.visible = true;
    showToast('You stepped out of the locker.');
    return;
  }
  for (let l of lockers) {
    if (Math.hypot(localPlayer.position.x - l.x, localPlayer.position.z - l.z) < 2.2) {
      state.isHiddenInLocker = true;
      localPlayer.visible = false;
      showToast('Hidden inside Locker! The Nun cannot see you.');
      return;
    }
  }

  // 2. Pick up Crowbar, Bolt Cutters, or Key
  for (let [k, item] of Object.entries(tools)) {
    if (!item.taken && localPlayer.position.distanceTo(item.pos) < 2.5) {
      item.taken = true;
      item.mesh.visible = false;
      state.heldItem = k;
      document.getElementById('item-pill').textContent = 'Hand: ' + item.name;
      showToast('Picked up ' + item.name + '!');
      return;
    }
  }

  // 3. Use Crowbar on Wooden Crate
  if (!state.crateOpened && localPlayer.position.distanceTo(crateMesh.position) < 2.8) {
    if (state.heldItem === 'crowbar') {
      state.crateOpened = true;
      tools.key.taken = false;
      tools.key.mesh.visible = true;
      state.heldItem = null;
      document.getElementById('item-pill').textContent = 'Hand: Empty';
      updateWorldProgress();
      syncProgress();
      showToast('Crate pried open! Grab the Main Gate Key inside!');
    } else {
      showToast('Boarded crate! You need the Rusty Crowbar.');
    }
    return;
  }

  // 4. Use Bolt Cutters or Main Key on Front Exit Gate
  if (localPlayer.position.distanceTo(exitDoorMesh.position) < 3.4) {
    if (state.heldItem === 'cutters' && !state.chainCut) {
      state.chainCut = true;
      state.heldItem = null;
      document.getElementById('item-pill').textContent = 'Hand: Empty';
      updateWorldProgress();
      syncProgress();
      showToast('Chains cut! Now use the Main Gate Key!');
    } else if (state.heldItem === 'key' && !state.keyUnlocked) {
      state.keyUnlocked = true;
      state.heldItem = null;
      document.getElementById('item-pill').textContent = 'Hand: Empty';
      updateWorldProgress();
      syncProgress();
      showToast('Key lock opened!');
    } else {
      showToast('Exit Gate needs: Bolt Cutters + Main Gate Key!');
    }
  }
}

function updateWorldProgress() {
  if (state.crateOpened) crateMesh.visible = false;
  const taskPill = document.getElementById('task-pill');
  if (state.chainCut && state.keyUnlocked) {
    exitDoorMesh.visible = false;
    colliders.length = 0; // Gate open
    exitBeacon.color.setHex(0x22c55e);
    taskPill.textContent = 'GATE OPEN! RUN OUTSIDE!';
  } else {
    taskPill.textContent = `Gate: Chains ${state.chainCut ? '✔' : '✖'} | Key ${state.keyUnlocked ? '✔' : '✖'}`;
  }
}

function syncProgress() {
  if (state.isConnected && conn) {
    conn.send({
      type: 'progress',
      crateOpened: state.crateOpened,
      chainCut: state.chainCut,
      keyUnlocked: state.keyUnlocked
    });
  }
}

function respawnPlayer() {
  state.isCaught = false;
  state.isHiddenInLocker = true;
  localPlayer.visible = false;
  localPlayer.position.set(-15, 0, -7.2);
  document.getElementById('caught-screen').classList.add('hidden');
  showToast('You woke up inside a school locker! Press USE/HIDE to exit.');
}

function checkCollision(nx, nz) {
  for (let box of colliders) {
    if (nx > box.minX && nx < box.maxX && nz > box.minZ && nz < box.maxZ) return true;
  }
  return Math.abs(nx) > 25 || Math.abs(nz) > 27;
}

function animateLimbs(charMesh, speed, time) {
  const { leftLeg, rightLeg, leftArm, rightArm } = charMesh.userData;
  if (speed > 0.05) {
    const swing = Math.sin(time * 1.7) * 0.55;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.7;
    rightArm.rotation.x = swing * 0.7;
  } else {
    leftLeg.rotation.x = rightLeg.rotation.x = leftArm.rotation.x = rightArm.rotation.x = 0;
  }
}

// ==========================================
// 8. MAIN GAME LOOP & THE NUN AI HUNTER
// ==========================================
let lastTime = performance.now();
let netTick = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Rotate tool highlights
  Object.values(tools).forEach(t => { if (!t.taken && t.mesh) t.mesh.rotation.y += dt * 2; });

  if (state.gameStarted && !state.isCaught) {
    // Combine Phone Joystick + PC WASD/Arrows
    let mx = input.moveX;
    let my = input.moveY;
    if (keys['KeyW'] || keys['ArrowUp']) my = -1;
    if (keys['KeyS'] || keys['ArrowDown']) my = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) mx = 1;

    const moveMag = Math.hypot(mx, my);
    const baseSpeed = input.crouch ? 2.1 : (input.sprint ? 6.6 : 3.9);
    const speed = state.isHiddenInLocker ? 0 : baseSpeed * Math.min(moveMag, 1);

    if (moveMag > 0.08 && !state.isHiddenInLocker) {
      const forwardX = -Math.sin(input.yaw);
      const forwardZ = -Math.cos(input.yaw);
      const rightX = Math.cos(input.yaw);
      const rightZ = -Math.sin(input.yaw);

      const dirX = forwardX * (-my) + rightX * mx;
      const dirZ = forwardZ * (-my) + rightZ * mx;
      const norm = Math.hypot(dirX, dirZ) || 1;

      const vx = (dirX / norm) * speed * dt;
      const vz = (dirZ / norm) * speed * dt;

      if (!checkCollision(localPlayer.position.x + vx, localPlayer.position.z)) localPlayer.position.x += vx;
      if (!checkCollision(localPlayer.position.x, localPlayer.position.z + vz)) localPlayer.position.z += vz;
      localPlayer.rotation.y = Math.atan2(dirX, dirZ);
    }

    // Gravity
    velocityY -= 16 * dt;
    localPlayer.position.y += velocityY * dt;
    if (localPlayer.position.y <= 0) {
      localPlayer.position.y = 0;
      velocityY = 0;
      isGrounded = true;
    }

    animateLimbs(localPlayer, speed, now * 0.008);

    // THE NUN AI PATROL & CHASE (Host controls AI)
    if (state.isHost) {
      const distToPlayer = theNun.position.distanceTo(localPlayer.position);
      const hearsNoise = input.sprint && speed > 4.5 && distToPlayer < 16;
      const seesPlayer = !state.isHiddenInLocker && distToPlayer < (input.crouch ? 7.5 : 12.5);

      if (seesPlayer || hearsNoise) {
        nunChasing = true;
        nunTarget.copy(localPlayer.position);
      } else if (theNun.position.distanceTo(nunTarget) < 1.5) {
        nunChasing = false;
        const waypoints = [
          new THREE.Vector3(-16, 0, -16),
          new THREE.Vector3(16, 0, -16),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-16, 0, 15),
          new THREE.Vector3(16, 0, 15)
        ];
        nunTarget.copy(waypoints[Math.floor(Math.random() * waypoints.length)]);
      }

      const nunSpeed = nunChasing ? 4.35 : 2.3;
      const toTarget = new THREE.Vector3().subVectors(nunTarget, theNun.position);
      toTarget.y = 0;
      if (toTarget.length() > 0.2) {
        toTarget.normalize();
        theNun.position.addScaledVector(toTarget, nunSpeed * dt);
        theNun.rotation.y = Math.atan2(toTarget.x, toTarget.z);
      }
    }

    // Danger Vignette & Catch Check
    const nunDist = theNun.position.distanceTo(localPlayer.position);
    document.getElementById('danger-vignette').classList.toggle('hidden', nunDist > 11 || state.isHiddenInLocker);

    if (!state.isHiddenInLocker && nunDist < 1.35) {
      state.isCaught = true;
      document.getElementById('caught-screen').classList.remove('hidden');
    }

    // Check Escape Win
    if (state.chainCut && state.keyUnlocked && localPlayer.position.z > 25.5) {
      state.gameStarted = false;
      document.getElementById('win-screen').classList.remove('hidden');
    }

    // Network Sync
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
  }

  // Camera View
  if (state.isFirstPerson) {
    camera.position.set(localPlayer.position.x, localPlayer.position.y + (input.crouch ? 1.15 : 1.8), localPlayer.position.z);
    const lookX = camera.position.x - Math.sin(input.yaw) * Math.cos(input.pitch);
    const lookY = camera.position.y - Math.sin(input.pitch);
    const lookZ = camera.position.z - Math.cos(input.yaw) * Math.cos(input.pitch);
    camera.lookAt(lookX, lookY, lookZ);
    localPlayer.rotation.y = input.yaw + Math.PI;
  } else {
    const camDist = 4.2;
    const camHeight = 2.3 + input.pitch * 2.0;
    const camX = localPlayer.position.x + Math.sin(input.yaw) * camDist;
    const camZ = localPlayer.position.z + Math.cos(input.yaw) * camDist;
    camera.position.lerp(new THREE.Vector3(camX, localPlayer.position.y + camHeight, camZ), 0.22);
    camera.lookAt(localPlayer.position.x, localPlayer.position.y + 1.4, localPlayer.position.z);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(performance.now());
