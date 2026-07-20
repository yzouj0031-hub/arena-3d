import * as THREE from 'three';

// ============================================================
//  程序化人物建模 —— 赛博游侠「夜隼」
//  纯几何体拼装，无外部 GLB，可整体导出为一个可动的角色。
//  返回 { root, update(t) }，root 直接加入场景即可。
// ============================================================

const PALETTE = {
  skin: 0xd9a689,
  skinDark: 0xb07f63,
  armorDark: 0x161c26,
  armorMid: 0x263241,
  armorLight: 0x9fb4c9,
  trim: 0x35e0ff,        // 队伍能量色（青）
  trimWarm: 0xffb347,
  cloth: 0x2a2f3c,
  clothTrim: 0x3a4256,
  leather: 0x3a2a20,
  hair: 0x1b1e28,
  metalBright: 0xc9d8e6,
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, ...opts });
}

const M = {
  skin: mat(PALETTE.skin, { roughness: 0.62, metalness: 0.04 }),
  skinDark: mat(PALETTE.skinDark, { roughness: 0.7 }),
  armorDark: mat(PALETTE.armorDark, { roughness: 0.42, metalness: 0.72 }),
  armorMid: mat(PALETTE.armorMid, { roughness: 0.38, metalness: 0.78 }),
  armorLight: mat(PALETTE.armorLight, { roughness: 0.28, metalness: 0.88 }),
  metal: mat(PALETTE.metalBright, { roughness: 0.2, metalness: 0.95 }),
  cloth: mat(PALETTE.cloth, { roughness: 0.88, metalness: 0.02 }),
  clothTrim: mat(PALETTE.clothTrim, { roughness: 0.8 }),
  leather: mat(PALETTE.leather, { roughness: 0.72, metalness: 0.06 }),
  hair: mat(PALETTE.hair, { roughness: 0.55, metalness: 0.1 }),
  trim: mat(PALETTE.trim, { roughness: 0.3, metalness: 0.4, emissive: PALETTE.trim, emissiveIntensity: 1.5 }),
  trimWarm: mat(PALETTE.trimWarm, { emissive: PALETTE.trimWarm, emissiveIntensity: 1.2, roughness: 0.5 }),
  visor: mat(0x0a1420, { roughness: 0.08, metalness: 0.6, emissive: PALETTE.trim, emissiveIntensity: 0.9 }),
};

