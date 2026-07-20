import * as THREE from 'three';

// ============================================================
//  程序化人物建模 —— 赛博游侠「夜隼·玄羽」
//  曲面盔甲 + 贴身内衬 + 哑光金属，避免"乐高/方块"观感。
//  返回 { root, rig, update(t) }，root 直接加入场景即可。
// ============================================================

const PAL = {
  suit: 0x23272f,        // 贴身内衬（哑光深灰）
  suitLit: 0x333b48,     // 内衬受光面
  skin: 0xdcab8b,
  armor: 0x3d4c5e,       // 主装甲（拉丝钢，非镜面塑料）
  armorEdge: 0x8399ae,   // 装甲高光边
  armorDark: 0x272f3a,
  trim: 0x38e1ff,        // 队伍能量色
  leather: 0x2c241e,
  hair: 0x14161d,
  metal: 0xaebccb,       // 武器金属
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, ...opts });
}

// 关键：装甲用中等金属度 + 较高粗糙度 = 哑光拉丝金属，而不是反光塑料玩具
const M = {
  suit: mat(PAL.suit, { roughness: 0.92, metalness: 0.08 }),
  suitLit: mat(PAL.suitLit, { roughness: 0.85, metalness: 0.12 }),
  skin: mat(PAL.skin, { roughness: 0.72, metalness: 0.0 }),
  armor: mat(PAL.armor, { roughness: 0.52, metalness: 0.62 }),
  armorEdge: mat(PAL.armorEdge, { roughness: 0.44, metalness: 0.7 }),
  armorDark: mat(PAL.armorDark, { roughness: 0.6, metalness: 0.5 }),
  leather: mat(PAL.leather, { roughness: 0.8, metalness: 0.05 }),
  hair: mat(PAL.hair, { roughness: 0.62, metalness: 0.08 }),
  trim: mat(PAL.trim, { roughness: 0.35, metalness: 0.3, emissive: PAL.trim, emissiveIntensity: 1.25 }),
  visor: mat(0x0a1622, { roughness: 0.12, metalness: 0.5, emissive: PAL.trim, emissiveIntensity: 0.8 }),
  metal: mat(PAL.metal, { roughness: 0.32, metalness: 0.85 }),
};

function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }

// 圆角甲片：用带圆角矩形 + 挤出 + 斜角，得到有厚度的弧形甲片（非方盒）
function roundedPlate(w, h, d, r, material) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d, bevelEnabled: true, bevelThickness: Math.min(0.04, d * 0.4),
    bevelSize: Math.min(0.03, r * 0.8), bevelSegments: 2, steps: 1,
  });
  g.center();
  return shadow(new THREE.Mesh(g, material));
}

// 弧形壳（球面的一块）——做胸甲/护肩/膝盖等贴合曲面
function shell(radius, phiLen, thetaStart, thetaLen, material) {
  const g = new THREE.SphereGeometry(radius, 28, 20, -phiLen / 2, phiLen, thetaStart, thetaLen);
  return shadow(new THREE.Mesh(g, material));
}

// 发光细条
function glowBar(len, thick, material, horizontal = false) {
  const g = new THREE.CapsuleGeometry(thick, len, 4, 8);
  const m = new THREE.Mesh(g, material);
  if (horizontal) m.rotation.z = Math.PI / 2;
  return m;
}

