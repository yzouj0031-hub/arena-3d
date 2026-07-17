import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const stage = document.querySelector('#stage');
const loading = document.querySelector('#loading');
const loadingTitle = document.querySelector('#loading-title');
const loadingDetail = document.querySelector('#loading-detail');
const errorPanel = document.querySelector('#error-panel');
const errorMessage = document.querySelector('#error-message');
const actionButtons = [...document.querySelectorAll('.action')];

let renderer;
let scene;
let camera;
let controls;
let clock;
let hero;
let mixer;
let activeAction;
let activeName = '';
let actions = new Map();

const idleName = 'Sword_Idle';
const loopingActions = new Set(['Sword_Idle', 'Idle_Loop']);

boot().catch(showError);

async function boot() {
  initScene();
  addStudio();
  bindUI();

  loadingTitle.textContent = '正在读取完整蒙皮模型...';
  const heroGLTF = await loadGLTF('./assets/ranger.glb', (ratio) => {
    loadingDetail.textContent = `模型与贴图 ${Math.round(ratio * 100)}%`;
  });

  loadingTitle.textContent = '正在连接 65 根骨骼...';
  const [baseAnimations, combatAnimations] = await Promise.all([
    loadGLTF('./assets/animations-base.glb'),
    loadGLTF('./assets/animations-combat.glb'),
  ]);

  hero = heroGLTF.scene;
  prepareHero(hero);
  scene.add(hero);
  frameHero();

  const clips = [...baseAnimations.animations, ...combatAnimations.animations];
  validateRig(hero, clips);
  setupAnimations(clips);
  attachSword(hero);

  playAction(idleName, { immediate: true });
  loadingTitle.textContent = '英雄装配完成';
  loadingDetail.textContent = '完整蒙皮 · 正常比例 · 原生动作';
  requestAnimationFrame(() => loading.classList.add('ready'));
  animate();
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070910, 0.045);

  camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.02, 80);
  camera.position.set(0, 1.05, 3.25);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.append(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 2.2;
  controls.maxDistance = 5.4;
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.59;
  controls.target.set(0, 0.98, 0);

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize, { passive: true });
}

function addStudio() {
  const hemi = new THREE.HemisphereLight(0xbddcff, 0x171016, 2.0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1dc, 4.2);
  key.position.set(3.4, 4.8, 4.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 12;
  scene.add(key);

  const cyan = new THREE.PointLight(0x30dcff, 12, 6, 2);
  cyan.position.set(-2.2, 1.4, 0.7);
  scene.add(cyan);

  const red = new THREE.PointLight(0xff204f, 16, 6, 2);
  red.position.set(2.1, 1.0, -0.7);
  scene.add(red);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 72),
    new THREE.MeshStandardMaterial({ color: 0x080b12, roughness: 0.6, metalness: 0.48 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  for (const [radius, color, opacity] of [
    [1.0, 0xff315d, 0.78],
    [1.18, 0x43e9ff, 0.33],
    [1.52, 0xf1c37b, 0.13],
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.015;
    scene.add(ring);
  }

  const particleGeometry = new THREE.BufferGeometry();
  const points = [];
  for (let i = 0; i < 120; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.1 + Math.random() * 2.6;
    points.push(Math.cos(angle) * radius, Math.random() * 2.7, Math.sin(angle) * radius);
  }
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0x9aefff, size: 0.014, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  particles.name = 'studio-particles';
  scene.add(particles);
}

function loadGLTF(url, onRatio) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (event) => {
        if (onRatio && event.total > 0) onRatio(event.loaded / event.total);
      },
      reject,
    );
  });
}