function meshShadow(m) {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// 一个圆角箱体（用于甲片），比裸 Box 更精致
function plate(w, h, d, material, r = 0.03) {
  // 用 Box + 轻微缩放的斜角替代，避免额外依赖；这里用 Box 足够，靠材质出效果
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  return meshShadow(new THREE.Mesh(g, material));
}

// 生成一个能发光的细条描边
function trimBar(len, thick, material, axis = 'y') {
  const g = new THREE.BoxGeometry(
    axis === 'x' ? len : thick,
    axis === 'y' ? len : thick,
    thick,
  );
  return new THREE.Mesh(g, material);
}

export function buildCharacter() {
  const root = new THREE.Group();
  root.name = 'Hero';

  // 关节容器，便于做待机动画
  const rig = {};

  // ---------- 骨盆 / 腰 ----------
  const hips = new THREE.Group();
  hips.position.y = 3.35;
  root.add(hips);
  rig.hips = hips;

  // 腰带
  const belt = plate(0.98, 0.34, 0.62, M.leather);
  belt.position.y = 0;
  hips.add(belt);
  const buckle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), M.trim);
  buckle.position.set(0, 0, 0.34);
  hips.add(buckle);

  // 腰侧发光条
  for (const s of [-1, 1]) {
    const b = trimBar(0.3, 0.05, M.trim, 'y');
    b.position.set(s * 0.42, 0, 0.3);
    hips.add(b);
  }

  // 前后腰甲（垂片）
  const tassetFront = plate(0.5, 0.55, 0.08, M.armorMid);
  tassetFront.position.set(0, -0.42, 0.32);
  tassetFront.rotation.x = 0.12;
  hips.add(tassetFront);
  const tassetFrontTrim = trimBar(0.42, 0.04, M.trim, 'x');
  tassetFrontTrim.position.set(0, -0.62, 0.37);
  hips.add(tassetFrontTrim);

  // ---------- 脊柱 / 躯干 ----------
  const spine = new THREE.Group();
  spine.position.y = 0.2;
  hips.add(spine);
  rig.spine = spine;

  // 腹部（收窄）
  const abdomen = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.3, 6, 16),
    M.armorDark,
  );
  abdomen.scale.set(1.05, 1, 0.8);
  abdomen.position.y = 0.35;
  meshShadow(abdomen);
  spine.add(abdomen);

  // 腹肌发光分隔线
  for (let i = 0; i < 3; i++) {
    const line = trimBar(0.5, 0.03, M.trim, 'x');
    line.position.set(0, 0.15 + i * 0.18, 0.36);
    spine.add(line);
  }

  // 胸甲（胸腔 + 甲片）
  const chest = new THREE.Group();
  chest.position.y = 0.82;
  spine.add(chest);
  rig.chest = chest;

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 0.42, 8, 20),
    M.armorMid,
  );
  torso.scale.set(1.15, 1, 0.82);
  meshShadow(torso);
  chest.add(torso);

  // 胸口发光核心
  const coreHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 16), M.armorDark);
  coreHousing.rotation.x = Math.PI / 2;
  coreHousing.position.set(0, 0.12, 0.5);
  chest.add(coreHousing);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), M.trim);
  core.position.set(0, 0.12, 0.55);
  chest.add(core);
  rig.core = core;
  const coreLight = new THREE.PointLight(PALETTE.trim, 3, 4, 2);
  coreLight.position.set(0, 0.12, 0.7);
  chest.add(coreLight);

  // 胸甲斜切装饰片
  for (const s of [-1, 1]) {
    const pec = plate(0.42, 0.5, 0.16, M.armorLight);
    pec.position.set(s * 0.28, 0.1, 0.4);
    pec.rotation.z = s * -0.18;
    chest.add(pec);
    const pecTrim = trimBar(0.4, 0.035, M.trim, 'y');
    pecTrim.position.set(s * 0.46, 0.1, 0.45);
    pecTrim.rotation.z = s * -0.18;
    chest.add(pecTrim);
  }

  // ---------- 颈 / 头 ----------
  const neck = new THREE.Group();
  neck.position.y = 0.62;
  chest.add(neck);
  rig.neck = neck;

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.28, 12), M.skin);
  neckMesh.position.y = 0.14;
  meshShadow(neckMesh);
  neck.add(neckMesh);

  // 高领护颈
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 0.28, 16, 1, true, -Math.PI * 0.75, Math.PI * 1.5),
    M.armorMid,
  );
  collar.position.y = 0.16;
  meshShadow(collar);
  neck.add(collar);

  const head = new THREE.Group();
  head.position.y = 0.42;
  neck.add(head);
  rig.head = head;

  // 头颅
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 20), M.skin);
  skull.scale.set(0.92, 1.04, 0.98);
  skull.position.y = 0.12;
  meshShadow(skull);
  head.add(skull);

  // 下巴 / 脸颊收窄
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), M.skin);
  jaw.scale.set(0.82, 0.7, 0.9);
  jaw.position.set(0, -0.04, 0.03);
  meshShadow(jaw);
  head.add(jaw);

  // 头盔（半覆盖，露脸）
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    M.armorMid,
  );
  helm.scale.set(0.94, 1.05, 1.0);
  helm.position.y = 0.14;
  meshShadow(helm);
  head.add(helm);

  // 头盔中脊
  const crest = plate(0.06, 0.42, 0.3, M.armorLight);
  crest.position.set(0, 0.24, -0.02);
  head.add(crest);
  const crestGlow = trimBar(0.34, 0.03, M.trim, 'y');
  crestGlow.position.set(0, 0.26, 0.14);
  crestGlow.rotation.x = -0.4;
  head.add(crestGlow);

  // 护目发光条（横跨眉眼）
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.06), M.visor);
  visor.position.set(0, 0.08, 0.28);
  head.add(visor);

  // 双眼发光点
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.trim);
    eye.position.set(s * 0.12, 0.08, 0.31);
    head.add(eye);
  }

  // 侧耳护甲
  for (const s of [-1, 1]) {
    const earGuard = plate(0.07, 0.24, 0.2, M.armorDark);
    earGuard.position.set(s * 0.33, 0.06, 0.02);
    head.add(earGuard);
    const earTrim = trimBar(0.16, 0.03, M.trim, 'y');
    earTrim.position.set(s * 0.37, 0.06, 0.06);
    head.add(earTrim);
  }

  // 后脑束发
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), M.hair);
  hair.scale.set(0.96, 0.8, 1.0);
  hair.position.set(0, 0.08, -0.04);
  head.add(hair);
  const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 6, 10), M.hair);
  ponytail.position.set(0, -0.05, -0.3);
  ponytail.rotation.x = 0.5;
  head.add(ponytail);
  rig.ponytail = ponytail;

  // ---------- 手臂 ----------
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.66, 0.42, 0);
    chest.add(shoulder);

    // 肩甲（大护肩）
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), M.armorLight);
    pauldron.scale.set(1.1, 0.9, 1.1);
    pauldron.position.set(side * 0.12, 0.12, 0);
    meshShadow(pauldron);
    shoulder.add(pauldron);
    const pauldronEdge = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24, Math.PI), M.trim);
    pauldronEdge.rotation.set(Math.PI / 2, 0, side < 0 ? 0 : Math.PI);
    pauldronEdge.position.set(side * 0.12, 0.1, 0);
    shoulder.add(pauldronEdge);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), M.armorDark);
    spike.position.set(side * 0.3, 0.22, 0);
    spike.rotation.z = side * -0.6;
    shoulder.add(spike);

    // 上臂
    const upperArm = new THREE.Group();
    upperArm.position.set(side * 0.16, -0.05, 0);
    shoulder.add(upperArm);
    const bicep = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 6, 14), M.armorDark);
    bicep.position.y = -0.28;
    meshShadow(bicep);
    upperArm.add(bicep);

    // 肘 / 前臂
    const forearm = new THREE.Group();
    forearm.position.y = -0.56;
    upperArm.add(forearm);
    const elbowGuard = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), M.armorMid);
    forearm.add(elbowGuard);
    const bracer = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.38, 6, 14), M.armorMid);
    bracer.position.y = -0.28;
    meshShadow(bracer);
    forearm.add(bracer);
    // 护腕发光环
    const bracerTrim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 20), M.trim);
    bracerTrim.rotation.x = Math.PI / 2;
    bracerTrim.position.y = -0.42;
    forearm.add(bracerTrim);

    // 手
    const hand = new THREE.Group();
    hand.position.y = -0.52;
    forearm.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.12), M.armorDark);
    meshShadow(palm);
    hand.add(palm);
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.1), M.armorDark);
    fingers.position.set(0, -0.15, 0.02);
    hand.add(fingers);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), M.armorDark);
    thumb.position.set(side * 0.09, -0.05, 0.03);
    thumb.rotation.z = side * 0.6;
    hand.add(thumb);

    rig[`arm_${side < 0 ? 'l' : 'r'}`] = { shoulder, upperArm, forearm, hand };
    return hand;
  }

  const handL = buildArm(-1);
  const handR = buildArm(1);
  rig.handR = handR;

  // ---------- 腿 ----------
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.28, -0.1, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 6, 14), M.armorDark);
    thigh.position.y = -0.38;
    meshShadow(thigh);
    hip.add(thigh);
    // 大腿甲片
    const thighPlate = plate(0.34, 0.5, 0.16, M.armorMid);
    thighPlate.position.set(0, -0.36, 0.18);
    hip.add(thighPlate);

    const knee = new THREE.Group();
    knee.position.y = -0.72;
    hip.add(knee);
    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), M.armorLight);
    kneeCap.scale.set(1, 1, 1.1);
    knee.add(kneeCap);
    const kneeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), M.armorMid);
    kneeSpike.position.set(0, 0.02, 0.2);
    kneeSpike.rotation.x = Math.PI / 2;
    knee.add(kneeSpike);

    const shin = new THREE.Group();
    shin.position.y = -0.1;
    knee.add(shin);
    const shinMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 14), M.armorMid);
    shinMesh.position.y = -0.34;
    meshShadow(shinMesh);
    shin.add(shinMesh);
    const shinTrim = trimBar(0.4, 0.03, M.trim, 'y');
    shinTrim.position.set(0, -0.34, 0.18);
    shin.add(shinTrim);

    // 靴
    const boot = new THREE.Group();
    boot.position.y = -0.66;
    shin.add(boot);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M.armorDark);
    boot.add(ankle);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.5), M.armorDark);
    foot.position.set(0, -0.1, 0.14);
    meshShadow(foot);
    boot.add(foot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), M.armorMid);
    toe.position.set(0, -0.12, 0.4);
    boot.add(toe);

    rig[`leg_${side < 0 ? 'l' : 'r'}`] = { hip, knee, shin };
    return hip;
  }

  buildLeg(-1);
  buildLeg(1);

  // ---------- 披风 ----------
  const capeGroup = new THREE.Group();
  capeGroup.position.set(0, 4.55, -0.32);
  root.add(capeGroup);
  const capeW = 1.3;
  const capeH = 2.2;
  const segX = 12;
  const segY = 18;
  const capeGeo = new THREE.PlaneGeometry(capeW, capeH, segX, segY);
  const capeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.cloth,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.castShadow = true;
  cape.position.y = -capeH / 2;
  capeGroup.add(cape);
  // 披风内衬发光边
  const capeTrim = new THREE.Mesh(
    new THREE.PlaneGeometry(capeW * 1.02, 0.12),
    new THREE.MeshStandardMaterial({ color: PALETTE.trim, emissive: PALETTE.trim, emissiveIntensity: 1.2, side: THREE.DoubleSide }),
  );
  capeTrim.position.y = -capeH + 0.06;
  capeGroup.add(capeTrim);
  rig.cape = cape;
  rig.capeTrim = capeTrim;
  const capeBase = capeGeo.attributes.position.array.slice();

  // ---------- 武器：能量双刃匕（握在右手）----------
  const weapon = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.05, 0);
  bladeShape.lineTo(-0.06, 0.5);
  bladeShape.lineTo(0, 0.72);
  bladeShape.lineTo(0.06, 0.5);
  bladeShape.lineTo(0.05, 0);
  bladeShape.closePath();
  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.008, bevelSegments: 1 }),
    M.metal,
  );
  meshShadow(blade);
  const edge = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.006, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: PALETTE.trim, emissive: PALETTE.trim, emissiveIntensity: 2.2 }),
  );
  edge.scale.set(0.6, 0.95, 1);
  edge.position.z = 0.024;
  blade.add(edge);
  blade.position.y = 0.18;
  weapon.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.06), M.trim);
  guard.position.y = 0.16;
  weapon.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 10), M.leather);
  grip.position.y = 0.05;
  weapon.add(grip);
  weapon.position.set(0, -0.02, 0.06);
  weapon.rotation.set(-1.5, 0, 0);
  handR.add(weapon);

  // ---------- 初始姿态（A-pose 微调，更自然）----------
  rig.arm_l.shoulder.rotation.z = 0.28;
  rig.arm_r.shoulder.rotation.z = -0.28;
  rig.arm_l.upperArm.rotation.z = 0.12;
  rig.arm_r.upperArm.rotation.z = -0.12;
  rig.arm_l.forearm.rotation.x = -0.25;
  rig.arm_r.forearm.rotation.x = -0.55;
  rig.arm_l.forearm.rotation.z = 0.1;
  rig.arm_r.forearm.rotation.z = -0.1;
  rig.leg_l.hip.rotation.z = 0.03;
  rig.leg_r.hip.rotation.z = -0.03;

  // 让所有网格都投/收阴影
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  // ---------- 待机动画 ----------
  function update(t) {
    const breathe = Math.sin(t * 1.6);
    const sway = Math.sin(t * 0.9);

    // 呼吸：胸腔起伏
    rig.chest.scale.set(1 + breathe * 0.012, 1 + breathe * 0.02, 1 + breathe * 0.012);
    rig.chest.position.y = 0.82 + breathe * 0.02;

    // 重心轻微左右
    rig.hips.position.x = sway * 0.03;
    rig.hips.rotation.z = sway * 0.015;
    rig.spine.rotation.z = -sway * 0.02;
    rig.chest.rotation.z = -sway * 0.015;

    // 头部环视
    rig.head.rotation.y = Math.sin(t * 0.45) * 0.18;
    rig.head.rotation.x = Math.sin(t * 0.7) * 0.04 - 0.02;

    // 手臂随呼吸轻摆
    rig.arm_l.shoulder.rotation.z = 0.28 + breathe * 0.02;
    rig.arm_r.shoulder.rotation.z = -0.28 - breathe * 0.02;
    rig.arm_l.forearm.rotation.x = -0.25 + Math.sin(t * 1.6 + 1) * 0.03;
    rig.arm_r.forearm.rotation.x = -0.55 + Math.sin(t * 1.6) * 0.03;

    // 核心脉动
    const pulse = 0.9 + Math.sin(t * 3) * 0.25;
    M.trim.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.4;
    rig.core.scale.setScalar(pulse);
    rig.core.rotation.y = t * 0.8;
    rig.core.rotation.x = t * 0.5;

    // 马尾摆动
    rig.ponytail.rotation.x = 0.5 + Math.sin(t * 2) * 0.08;
    rig.ponytail.rotation.z = Math.sin(t * 1.3) * 0.06;

    // 披风飘动（顶点波浪）
    const pos = rig.cape.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = capeBase[i];
      const by = capeBase[i + 1];
      // 越往下摆动越大
      const droop = (capeH / 2 - by) / capeH; // 0(top)~1(bottom)
      const wave =
        Math.sin(t * 2 + bx * 3 + by * 2) * 0.08 * droop +
        Math.sin(t * 1.3 + bx * 2) * 0.05 * droop;
      arr[i] = bx + Math.sin(t + by) * 0.02 * droop;
      arr[i + 1] = by;
      arr[i + 2] = capeBase[i + 2] - wave - droop * 0.35; // 自然内凹披落
    }
    pos.needsUpdate = true;
    rig.cape.geometry.computeVertexNormals();
    rig.capeTrim.position.z = -0.35 + Math.sin(t * 1.5) * 0.04;
  }

  return { root, rig, update };
}
