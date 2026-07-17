import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const $ = (selector) => document.querySelector(selector);
const stage = $('#stage');
const loading = $('#loading');
const loadSub = $('#load-sub');
const mobile = matchMedia('(pointer:coarse)').matches;

const renderer = new THREE.WebGLRenderer({
  antialias: !mobile,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.45 : 1.9));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.append(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070d, 14, 28);

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 70);
camera.position.set(0, 3.15, 9.2);

const hemi = new THREE.HemisphereLight(0xc9e7ff, 0x170d16, 1.65);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe6d2, 4.4);
key.position.set(5, 8, 6);
key.castShadow = true;
key.shadow.mapSize.set(mobile ? 1024 : 1536, mobile ? 1024 : 1536);
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -2;
scene.add(key);
const rim = new THREE.DirectionalLight(0x6da8ff, 4.2);
rim.position.set(-5, 5, -5);
scene.add(rim);
const accentLight = new THREE.PointLight(0xff294d, 3.5, 11);
accentLight.position.set(2.6, 2.1, 2.6);
scene.add(accentLight);

const mat = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  metalness: options.metal ?? 0.25,
  roughness: options.rough ?? 0.35,
  emissive: options.glow ? color : 0x000000,
  emissiveIntensity: options.glow ? (options.intensity ?? 2.1) : 0,
  transparent: options.opacity !== undefined,
  opacity: options.opacity ?? 1,
  side: options.side ?? THREE.FrontSide,
  depthWrite: options.depthWrite ?? true
});

