import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';

const stage = document.querySelector('#stage');
const loading = document.querySelector('#loading');
const loadingDetail = document.querySelector('#loading-detail');
const errorPanel = document.querySelector('#error-panel');
const errorMessage = document.querySelector('#error-message');

let renderer, scene, camera, clock, mixer, model;
let autoSpin = true;

// 轻量轨道控制（拖拽/缩放），零外部依赖
const orbit = { yaw: 0.5, pitch: 0.1, dist: 3.2, targetY: 0.95, minDist: 1.6, maxDist: 6, minPitch: -0.3, maxPitch: 0.75 };

boot().catch(showError);

async function boot() {
  initScene();
  addStudio();
  bindControls();

  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.load(
    './assets/hero.glb',
    res,
    (e) => { if (e.total) loadingDetail.textContent = `模型与贴图 ${Math.round(e.loaded / e.total * 100)}%`; },
    rej,
  ));

  model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });

  // 落地 + 居中（用 T 帧的包围盒把脚放到地面）
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  scene.add(model);

  const size = box.getSize(new THREE.Vector3());
  orbit.targetY = size.y * 0.52;
  orbit.dist = size.y * 1.7;
  orbit.minDist = size.y * 0.9;
  orbit.maxDist = size.y * 3.2;

  // 动画：待机→战斗待机，用 ping-pong 让过渡循环更顺
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(gltf.animations[0]);
    action.setLoop(THREE.LoopPingPong, Infinity);
    action.clampWhenFinished = false;
    action.timeScale = 0.55; // 放慢，更像从容的待机
    action.play();
  }

  requestAnimationFrame(() => loading.classList.add('ready'));
  animate();
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.06);
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x05070d, 1);
  stage.append(renderer.domElement);

  clock = new THREE.Clock();
  addEventListener('resize', onResize, { passive: true });
}

function addStudio() {
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x141019, 1.5));

  const key = new THREE.DirectionalLight(0xfff2e0, 3.2);
  key.position.set(3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x35e0ff, 2.4);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
  const fill = new THREE.PointLight(0xff5f8a, 4, 10, 2);
  fill.position.set(3, 1.5, -3);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3.2, 0.2, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.5, metalness: 0.5 }),
  );
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);

  for (const [r, color, op] of [[1.5, 0x35e0ff, 0.9], [1.85, 0xff5f8a, 0.4], [2.4, 0xffb347, 0.18]]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.02, 8, 100),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
  }

  const geo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2, rr = 1.2 + Math.random() * 2.5;
    pts.push(Math.cos(a) * rr, Math.random() * 3.2, Math.sin(a) * rr);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const particles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9aefff, size: 0.02, transparent: true, opacity: 0.5, depthWrite: false }));
  particles.name = 'particles';
  scene.add(particles);
}

function bindControls() {
  const el = renderer.domElement;
  let dragging = false, lx = 0, ly = 0;
  el.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture?.(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    orbit.yaw -= (e.clientX - lx) * 0.008;
    orbit.pitch = Math.max(orbit.minPitch, Math.min(orbit.maxPitch, orbit.pitch + (e.clientY - ly) * 0.006));
    lx = e.clientX; ly = e.clientY;
  });
  const stop = () => { dragging = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist + e.deltaY * 0.003)); }, { passive: false });

  let pinch = 0;
  el.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist - (d - pinch) * 0.005));
    pinch = d;
  }, { passive: true });
  el.addEventListener('touchend', () => { pinch = 0; });

  document.querySelector('#spin')?.addEventListener('click', (e) => { autoSpin = !autoSpin; e.currentTarget.classList.toggle('active', autoSpin); });
}

function updateCamera() {
  if (autoSpin) orbit.yaw += 0.0025;
  const cy = Math.cos(orbit.pitch);
  camera.position.set(Math.sin(orbit.yaw) * cy * orbit.dist, orbit.targetY + Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * cy * orbit.dist);
  camera.lookAt(0, orbit.targetY, 0);
}

function animate() {
  requestAnimationFrame(animate);
  const d = Math.min(clock.getDelta(), 0.05);
  mixer?.update(d);
  updateCamera();
  const p = scene.getObjectByName('particles');
  if (p) p.rotation.y += 0.0005;
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
}

function showError(err) {
  console.error(err);
  loading.classList.add('ready');
  errorPanel.hidden = false;
  errorMessage.textContent = `${err?.message || err}。请刷新重试。`;
}
