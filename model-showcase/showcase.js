import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

const HEROES=[
  {name:'雷咒师',role:'法师 · 远程爆发',icon:'⚡',color:0x38cfff,desc:'雷晶法杖驱动的远程法师，肩甲与悬浮符文持续放电。',gear:'staff'},
  {name:'赤刃',role:'战士 · 近战连击',icon:'⚔️',color:0xff426d,desc:'双刃与赤红战甲构成清晰轮廓，适合突进和连续斩击。',gear:'blades'},
  {name:'森语',role:'射手 · 持续输出',icon:'🏹',color:0x6df58a,desc:'长弓、箭袋与森林披肩，强调轻盈的远程英雄身形。',gear:'bow'},
  {name:'岩卫',role:'坦克 · 团队守护',icon:'🛡️',color:0xffbd45,desc:'重型塔盾、宽肩护甲与厚重配色，正面轮廓非常醒目。',gear:'shield'},
  {name:'星牧',role:'辅助 · 治疗护盾',icon:'✦',color:0xff8fe8,desc:'星辉权杖与背部光环，用柔和光带表现治疗和增益。',gear:'halo'},
  {name:'影袭',role:'刺客 · 隐身收割',icon:'🌙',color:0x9b6cff,desc:'弯刃、面罩和紫色残影，拥有瘦长而危险的侧面剪影。',gear:'scythes'}
];

const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;stage.append(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x071018,10,24);
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,50);camera.position.set(0,3.3,9);
scene.add(new THREE.HemisphereLight(0xa7dcff,0x172016,2.2));
const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(4,8,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
const rim=new THREE.DirectionalLight(0x4fcfff,3);rim.position.set(-5,4,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.7,.35,64),new THREE.MeshStandardMaterial({color:0x162634,metalness:.45,roughness:.32}));floor.position.y=-.18;floor.receiveShadow=true;scene.add(floor);
const ring=new THREE.Mesh(new THREE.TorusGeometry(2.8,.035,8,96),new THREE.MeshBasicMaterial({color:0x50dfff}));ring.rotation.x=Math.PI/2;ring.position.y=.015;scene.add(ring);
const grid=new THREE.GridHelper(18,36,0x1a8db0,0x123044);grid.position.y=-.35;scene.add(grid);