function mesh(geometry, material, parent = scene, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(size, material, position, rotation = [0, 0, 0], parent = scene) {
  return mesh(new THREE.BoxGeometry(...size), material, parent, position, rotation);
}

function makePanel(topWidth, bottomWidth, height, depth = 0.035) {
  const a = topWidth / 2;
  const b = bottomWidth / 2;
  const h = height / 2;
  const z = depth;
  const points = [
    -a,h,z, a,h,z, -b,-h,z, b,-h,z,
    -a,h,-z, a,h,-z, -b,-h,-z, b,-h,-z
  ];
  const indices = [
    0,2,1, 1,2,3, 4,5,6, 5,7,6,
    0,1,4, 1,5,4, 2,6,3, 3,6,7,
    0,4,2, 2,4,6, 1,3,5, 3,7,5
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function tube(points, radius, material, parent, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material, parent);
}

// 3D 英雄研究室：结构、光带、展示台都是真正的场景几何体。
const wall = mat(0x111a28, { metal: 0.65, rough: 0.28 });
const dark = mat(0x070b12, { metal: 0.72, rough: 0.25 });
const steel = mat(0x252f3c, { metal: 0.82, rough: 0.22 });
const cyanGlow = mat(0x7bd9ff, { glow: true, intensity: 2.7, rough: 0.18 });
const redGlow = mat(0xff3859, { glow: true, intensity: 2.8, rough: 0.18 });

box([16, 8, 0.45], wall, [0, 3.2, -4.5]);
for (let x = -6.5; x <= 6.5; x += 2.6) box([0.07, 7.2, 0.12], dark, [x, 3.15, -4.22]);
for (let y = 0.6; y < 6.7; y += 1.45) box([14.6, 0.055, 0.12], dark, [0, y, -4.21]);
box([4.5, 1.1, 0.11], cyanGlow, [-3.6, 4.4, -4.0]);
box([4.5, 1.1, 0.11], redGlow, [3.6, 4.4, -4.0]);
box([17, 0.35, 15], mat(0x111822, { metal: 0.72, rough: 0.27 }), [0, -0.24, 1.5]);

const platform = mesh(
  new THREE.CylinderGeometry(3.2, 3.55, 0.42, 12),
  steel,
  scene,
  [0, -0.03, 0]
);
const platformInset = mesh(
  new THREE.CylinderGeometry(2.78, 2.95, 0.18, 72),
  dark,
  scene,
  [0, 0.23, 0]
);
const platformRing = mesh(
  new THREE.TorusGeometry(2.63, 0.045, 8, 100),
  redGlow,
  scene,
  [0, 0.33, 0],
  [Math.PI / 2, 0, 0]
);
const runeRing = mesh(
  new THREE.TorusGeometry(1.58, 0.018, 6, 90),
  mat(0xefc987, { glow: true, intensity: 2.4 }),
  scene,
  [0, 0.35, 0],
  [Math.PI / 2, 0, 0]
);

for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2;
  const marker = box(
    [0.08, 0.025, i % 3 === 0 ? 0.38 : 0.2],
    i % 3 === 0 ? mat(0xff3859, { glow: true }) : mat(0xefc987, { glow: true, intensity: 1.8 }),
    [Math.cos(angle) * 2.15, 0.37, Math.sin(angle) * 2.15],
    [0, -angle, 0]
  );
  marker.castShadow = false;
}

// 少量空间尘埃，增强层次，不影响移动端性能。
const particlePositions = [];
for (let i = 0; i < (mobile ? 90 : 160); i++) {
  particlePositions.push((Math.random() - 0.5) * 13, Math.random() * 6.5, (Math.random() - 0.5) * 8 - 1);
}
const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
const particles = new THREE.Points(
  particlesGeometry,
  new THREE.PointsMaterial({ color: 0xe7c98d, size: 0.018, transparent: true, opacity: 0.45, depthWrite: false })
);
scene.add(particles);

const hero = new THREE.Group();
hero.scale.setScalar(2.82);
hero.position.y = 0.37;
scene.add(hero);

let bodyScene;
let hairScene;
let rigs = [];
let bones = new Map();
let hairBones = new Map();
let armor;
let leftBlade;
let rightBlade;
let energyArc;
let action = 'idle';
let actionStarted = performance.now();
let heroYaw = 0.18;
let targetYaw = 0.18;
let cameraLift = 0;
let targetLift = 0;
let cameraDistance = 9.2;
let targetDistance = 9.2;
let dragging = false;
let lastX = 0;
let lastY = 0;
let pinchDistance = 0;

function captureRig(root) {
  const map = new Map();
  root.traverse((object) => {
    if (!object.isBone) return;
    object.userData.restQuaternion = object.quaternion.clone();
    object.userData.restPosition = object.position.clone();
    map.set(object.name, object);
  });
  return map;
}

function resetRig(map) {
  map.forEach((bone) => {
    bone.quaternion.copy(bone.userData.restQuaternion);
    bone.position.copy(bone.userData.restPosition);
  });
}

const poseQuaternion = new THREE.Quaternion();
const poseEuler = new THREE.Euler();
function rotateBone(map, name, x = 0, y = 0, z = 0) {
  const bone = map.get(name);
  if (!bone) return;
  poseQuaternion.setFromEuler(poseEuler.set(x, y, z, 'XYZ'));
  bone.quaternion.multiply(poseQuaternion);
}

function moveBone(map, name, x = 0, y = 0, z = 0) {
  const bone = map.get(name);
  if (!bone) return;
  bone.position.add(new THREE.Vector3(x, y, z));
}

function forRigs(callback) {
  rigs.forEach(callback);
}

function createCrescentBlade(flip = 1) {
  const group = new THREE.Group();
  const blackMetal = mat(0x11151c, { metal: 0.92, rough: 0.18 });
  const redMetal = mat(0x6b1021, { metal: 0.68, rough: 0.26 });
  const gold = mat(0xd7aa56, { metal: 0.95, rough: 0.16 });
  const glow = mat(0xff294d, { glow: true, intensity: 3.2 });

  mesh(new THREE.TorusGeometry(0.285, 0.055, 10, 48, Math.PI * 1.56), blackMetal, group, [0, 0, 0], [0, 0, 0.66 * flip]);
  mesh(new THREE.TorusGeometry(0.205, 0.018, 8, 44, Math.PI * 1.56), glow, group, [0, 0, 0.005], [0, 0, 0.66 * flip]);
  for (let i = 0; i < 5; i++) {
    const a = 0.33 + i * 0.38;
    mesh(
      new THREE.ConeGeometry(0.055, 0.2, 6),
      i % 2 ? gold : redMetal,
      group,
      [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0],
      [0, 0, a - Math.PI / 2]
    );
  }
  mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 10), gold, group, [0, -0.14, 0], [0, 0, 0.76 * flip]);
  return group;
}