export function buildCharacter() {
  const root = new THREE.Group();
  root.name = 'Hero';
  const rig = {};

  // ---------- 骨盆 ----------
  const hips = new THREE.Group();
  hips.position.y = 3.3;
  root.add(hips);
  rig.hips = hips;

  // 骨盆内衬（连续实体，填满缝隙）
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), M.suit);
  pelvis.scale.set(1.05, 0.82, 0.78);
  shadow(pelvis);
  hips.add(pelvis);

  // 腰带
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.26, 24), M.leather);
  belt.position.y = 0.06;
  shadow(belt);
  hips.add(belt);
  const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), M.trim);
  buckle.position.set(0, 0.06, 0.46);
  buckle.scale.set(1, 1.2, 0.5);
  hips.add(buckle);

  // 前腰甲（弧形垂片）
  const tasset = shell(0.5, Math.PI * 0.9, Math.PI * 0.42, Math.PI * 0.3, M.armor);
  tasset.position.set(0, -0.28, 0.02);
  tasset.rotation.x = 0.05;
  hips.add(tasset);
  const tassetGlow = glowBar(0.34, 0.018, M.trim, true);
  tassetGlow.position.set(0, -0.5, 0.42);
  hips.add(tassetGlow);
  // 侧腰甲
  for (const s of [-1, 1]) {
    const side = roundedPlate(0.26, 0.42, 0.1, 0.08, M.armorDark);
    side.position.set(s * 0.4, -0.24, 0.06);
    side.rotation.z = s * 0.12;
    side.rotation.y = s * -0.5;
    hips.add(side);
  }

  // ---------- 脊柱 / 躯干 ----------
  const spine = new THREE.Group();
  spine.position.y = 0.18;
  hips.add(spine);
  rig.spine = spine;

  // 腹部内衬（收腰的连续体）
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), M.suit);
  abdomen.scale.set(0.98, 1.15, 0.72);
  abdomen.position.y = 0.34;
  shadow(abdomen);
  spine.add(abdomen);

  // 胸腔
  const chest = new THREE.Group();
  chest.position.y = 0.78;
  spine.add(chest);
  rig.chest = chest;

  // 胸腔内衬（宽肩收腰的躯干块）
  const ribcage = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 22), M.suitLit);
  ribcage.scale.set(1.22, 1.05, 0.78);
  ribcage.position.y = 0.02;
  shadow(ribcage);
  chest.add(ribcage);

  // 胸甲（贴合曲面的前甲，两片胸肌造型）
  const cuirass = shell(0.56, Math.PI * 1.15, Math.PI * 0.32, Math.PI * 0.5, M.armor);
  cuirass.scale.set(1.16, 1.1, 0.92);
  cuirass.position.set(0, 0.05, 0.02);
  chest.add(cuirass);
  // 胸甲中缝发光
  const chestSeam = glowBar(0.5, 0.016, M.trim);
  chestSeam.position.set(0, 0.05, 0.54);
  chest.add(chestSeam);
  // 锁骨/肩线高光边
  for (const s of [-1, 1]) {
    const clav = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 24, Math.PI * 0.5), M.armorEdge);
    clav.position.set(s * 0.12, 0.32, 0.28);
    clav.rotation.set(Math.PI * 0.5, 0, s * -0.9);
    chest.add(clav);
  }

  // 胸口能量核心
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 12, 28), M.armorEdge);
  coreRing.position.set(0, 0.08, 0.5);
  chest.add(coreRing);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), M.trim);
  core.position.set(0, 0.08, 0.53);
  chest.add(core);
  rig.core = core;
  const coreLight = new THREE.PointLight(PAL.trim, 2.2, 3.2, 2);
  coreLight.position.set(0, 0.08, 0.75);
  chest.add(coreLight);

  // ---------- 颈 / 头 ----------
  const neck = new THREE.Group();
  neck.position.y = 0.5;
  chest.add(neck);
  rig.neck = neck;

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.3, 16), M.skin);
  neckMesh.position.y = 0.13;
  shadow(neckMesh);
  neck.add(neckMesh);
  // 护颈（半圈立领）
  const gorget = shell(0.28, Math.PI * 1.3, Math.PI * 0.36, Math.PI * 0.34, M.armor);
  gorget.position.y = 0.16;
  gorget.rotation.x = -0.1;
  neck.add(gorget);

  const head = new THREE.Group();
  head.position.y = 0.42;
  neck.add(head);
  rig.head = head;

  // 头颅（拉长的椭球，人形而非圆球）
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 24), M.skin);
  skull.scale.set(0.86, 1.02, 0.96);
  skull.position.y = 0.1;
  shadow(skull);
  head.add(skull);
  // 下颌收窄
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), M.skin);
  jaw.scale.set(0.78, 0.66, 0.86);
  jaw.position.set(0, -0.06, 0.02);
  shadow(jaw);
  head.add(jaw);

  // 头盔（贴合弧形，露出下半脸）
  const helm = shell(0.32, Math.PI * 2, 0, Math.PI * 0.6, M.armor);
  helm.scale.set(0.92, 1.06, 1.0);
  helm.position.y = 0.12;
  head.add(helm);
  // 头盔后包裹
  const helmBack = shell(0.31, Math.PI * 1.1, Math.PI * 0.35, Math.PI * 0.5, M.armorDark);
  helmBack.scale.set(0.94, 1.0, 1.0);
  helmBack.position.set(0, 0.06, -0.03);
  helmBack.rotation.y = Math.PI;
  head.add(helmBack);
  // 中脊
  const crest = roundedPlate(0.05, 0.46, 0.14, 0.02, M.armorEdge);
  crest.position.set(0, 0.2, -0.04);
  crest.rotation.x = -0.15;
  head.add(crest);

  // 护目发光带
  const visorBar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 10, 24, Math.PI * 0.9), M.visor);
  visorBar.position.set(0, 0.06, 0.04);
  visorBar.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.5 + Math.PI * 0.05);
  head.add(visorBar);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.08, 4, 8), M.trim);
    eye.rotation.z = Math.PI / 2 - s * 0.25;
    eye.position.set(s * 0.11, 0.07, 0.27);
    head.add(eye);
  }

  // 束发（贴头顶后梳 + 马尾）
  const hairCap = shell(0.3, Math.PI * 1.2, Math.PI * 0.28, Math.PI * 0.55, M.hair);
  hairCap.scale.set(0.98, 0.92, 1.0);
  hairCap.position.set(0, 0.1, -0.05);
  hairCap.rotation.y = Math.PI;
  head.add(hairCap);
  const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.55, 8, 12), M.hair);
  ponytail.scale.set(1, 1, 0.7);
  ponytail.position.set(0, -0.04, -0.28);
  ponytail.rotation.x = 0.55;
  head.add(ponytail);
  rig.ponytail = ponytail;

  // ---------- 手臂 ----------
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.6, 0.34, 0);
    chest.add(shoulder);

    // 肩关节内衬球（填满肩窝，无缝）
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), M.suit);
    shadow(shoulderBall);
    shoulder.add(shoulderBall);

    // 护肩（层叠弧形甲片，非圆球）
    const layers = [
      { r: 0.34, y: 0.14, x: 0.05, mat: M.armor },
      { r: 0.3, y: 0.02, x: 0.1, mat: M.armorDark },
      { r: 0.25, y: -0.08, x: 0.14, mat: M.armor },
    ];
    for (const L of layers) {
      const p = shell(L.r, Math.PI * 1.1, Math.PI * 0.42, Math.PI * 0.5, L.mat);
      p.scale.set(1.1, 0.7, 1.1);
      p.position.set(side * L.x, L.y, 0);
      p.rotation.z = side * -0.15;
      shoulder.add(p);
    }
    const pauldronGlow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 24, Math.PI), M.trim);
    pauldronGlow.rotation.set(Math.PI / 2, side < 0 ? 0.2 : Math.PI - 0.2, 0);
    pauldronGlow.position.set(side * 0.05, 0.14, 0);
    shoulder.add(pauldronGlow);

    // 上臂
    const upperArm = new THREE.Group();
    upperArm.position.set(side * 0.12, -0.02, 0);
    shoulder.add(upperArm);
    const bicep = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 8, 16), M.suit);
    bicep.position.y = -0.26;
    shadow(bicep);
    upperArm.add(bicep);

    // 前臂（含肘、护腕）
    const forearm = new THREE.Group();
    forearm.position.y = -0.54;
    upperArm.add(forearm);
    // 肘部内衬（无缝衔接）
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), M.suit);
    shadow(elbow);
    forearm.add(elbow);
    const bracer = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.4, 8, 16), M.suit);
    bracer.position.y = -0.27;
    shadow(bracer);
    forearm.add(bracer);
    // 护腕装甲（半包弧形）
    const bracerArmor = shell(0.19, Math.PI * 1.3, Math.PI * 0.34, Math.PI * 0.55, M.armor);
    bracerArmor.scale.set(1, 1.6, 1);
    bracerArmor.position.set(0, -0.3, 0.02);
    bracerArmor.rotation.x = Math.PI;
    forearm.add(bracerArmor);
    const bracerGlow = glowBar(0.16, 0.014, M.trim, true);
    bracerGlow.position.set(0, -0.14, 0.16);
    forearm.add(bracerGlow);

    // 手（塑形拳套）
    const hand = new THREE.Group();
    hand.position.y = -0.52;
    forearm.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), M.armorDark);
    palm.scale.set(0.9, 1.1, 0.7);
    shadow(palm);
    hand.add(palm);
    const knuckle = roundedPlate(0.16, 0.1, 0.08, 0.03, M.armor);
    knuckle.position.set(0, -0.02, 0.06);
    hand.add(knuckle);
    const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), M.suit);
    fingers.position.set(0, -0.16, 0.02);
    hand.add(fingers);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.08, 4, 8), M.suit);
    thumb.position.set(side * 0.08, -0.06, 0.04);
    thumb.rotation.z = side * 0.7;
    hand.add(thumb);

    rig[`arm_${side < 0 ? 'l' : 'r'}`] = { shoulder, upperArm, forearm, hand };
    return hand;
  }

  buildArm(-1);
  const handR = buildArm(1);
  rig.handR = handR;

  // ---------- 腿 ----------
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.24, -0.12, 0);
    hips.add(hip);

    // 大腿（内衬）
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.52, 8, 16), M.suit);
    thigh.position.y = -0.38;
    shadow(thigh);
    hip.add(thigh);
    // 大腿外侧甲片（弧形）
    const thighArmor = shell(0.26, Math.PI * 1.1, Math.PI * 0.38, Math.PI * 0.5, M.armor);
    thighArmor.scale.set(1, 1.8, 1);
    thighArmor.position.set(0, -0.34, 0.04);
    hip.add(thighArmor);

    // 膝
    const knee = new THREE.Group();
    knee.position.y = -0.74;
    hip.add(knee);
    const kneeIn = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), M.suit);
    shadow(kneeIn);
    knee.add(kneeIn);
    const kneeCap = shell(0.2, Math.PI * 1.2, Math.PI * 0.36, Math.PI * 0.5, M.armorEdge);
    kneeCap.position.set(0, 0, 0.04);
    knee.add(kneeCap);

    // 小腿
    const shin = new THREE.Group();
    knee.add(shin);
    const shinIn = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 8, 16), M.suit);
    shinIn.position.y = -0.34;
    shadow(shinIn);
    shin.add(shinIn);
    const shinArmor = shell(0.2, Math.PI * 1.25, Math.PI * 0.36, Math.PI * 0.5, M.armor);
    shinArmor.scale.set(1, 1.9, 1);
    shinArmor.position.set(0, -0.36, 0.03);
    shin.add(shinArmor);
    const shinGlow = glowBar(0.34, 0.014, M.trim);
    shinGlow.position.set(0, -0.34, 0.2);
    shin.add(shinGlow);

    // 靴（塑形，非方盒）
    const boot = new THREE.Group();
    boot.position.y = -0.64;
    shin.add(boot);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.armorDark);
    ankle.scale.set(1, 1, 1.1);
    shadow(ankle);
    boot.add(ankle);
    // 脚背（拉长半球）
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), M.armorDark);
    foot.scale.set(0.85, 0.7, 1.7);
    foot.position.set(0, -0.1, 0.16);
    shadow(foot);
    boot.add(foot);
    // 脚尖
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), M.armor);
    toe.scale.set(0.85, 0.6, 1.0);
    toe.position.set(0, -0.11, 0.4);
    shadow(toe);
    boot.add(toe);
    // 靴筒护甲
    const bootGuard = shell(0.2, Math.PI * 1.2, Math.PI * 0.4, Math.PI * 0.45, M.armor);
    bootGuard.position.set(0, 0.06, 0.03);
    boot.add(bootGuard);

    rig[`leg_${side < 0 ? 'l' : 'r'}`] = { hip, knee, shin };
    return hip;
  }

  buildLeg(-1);
  buildLeg(1);

  // ---------- 披风 ----------
  const capeGroup = new THREE.Group();
  capeGroup.position.set(0, 4.5, -0.34);
  root.add(capeGroup);
  const capeW = 1.35, capeH = 2.3, segX = 16, segY = 22;
  const capeGeo = new THREE.PlaneGeometry(capeW, capeH, segX, segY);
  const cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({
    color: 0x232833, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide,
  }));
  cape.castShadow = true;
  cape.position.y = -capeH / 2;
  capeGroup.add(cape);
  const capeTrim = new THREE.Mesh(
    new THREE.PlaneGeometry(capeW * 1.02, 0.1),
    new THREE.MeshStandardMaterial({ color: PAL.trim, emissive: PAL.trim, emissiveIntensity: 1.0, side: THREE.DoubleSide }),
  );
  capeTrim.position.y = -capeH + 0.05;
  capeGroup.add(capeTrim);
  // 披风领扣
  for (const s of [-1, 1]) {
    const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), M.trim);
    clasp.position.set(s * 0.32, 0.02, 0.05);
    capeGroup.add(clasp);
  }
  rig.cape = cape;
  rig.capeTrim = capeTrim;
  const capeBase = capeGeo.attributes.position.array.slice();

  // ---------- 武器：能量刃（右手）----------
  const weapon = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.05, 0);
  bladeShape.lineTo(-0.055, 0.55);
  bladeShape.lineTo(0, 0.76);
  bladeShape.lineTo(0.055, 0.55);
  bladeShape.lineTo(0.05, 0);
  bladeShape.closePath();
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1 }),
    M.metal,
  );
  shadow(blade);
  const edgeGlow = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.008, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: PAL.trim, emissive: PAL.trim, emissiveIntensity: 2.4 }),
  );
  edgeGlow.scale.set(0.55, 0.96, 1);
  edgeGlow.position.z = 0.026;
  blade.add(edgeGlow);
  blade.position.y = 0.2;
  weapon.add(blade);
  const guard = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), M.trim);
  guard.rotation.z = Math.PI / 2;
  guard.position.y = 0.18;
  weapon.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.22, 12), M.leather);
  grip.position.y = 0.06;
  weapon.add(grip);
  weapon.position.set(0, -0.02, 0.05);
  weapon.rotation.set(-1.5, 0, 0);
  handR.add(weapon);

  // ---------- 初始姿态 ----------
  rig.arm_l.shoulder.rotation.z = 0.24;
  rig.arm_r.shoulder.rotation.z = -0.24;
  rig.arm_l.upperArm.rotation.z = 0.1;
  rig.arm_r.upperArm.rotation.z = -0.1;
  rig.arm_l.forearm.rotation.x = -0.3;
  rig.arm_r.forearm.rotation.x = -0.6;
  rig.arm_l.forearm.rotation.z = 0.12;
  rig.arm_r.forearm.rotation.z = -0.12;
  rig.leg_l.hip.rotation.z = 0.02;
  rig.leg_r.hip.rotation.z = -0.02;

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------- 待机动画 ----------
  function update(t) {
    const breathe = Math.sin(t * 1.6);
    const sway = Math.sin(t * 0.9);

    rig.chest.scale.set(1 + breathe * 0.01, 1 + breathe * 0.018, 1 + breathe * 0.01);
    rig.chest.position.y = 0.78 + breathe * 0.018;

    rig.hips.position.x = sway * 0.03;
    rig.hips.rotation.z = sway * 0.014;
    rig.spine.rotation.z = -sway * 0.018;
    rig.chest.rotation.z = -sway * 0.014;

    rig.head.rotation.y = Math.sin(t * 0.45) * 0.16;
    rig.head.rotation.x = Math.sin(t * 0.7) * 0.04 - 0.02;

    rig.arm_l.shoulder.rotation.z = 0.24 + breathe * 0.018;
    rig.arm_r.shoulder.rotation.z = -0.24 - breathe * 0.018;
    rig.arm_l.forearm.rotation.x = -0.3 + Math.sin(t * 1.6 + 1) * 0.03;
    rig.arm_r.forearm.rotation.x = -0.6 + Math.sin(t * 1.6) * 0.03;

    M.trim.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.35;
    rig.core.scale.setScalar(0.9 + Math.sin(t * 3) * 0.2);
    rig.core.rotation.y = t * 0.8;
    rig.core.rotation.x = t * 0.5;

    rig.ponytail.rotation.x = 0.55 + Math.sin(t * 2) * 0.08;
    rig.ponytail.rotation.z = Math.sin(t * 1.3) * 0.06;

    // 披风飘动
    const pos = rig.cape.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = capeBase[i], by = capeBase[i + 1];
      const droop = (capeH / 2 - by) / capeH;
      const wave = Math.sin(t * 2 + bx * 3 + by * 2) * 0.08 * droop + Math.sin(t * 1.3 + bx * 2) * 0.05 * droop;
      arr[i] = bx + Math.sin(t + by) * 0.02 * droop;
      arr[i + 2] = capeBase[i + 2] - wave - droop * 0.4;
    }
    pos.needsUpdate = true;
    rig.cape.geometry.computeVertexNormals();
    rig.capeTrim.position.z = -0.4 + Math.sin(t * 1.5) * 0.04;
  }

  return { root, rig, update };
}