const loader=new GLTFLoader(),models=[],mixers=[];let current=0,root=null,drag=false,lastX=0,lastY=0,targetYaw=.45,yaw=.45,targetPitch=.05,pitch=.05,targetZoom=9,zoom=9;
const mat=(color,metal=.35,rough=.35,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive,emissiveIntensity:emissive?1.6:0});
function mesh(geo,material,parent,pos=[0,0,0],rot=[0,0,0]){const m=new THREE.Mesh(geo,material);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function addGear(group,h){
  const c=h.color,dark=new THREE.Color(c).multiplyScalar(.28),main=mat(c,.55,.25),black=mat(dark,.6,.3),glow=mat(c,.1,.25,c);
  mesh(new THREE.TorusGeometry(.54,.075,8,28),glow,group,[0,1.45,-.18],[Math.PI/2,0,0]);
  if(h.gear==='staff'){const s=new THREE.Group();group.add(s);s.position.set(.72,.25,.02);mesh(new THREE.CylinderGeometry(.045,.06,1.75,10),black,s,[0,.65,0],[0,0,-.1]);mesh(new THREE.OctahedronGeometry(.24),glow,s,[-.08,1.58,0]);mesh(new THREE.TorusGeometry(.34,.035,7,24),main,s,[-.08,1.58,0]);}
  if(h.gear==='blades'){[-1,1].forEach(k=>{const g=new THREE.Group();group.add(g);g.position.set(.55*k,.45,.06);mesh(new THREE.BoxGeometry(.11,1.25,.08),main,g,[.05*k,.35,0],[0,0,-.42*k]);mesh(new THREE.ConeGeometry(.13,.32,4),glow,g,[.31*k,.9,0],[0,0,-.42*k]);});}
  if(h.gear==='bow'){const b=new THREE.Group();group.add(b);b.position.set(-.67,.7,.02);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.65,0),new THREE.Vector3(-.22,0,0),new THREE.Vector3(0,.65,0)]);mesh(new THREE.TubeGeometry(curve,24,.045,7,false),main,b);mesh(new THREE.CylinderGeometry(.012,.012,1.3,5),glow,b,[0,0,0]);const q=new THREE.Group();group.add(q);q.position.set(.38,.9,-.2);mesh(new THREE.CylinderGeometry(.16,.13,.7,12),black,q);}
  if(h.gear==='shield'){const sh=new THREE.Group();group.add(sh);sh.position.set(-.62,.75,.12);mesh(new THREE.CylinderGeometry(.62,.62,.12,8),main,sh,[0,0,0],[Math.PI/2,0,0]);mesh(new THREE.CylinderGeometry(.4,.4,.15,8),black,sh,[0,0,.03],[Math.PI/2,0,0]);mesh(new THREE.OctahedronGeometry(.2),glow,sh,[0,0,.14]);[-1,1].forEach(k=>mesh(new THREE.BoxGeometry(.45,.2,.35),main,group,[.38*k,1.65,0]));}
  if(h.gear==='halo'){mesh(new THREE.TorusGeometry(.63,.045,8,48),glow,group,[0,1.88,-.18],[Math.PI/2,0,0]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;mesh(new THREE.OctahedronGeometry(.09),glow,group,[Math.cos(a)*.7,1.88,Math.sin(a)*.7-.18]);}const s=new THREE.Group();group.add(s);s.position.set(.65,.38,0);mesh(new THREE.CylinderGeometry(.04,.055,1.5,10),main,s,[0,.55,0]);mesh(new THREE.SphereGeometry(.19,16,12),glow,s,[0,1.34,0]);}
  if(h.gear==='scythes'){[-1,1].forEach(k=>{const g=new THREE.Group();group.add(g);g.position.set(.56*k,.58,.04);mesh(new THREE.CylinderGeometry(.035,.05,.85,8),black,g,[0,.2,0],[0,0,.35*k]);mesh(new THREE.TorusGeometry(.35,.07,7,20,Math.PI),main,g,[.13*k,.6,0],[0,0,-.5*k]);});mesh(new THREE.ConeGeometry(.38,.35,5),black,group,[0,1.75,.08],[0,0,Math.PI]);}
  for(let i=0;i<10;i++){const p=mesh(new THREE.SphereGeometry(.025,6,4),glow,group,[Math.sin(i*2.1)*.8,.25+(i%5)*.33,Math.cos(i*1.7)*.45]);p.userData.phase=i*.7;}
}
function recolor(obj,h){let n=0;obj.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const base=new THREE.Color(h.color);const f=.32+(n++%4)*.17;o.material=new THREE.MeshStandardMaterial({color:base.clone().multiplyScalar(f),roughness:.48,metalness:.12});});}
async function loadOne(i){return new Promise((resolve,reject)=>loader.load(`../models/hero-${i}.glb`,g=>{const wrap=new THREE.Group();const model=g.scene;model.scale.setScalar(3.15);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.z-=center.z;model.position.y-=box.min.y;recolor(model,HEROES[i]);wrap.add(model);addGear(wrap,HEROES[i]);models[i]=wrap;if(g.animations.length){const mx=new THREE.AnimationMixer(model);mixers[i]=mx;mx.clipAction(g.animations.find(a=>/idle/i.test(a.name))||g.animations[0]).play()}resolve()},undefined,reject))}
function select(i){current=i;if(root)scene.remove(root);root=models[i];scene.add(root);root.rotation.y=yaw;ring.material.color.setHex(HEROES[i].color);rim.color.setHex(HEROES[i].color);document.documentElement.style.setProperty('--accent',`#${HEROES[i].color.toString(16).padStart(6,'0')}`);document.querySelector('#name').textContent=HEROES[i].name;document.querySelector('#role').textContent=HEROES[i].role;document.querySelector('#desc').textContent=HEROES[i].desc;[...document.querySelectorAll('#bar button')].forEach((b,n)=>b.classList.toggle('active',n===i))}
const bar=document.querySelector('#bar');HEROES.forEach((h,i)=>{const b=document.createElement('button');b.style.setProperty('--c',`#${h.color.toString(16).padStart(6,'0')}`);b.innerHTML=`<span>${h.icon}</span>${h.name}`;b.onclick=()=>select(i);bar.append(b)});
Promise.all(HEROES.map((_,i)=>loadOne(i))).then(()=>{select(0);status.classList.add('hide')}).catch(e=>{status.textContent='模型加载失败，请刷新重试';console.error(e)});

renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;targetYaw+=(e.clientX-lastX)*.012;targetPitch=Math.max(-.35,Math.min(.3,targetPitch+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY});renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('wheel',e=>{targetZoom=Math.max(6.2,Math.min(12,targetZoom+e.deltaY*.006));e.preventDefault()},{passive:false});
let pinch=0;renderer.domElement.addEventListener('touchmove',e=>{if(e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinch)targetZoom=Math.max(6.2,Math.min(12,targetZoom+(pinch-d)*.018));pinch=d}},{passive:false});renderer.domElement.addEventListener('touchend',()=>pinch=0);
const clock=new THREE.Clock();function tick(){requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);mixers.forEach(m=>m&&m.update(dt));yaw+=(targetYaw-yaw)*.1;pitch+=(targetPitch-pitch)*.1;zoom+=(targetZoom-zoom)*.1;if(root){root.rotation.y=yaw;root.position.y=Math.sin(performance.now()*.0015)*.025;root.traverse(o=>{if(o.userData.phase!=null){o.position.y+=Math.sin(performance.now()*.002+o.userData.phase)*.0008}})}camera.position.set(0,3.25+pitch*3,zoom);camera.lookAt(0,1.25,0);renderer.render(scene,camera)}tick();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