function createArmor() {
  armor = new THREE.Group();
  hero.add(armor);
  const oxblood = mat(0x721226, { metal: 0.28, rough: 0.42 });
  const crimson = mat(0xa61d36, { metal: 0.36, rough: 0.34 });
  const blackMetal = mat(0x10151d, { metal: 0.82, rough: 0.23 });
  const gunmetal = mat(0x27313d, { metal: 0.9, rough: 0.18 });
  const gold = mat(0xd7aa56, { metal: 0.96, rough: 0.15 });
  const glow = mat(0xff294d, { glow: true, intensity: 3 });
  const cloth = mat(0x4a0d1c, { rough: 0.66, side: THREE.DoubleSide });

  // 胸甲：窄腰、宽肩的真人英雄轮廓。
  mesh(makePanel(0.48, 0.36, 0.48, 0.045), blackMetal, armor, [0, 1.31, 0.13]);
  mesh(makePanel(0.34, 0.24, 0.38, 0.052), crimson, armor, [0, 1.34, 0.185]);
  mesh(new THREE.OctahedronGeometry(0.075, 0), glow, armor, [0, 1.38, 0.25], [0, 0, Math.PI / 4], [1, 1.35, 0.55]);
  mesh(new THREE.TorusGeometry(0.29, 0.027, 7, 34, Math.PI), gold, armor, [0, 1.13, 0.11], [Math.PI / 2, 0, 0]);

  // 护肩与前臂甲，避免上一版的夸张玩具比例。
  [-1, 1].forEach((side) => {
    mesh(new THREE.BoxGeometry(0.31, 0.14, 0.27), gunmetal, armor, [side * 0.36, 1.48, 0.015], [0, side * 0.08, side * 0.12]);
    mesh(new THREE.ConeGeometry(0.08, 0.25, 5), gold, armor, [side * 0.52, 1.49, 0.01], [0, 0, -side * Math.PI / 2]);
    mesh(new THREE.BoxGeometry(0.12, 0.31, 0.15), blackMetal, armor, [side * 0.48, 1.03, 0.055], [0, 0, side * 0.14]);
    mesh(new THREE.BoxGeometry(0.035, 0.28, 0.018), glow, armor, [side * 0.48, 1.03, 0.145], [0, 0, side * 0.14]);
  });

  // 腰封与分层袍摆。
  mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.12, 16), blackMetal, armor, [0, 1.0, 0.01]);
  for (let i = -2; i <= 2; i++) {
    const side = i / 2;
    mesh(
      makePanel(0.16, 0.26, 0.72, 0.018),
      i === 0 ? crimson : cloth,
      armor,
      [side * 0.23, 0.63, i === 0 ? 0.14 : -0.02 - Math.abs(side) * 0.02],
      [0, -side * 0.13, side * 0.06]
    );
  }
  mesh(makePanel(0.028, 0.055, 0.68, 0.012), gold, armor, [0, 0.64, 0.165]);

  // 背部披风与两条能量飘带。
  mesh(makePanel(0.52, 0.92, 1.18, 0.012), cloth, armor, [0, 0.87, -0.17], [0.08, 0, 0]);
  tube([[-0.18, 1.16, -0.2], [-0.66, 0.86, -0.31], [-0.92, 0.32, -0.08]], 0.018, glow, armor, 24);
  tube([[0.18, 1.16, -0.2], [0.66, 0.86, -0.31], [0.92, 0.32, -0.08]], 0.018, glow, armor, 24);

  leftBlade = createCrescentBlade(-1);
  rightBlade = createCrescentBlade(1);
  leftBlade.position.set(-0.62, 0.9, 0.2);
  rightBlade.position.set(0.62, 0.9, 0.2);
  leftBlade.rotation.set(0.06, -0.18, -0.42);
  rightBlade.rotation.set(-0.06, 0.18, 0.42);
  armor.add(leftBlade, rightBlade);

  energyArc = mesh(new THREE.TorusGeometry(0.67, 0.016, 7, 78, Math.PI * 1.6), glow, armor, [0, 0.18, 0], [Math.PI / 2, 0, 0.55]);
}

function prepareModelMaterials(root, kind) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (Array.isArray(object.material)) object.material = object.material.map((m) => m.clone());
    else object.material = object.material.clone();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.side = THREE.DoubleSide;
      if (kind === 'hair') {
        material.color.set(0xf3f4f7);
        material.roughness = 0.52;
        material.metalness = 0.04;
      } else if (/superhero/i.test(material.name)) {
        material.color.set(0xe7d9d0);
        material.roughness = 0.46;
      }
    });
  });
}

const loader = new GLTFLoader();
function loadGLB(url, progressLabel) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (event) => {
        if (!event.total) return;
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        loadSub.textContent = `${progressLabel} ${percent}%`;
      },
      reject
    );
  });
}

async function buildHero() {
  const [body, hair] = await Promise.all([
    loadGLB('./assets/hero-base.glb', '载入人体与骨骼…'),
    loadGLB('./assets/hair-long.glb', '载入独立长发…')
  ]);
  bodyScene = body.scene;
  hairScene = hair.scene;
  prepareModelMaterials(bodyScene, 'body');
  prepareModelMaterials(hairScene, 'hair');
  hero.add(bodyScene, hairScene);
  bones = captureRig(bodyScene);
  hairBones = captureRig(hairScene);
  rigs = [bones, hairBones];
  createArmor();
  setAction('idle');
  loadSub.textContent = '装配完成';
  setTimeout(() => loading.classList.add('hide'), 260);
}

