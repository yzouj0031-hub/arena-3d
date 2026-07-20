import * as THREE from 'three';
import { buildCharacter } from './character.js';

const stage = document.querySelector('#stage');
const loading = document.querySelector('#loading');

let renderer, scene, camera, clock, character;
let autoSpin = true;

// —— 轻量轨道控制（拖拽旋转 + 滚轮/双指缩放），零外部依赖 ——
const orbit = {
  yaw: 0.5,
  pitch: 0.12,
  dist: 11,
  targetY: 3.4,
  minDist: 6.5,
  maxDist: 20,
  minPitch: -0.35,
  maxPitch: 0.85,
};

function boot() {
  initScene();
  addStudio();

  const built = buildCharacter();
  character = built;
  scene.add(built.root);

  bindControls();
  requestAnimationFrame(() => loading.classList.add('ready'));
  animate();
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.028);

  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x05070d, 1);
  stage.append(renderer.domElement);

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize, { passive: true });
}

function addStudio() {
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x140f1a, 1.6));

  const key = new THREE.DirectionalLight(0xfff1dc, 3.4);
  key.position.set(5, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -2;
  key.shadow.bias = -0.0004;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x35e0ff, 2.6);
  rim.position.set(-6, 5, -5);
  scene.add(rim);

  const fill = new THREE.PointLight(0xff5f8a, 8, 18, 2);
  fill.position.set(4, 3, -4);
  scene.add(fill);

  // 地面圆台
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.4, 0.4, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.55, metalness: 0.5 }),
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 地台发光环
  for (const [r, color, op] of [
    [3.0, 0x35e0ff, 0.9],
    [3.6, 0xff5f8a, 0.4],
    [4.6, 0xffb347, 0.18],
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.035, 8, 120),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);
  }

  // 网格地板辉光
  const grid = new THREE.GridHelper(24, 24, 0x1c3a52, 0x122334);
  grid.position.y = 0.005;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  // 漂浮粒子
  const geo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 220; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 6;
    pts.push(Math.cos(a) * r, Math.random() * 9, Math.sin(a) * r);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const particles = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x9aefff, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  particles.name = 'particles';
  scene.add(particles);
}

function bindControls() {
  let dragging = false, lastX = 0, lastY = 0;
  const el = renderer.domElement;

  el.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    orbit.yaw -= (e.clientX - lastX) * 0.008;
    orbit.pitch += (e.clientY - lastY) * 0.006;
    orbit.pitch = Math.max(orbit.minPitch, Math.min(orbit.maxPitch, orbit.pitch));
    lastX = e.clientX; lastY = e.clientY;
  });
  const stop = () => { dragging = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist + e.deltaY * 0.012));
  }, { passive: false });

  // 双指缩放
  let pinch = 0;
  el.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const d = Math.hypot(dx, dy);
    if (pinch) {
      orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist - (d - pinch) * 0.02));
    }
    pinch = d;
  }, { passive: true });
  el.addEventListener('touchend', () => { pinch = 0; });

  // 动作按钮：切换视角/自转
  document.querySelector('#spin')?.addEventListener('click', (e) => {
    autoSpin = !autoSpin;
    e.currentTarget.classList.toggle('active', autoSpin);
  });
}

function updateCamera() {
  if (autoSpin) orbit.yaw += 0.0025;
  const cy = Math.cos(orbit.pitch);
  camera.position.set(
    Math.sin(orbit.yaw) * cy * orbit.dist,
    orbit.targetY + Math.sin(orbit.pitch) * orbit.dist,
    Math.cos(orbit.yaw) * cy * orbit.dist,
  );
  camera.lookAt(0, orbit.targetY, 0);
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  character?.update(t);
  updateCamera();

  const particles = scene.getObjectByName('particles');
  if (particles) {
    particles.rotation.y += 0.0006;
    particles.position.y = Math.sin(t * 0.3) * 0.2;
  }

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
}

boot();