function prepareHero(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      material.envMapIntensity = 1.1;
      if (material.name === 'MI_Ranger') {
        material.roughness = Math.min(material.roughness ?? 1, 0.72);
        material.metalness = Math.max(material.metalness ?? 0, 0.08);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

function frameHero() {
  const box = new THREE.Box3().setFromObject(hero);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const portrait = innerHeight > innerWidth;
  const distance = portrait ? size.y * 2.05 : size.y * 1.72;
  camera.position.set(0, center.y + size.y * 0.02, distance);
  controls.target.set(0, center.y * 0.96, 0);
  controls.minDistance = size.y * 1.25;
  controls.maxDistance = size.y * 3.1;
  controls.update();
}

function validateRig(model, clips) {
  const requiredBones = ['root', 'pelvis', 'spine_03', 'Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r'];
  const missingBones = requiredBones.filter((name) => !model.getObjectByName(name));
  if (missingBones.length) throw new Error(`模型骨架不完整：${missingBones.join('、')}`);
  if (!clips.some((clip) => clip.name === idleName)) throw new Error('没有找到战斗待机动作。');

  const trackTargets = new Set(
    clips.flatMap((clip) => clip.tracks.map((track) => track.name.split('.')[0])),
  );
  const unmatched = [...trackTargets].filter((name) => !model.getObjectByName(name));
  if (unmatched.length > 2) throw new Error(`动作与模型骨架不匹配：${unmatched.slice(0, 4).join('、')}`);
}

function setupAnimations(clips) {
  mixer = new THREE.AnimationMixer(hero);
  actions = new Map();

  for (const sourceClip of clips) {
    const clip = sourceClip.clone();
    const action = mixer.clipAction(clip, hero);
    action.enabled = true;
    actions.set(clip.name, action);
  }

  mixer.addEventListener('finished', (event) => {
    if (event.action !== activeAction || activeName === idleName) return;
    playAction(idleName);
  });
}

function attachSword(model) {
  const hand = model.getObjectByName('hand_r');
  if (!hand) return;

  const weapon = new THREE.Group();
  weapon.name = 'runtime-sword';

  const metal = new THREE.MeshStandardMaterial({
    color: 0xdce9f2,
    metalness: 0.92,
    roughness: 0.22,
    emissive: 0x2b0a12,
    emissiveIntensity: 0.45,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111821, metalness: 0.72, roughness: 0.34 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89142, metalness: 0.88, roughness: 0.23 });

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.044, 0);
  bladeShape.lineTo(-0.052, 0.54);
  bladeShape.lineTo(0, 0.72);
  bladeShape.lineTo(0.052, 0.54);
  bladeShape.lineTo(0.044, 0);
  bladeShape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1 }), metal);
  blade.position.set(0, 0.13, -0.009);
  weapon.add(blade);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.025, 0.046), gold);
  guard.position.y = 0.13;
  weapon.add(guard);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.029, 0.17, 12), dark);
  grip.position.y = 0.045;
  weapon.add(grip);

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), gold);
  pommel.position.y = -0.05;
  weapon.add(pommel);

  weapon.position.set(0, 0.035, 0.012);
  weapon.rotation.set(0, 0, 0);
  weapon.traverse((part) => { if (part.isMesh) part.castShadow = true; });
  hand.add(weapon);
}

function playAction(name, { immediate = false } = {}) {
  const next = actions.get(name);
  if (!next) return;

  const previous = activeAction;
  activeAction = next;
  activeName = name;

  next.reset();
  next.enabled = true;
  next.clampWhenFinished = !loopingActions.has(name);

  if (loopingActions.has(name)) {
    next.setLoop(THREE.LoopRepeat, Infinity);
  } else if (name === 'Jog_Fwd_Loop') {
    next.setLoop(THREE.LoopRepeat, 3);
  } else {
    next.setLoop(THREE.LoopOnce, 1);
  }

  if (previous && previous !== next && !immediate) {
    previous.fadeOut(0.18);
    next.fadeIn(0.18);
  }
  next.play();

  actionButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.action === name);
  });
}

function bindUI() {
  actionButtons.forEach((button) => {
    button.addEventListener('click', () => playAction(button.dataset.action));
  });
  document.querySelector('#retry').addEventListener('click', () => location.reload());
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  mixer?.update(delta);
  controls.update();

  const particles = scene.getObjectByName('studio-particles');
  if (particles) particles.rotation.y += delta * 0.045;

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  if (hero) frameHero();
}

function showError(error) {
  console.error(error);
  loading.classList.add('ready');
  errorPanel.hidden = false;
  errorMessage.textContent = `${error?.message || error}。请刷新重试；如果仍失败，换系统浏览器打开。`;
}