const actionButtons = [
  ['待机', 'idle', '◇'],
  ['奔跑', 'run', '➤'],
  ['普攻', 'attack', '⚔'],
  ['施法', 'spell', '✦'],
  ['受击', 'hit', '◆']
];
actionButtons.forEach(([label, value, icon]) => {
  const button = document.createElement('button');
  button.dataset.action = value;
  button.innerHTML = `<span>${icon}</span>${label}`;
  button.addEventListener('click', () => setAction(value));
  $('#actions').append(button);
});

function setAction(next) {
  action = next;
  actionStarted = performance.now();
  document.querySelectorAll('#actions button').forEach((button) => button.classList.toggle('active', button.dataset.action === next));
}

function smoothPulse(value) {
  return Math.sin(Math.min(1, Math.max(0, value)) * Math.PI);
}

function poseHero(time) {
  if (!rigs.length) return;
  const elapsed = (time - actionStarted) / 1000;
  if (action !== 'idle') {
    const duration = action === 'run' ? 3.5 : action === 'spell' ? 1.65 : 1.15;
    if (elapsed > duration) setAction('idle');
  }

  forRigs(resetRig);
  hero.position.y = 0.37;
  hero.rotation.x = 0;
  hero.position.z = 0;

  const breathing = Math.sin(time * 0.0018);
  forRigs((rig) => {
    // 把初始 A-Pose 收成适合展示的自然站姿。
    rotateBone(rig, 'upperarm_l', 0.02, -0.05, 0.46);
    rotateBone(rig, 'upperarm_r', 0.02, 0.05, -0.46);
    rotateBone(rig, 'lowerarm_l', -0.12, 0.03, -0.06);
    rotateBone(rig, 'lowerarm_r', -0.12, -0.03, 0.06);
    rotateBone(rig, 'spine_03', breathing * 0.012, breathing * 0.012, breathing * 0.008);
    rotateBone(rig, 'Head', -breathing * 0.012, breathing * 0.018, 0);
  });

  let weaponEnergy = 0.35;
  if (action === 'run') {
    const cycle = elapsed * 7.6;
    const swing = Math.sin(cycle);
    const bounce = Math.abs(Math.sin(cycle));
    hero.position.y += bounce * 0.035;
    forRigs((rig) => {
      rotateBone(rig, 'thigh_l', swing * 0.68, 0, 0);
      rotateBone(rig, 'thigh_r', -swing * 0.68, 0, 0);
      rotateBone(rig, 'calf_l', Math.max(0, -swing) * 0.52, 0, 0);
      rotateBone(rig, 'calf_r', Math.max(0, swing) * 0.52, 0, 0);
      rotateBone(rig, 'upperarm_l', -swing * 0.42, 0, 0.1);
      rotateBone(rig, 'upperarm_r', swing * 0.42, 0, -0.1);
      rotateBone(rig, 'spine_02', 0.08, 0, 0);
    });
    weaponEnergy = 0.65;
  } else if (action === 'attack') {
    const p = Math.min(1, elapsed / 1.05);
    const slash = smoothPulse(p);
    const wind = Math.sin(p * Math.PI * 0.5);
    hero.rotation.x = -slash * 0.05;
    forRigs((rig) => {
      rotateBone(rig, 'spine_02', -slash * 0.18, -slash * 0.48, slash * 0.08);
      rotateBone(rig, 'upperarm_r', -wind * 1.0, -slash * 0.45, -wind * 0.45);
      rotateBone(rig, 'lowerarm_r', -wind * 0.55, 0, 0);
      rotateBone(rig, 'upperarm_l', -slash * 0.32, slash * 0.28, slash * 0.22);
      rotateBone(rig, 'thigh_r', -slash * 0.22, 0, 0);
    });
    rightBlade.rotation.z = 0.42 - slash * 2.5;
    rightBlade.position.x = 0.62 + slash * 0.3;
    weaponEnergy = 1;
  } else if (action === 'spell') {
    const p = Math.min(1, elapsed / 1.55);
    const cast = smoothPulse(p);
    forRigs((rig) => {
      rotateBone(rig, 'spine_02', -cast * 0.12, 0, 0);
      rotateBone(rig, 'upperarm_l', -cast * 0.58, 0, cast * 0.75);
      rotateBone(rig, 'upperarm_r', -cast * 0.58, 0, -cast * 0.75);
      rotateBone(rig, 'lowerarm_l', -cast * 0.4, 0, 0);
      rotateBone(rig, 'lowerarm_r', -cast * 0.4, 0, 0);
      rotateBone(rig, 'Head', cast * 0.08, 0, 0);
    });
    runeRing.scale.setScalar(1 + cast * 0.22);
    weaponEnergy = 1.25;
  } else if (action === 'hit') {
    const p = Math.min(1, elapsed / 1.05);
    const recoil = smoothPulse(p);
    hero.position.z = -recoil * 0.16;
    hero.rotation.x = recoil * 0.11;
    forRigs((rig) => {
      rotateBone(rig, 'spine_01', recoil * 0.28, 0, recoil * 0.08);
      rotateBone(rig, 'spine_03', recoil * 0.2, -recoil * 0.18, 0);
      rotateBone(rig, 'Head', -recoil * 0.22, recoil * 0.12, 0);
      rotateBone(rig, 'upperarm_l', recoil * 0.22, 0, recoil * 0.3);
      rotateBone(rig, 'upperarm_r', recoil * 0.22, 0, -recoil * 0.3);
    });
    weaponEnergy = 0.8;
  }

  // 非攻击动作时恢复武器展示位。
  if (action !== 'attack') {
    rightBlade.rotation.z += (0.42 - rightBlade.rotation.z) * 0.16;
    rightBlade.position.x += (0.62 - rightBlade.position.x) * 0.16;
  }
  leftBlade.rotation.y = -0.18 + Math.sin(time * 0.0015) * 0.06;
  rightBlade.rotation.y = 0.18 - Math.sin(time * 0.0015) * 0.06;
  leftBlade.rotation.x = 0.06 + Math.sin(time * 0.002) * 0.035;
  rightBlade.rotation.x = -0.06 - Math.sin(time * 0.002) * 0.035;
  energyArc.material.emissiveIntensity = 1.5 + weaponEnergy * 1.7;
  energyArc.rotation.z += 0.008 + weaponEnergy * 0.008;
  platformRing.material.emissiveIntensity = 2.2 + weaponEnergy * 0.7;
  runeRing.rotation.z -= 0.004 + weaponEnergy * 0.002;
  runeRing.scale.lerp(new THREE.Vector3(1, 1, 1), 0.04);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  targetYaw += (event.clientX - lastX) * 0.012;
  targetLift = Math.max(-0.32, Math.min(0.3, targetLift + (event.clientY - lastY) * 0.0035));
  lastX = event.clientX;
  lastY = event.clientY;
});
renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });
renderer.domElement.addEventListener('wheel', (event) => {
  targetDistance = Math.max(7.1, Math.min(11.6, targetDistance + event.deltaY * 0.006));
  event.preventDefault();
}, { passive: false });
renderer.domElement.addEventListener('touchmove', (event) => {
  if (event.touches.length !== 2) return;
  const distance = Math.hypot(
    event.touches[0].clientX - event.touches[1].clientX,
    event.touches[0].clientY - event.touches[1].clientY
  );
  if (pinchDistance) targetDistance = Math.max(7.1, Math.min(11.6, targetDistance + (pinchDistance - distance) * 0.014));
  pinchDistance = distance;
}, { passive: false });
renderer.domElement.addEventListener('touchend', () => { pinchDistance = 0; });

function updateCameraForViewport() {
  const aspect = innerWidth / innerHeight;
  const compactLandscape = innerHeight < 560 && aspect > 1.25;
  const portrait = aspect < 0.8;
  targetDistance = compactLandscape ? 8.35 : portrait ? 10.15 : 9.2;
  camera.fov = compactLandscape ? 37 : portrait ? 35 : 32;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

addEventListener('resize', updateCameraForViewport);
updateCameraForViewport();

const clock = new THREE.Clock();
function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  poseHero(time);
  if (!dragging && rigs.length) targetYaw += dt * 0.035;
  heroYaw += (targetYaw - heroYaw) * 0.09;
  cameraLift += (targetLift - cameraLift) * 0.08;
  cameraDistance += (targetDistance - cameraDistance) * 0.08;
  hero.rotation.y = heroYaw;
  particles.rotation.y += dt * 0.008;
  const portrait = innerWidth / innerHeight < 0.8;
  camera.position.set(0, (portrait ? 3.35 : 3.15) + cameraLift * 2.2, cameraDistance);
  camera.lookAt(0, (portrait ? 2.9 : 2.72) + cameraLift * 1.25, 0);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

buildHero().catch((error) => {
  console.error(error);
  loadSub.textContent = '模型载入失败，请刷新页面重试';
  document.querySelector('.load-mark').textContent = '!';
});
