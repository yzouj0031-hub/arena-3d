import {createClient} from '@supabase/supabase-js';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

const SUPABASE_URL='https://hnlsmcucmbicygzjfmuf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_pz6eS_bYsKjinBPtLgLYxQ_CvUXIEUf';
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:15}}});
const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HEROES=[
  {name:'雷咒师',role:'法师',icon:'⚡',color:0x58cfff},
  {name:'玄甲卫',role:'坦克',icon:'🛡️',color:0xe2bd78},
  {name:'夜行刃',role:'刺客',icon:'🗡️',color:0xc681ff},
  {name:'星弦',role:'射手',icon:'🏹',color:0x72edbc},
  {name:'青灯使',role:'辅助',icon:'🏮',color:0xa7ff8e},
  {name:'炎武尊',role:'战士',icon:'🔥',color:0xff7b53}
];
const playerId=sessionStorage.getItem('arena-online-id')||crypto.randomUUID();
sessionStorage.setItem('arena-online-id',playerId);
let selectedHero=0,channel=null,roomCode='',selfMeta=null,players=[],isReady=false,match=null,toastTimer=0;

initLobby();
function initLobby(){
  const remembered=localStorage.getItem('arena-player-name')||`玩家${Math.floor(Math.random()*900+100)}`;
  $('#playerName').value=remembered;
  $('#heroList').innerHTML='';
  HEROES.forEach((h,i)=>{const b=document.createElement('button');b.className='hero-option'+(i===0?' selected':'');b.innerHTML=`<span>${h.icon}</span><b>${h.name}</b><small>${h.role}</small>`;b.onclick=()=>selectHero(i);$('#heroList').appendChild(b)});
  renderRoster([]);
  $('#createRoom').onclick=()=>connectRoom(makeCode(),true);
  $('#joinRoom').onclick=()=>{const code=normalizeCode($('#roomCode').value);if(code.length!==6)return toast('请输入六位房间码');connectRoom(code,false)};
  $('#copyRoom').onclick=copyRoomCode;
  $('#readyButton').onclick=toggleReady;
  $('#startButton').onclick=startMatchAsHost;
  $('#playerName').addEventListener('change',updateIdentity);
  $('#roomCode').addEventListener('input',e=>e.target.value=normalizeCode(e.target.value));
  $('#leaveMatch').onclick=()=>location.reload();
  addEventListener('beforeunload',()=>{if(channel)supabase.removeChannel(channel)});
}
function selectHero(i){selectedHero=i;document.querySelectorAll('.hero-option').forEach((b,n)=>b.classList.toggle('selected',n===i));if(channel&&selfMeta){selfMeta.hero=i;isReady=false;selfMeta.ready=false;channel.track(selfMeta);updateLobbyButtons()}}
function makeCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}
function normalizeCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
function playerName(){return ($('#playerName').value.trim()||'玩家').slice(0,12)}
function setConnection(kind,text){$('#connectionDot').className='dot '+kind;$('#connectionText').textContent=text}
function toast(text){clearTimeout(toastTimer);const el=$('#toast');el.textContent=text;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
async function connectRoom(code,wantsHost){
  if(channel){await supabase.removeChannel(channel);channel=null}
  localStorage.setItem('arena-player-name',playerName());roomCode=code;isReady=false;players=[];$('#roomCode').value=code;setConnection('connecting','正在连接 Supabase Realtime…');
  selfMeta={id:playerId,name:playerName(),hero:selectedHero,ready:false,wantsHost,joinedAt:Date.now()};
  channel=supabase.channel(`arena_3v3_${code}`,{config:{presence:{key:playerId},broadcast:{self:true,ack:false}}});
  channel.on('presence',{event:'sync'},syncPresence)
    .on('broadcast',{event:'room'},({payload})=>handleRoomEvent(payload))
    .on('broadcast',{event:'state'},({payload})=>handleRemoteState(payload))
    .on('broadcast',{event:'attack'},({payload})=>handleRemoteAttack(payload));
  channel.subscribe(async status=>{
    if(status==='SUBSCRIBED'){
      await channel.track(selfMeta);setConnection('online',`已连接房间 ${code}`);$('#copyRoom').disabled=false;$('#roomHint').textContent='把房间码发给其他设备';
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      setConnection('error','连接失败，请检查网络或 Supabase 项目');toast('服务器连接失败');
    }else if(status==='CLOSED'&&roomCode){setConnection('error','连接已断开')}
  });
}
function flattenPresence(state){return Object.values(state).flat().map(p=>({id:p.id||p.presence_ref,name:String(p.name||'玩家').slice(0,12),hero:clamp(Number(p.hero)||0,0,5),ready:!!p.ready,wantsHost:!!p.wantsHost,joinedAt:Number(p.joinedAt)||Date.now()}))}
async function syncPresence(){
  if(!channel)return;players=flattenPresence(channel.presenceState()).sort((a,b)=>a.joinedAt-b.joinedAt||a.id.localeCompare(b.id));
  const myIndex=players.findIndex(p=>p.id===playerId);
  if(players.length>6&&myIndex>=6){toast('房间已满六人');setConnection('error','房间已满');await supabase.removeChannel(channel);channel=null;players=[]}
  renderRoster(players.slice(0,6));updateLobbyButtons();if(match)syncMatchRoster();
}
function isHost(){return players[0]?.id===playerId}
function updateLobbyButtons(){
  const connected=!!channel&&players.some(p=>p.id===playerId),host=isHost(),allReady=players.length>=2&&players.every(p=>p.ready);
  $('#readyButton').disabled=!connected;$('#readyButton').textContent=isReady?'取消准备':'准备';
  $('#startButton').disabled=!host||!allReady;$('#startButton').textContent=host?(allReady?'开始联机测试':`等待全员准备 ${players.filter(p=>p.ready).length}/${players.length}`):'由房主开始';
  if(connected)$('#roomHint').textContent=host?'你是房主 · 至少两人且全员准备后开局':'已加入 · 等待房主开局';
}
function renderRoster(list){
  $('#memberCount').textContent=`${list.length}/6`;const box=$('#roster');box.innerHTML='';
  for(let i=0;i<6;i++){
    const p=list[i],slot=document.createElement('div');slot.className='slot '+(i>=3?'red ':'')+(p?'':'empty');
    if(p){const h=HEROES[p.hero];slot.innerHTML=`<div class="avatar">${h.icon}</div><div><strong></strong><small>${i<3?'苍穹':'赤渊'} · ${h.name}${i===0?' · 房主':''}</small></div><em class="${p.ready?'ready':''}">${p.ready?'已准备':'未准备'}</em>`;slot.querySelector('strong').textContent=p.name+(p.id===playerId?'（你）':'')}
    else slot.innerHTML=`<div class="avatar">?</div><div><strong>等待玩家</strong><small>${i<3?'苍穹':'赤渊'}席位</small></div><em>空闲</em>`;
    box.appendChild(slot);
  }
}
async function updateIdentity(){localStorage.setItem('arena-player-name',playerName());if(channel&&selfMeta){selfMeta.name=playerName();await channel.track(selfMeta)}}
async function toggleReady(){if(!channel||!selfMeta)return;isReady=!isReady;selfMeta.ready=isReady;selfMeta.hero=selectedHero;await channel.track(selfMeta);updateLobbyButtons()}
function copyRoomCode(){navigator.clipboard?.writeText(roomCode).then(()=>toast('房间码已复制')).catch(()=>toast(`房间码：${roomCode}`))}
function sendRoom(payload){return channel?.send({type:'broadcast',event:'room',payload})}
function startMatchAsHost(){if(!isHost()||players.length<2||!players.every(p=>p.ready))return;const roster=players.slice(0,6).map((p,slot)=>({...p,slot,team:slot<3?0:1}));sendRoom({type:'start',roster,seed:Date.now(),from:playerId});beginMatch(roster)}
function handleRoomEvent(payload){if(!payload||payload.from===playerId)return;if(payload.type==='start'&&Array.isArray(payload.roster)){beginMatch(payload.roster);toast('房主已开始联机测试')}}

const loader=new GLTFLoader();
async function loadHeroTemplate(id){return new Promise(resolve=>loader.load(`../models/hero-${id}.glb`,g=>resolve(g),undefined,()=>resolve(null)))}
function parallelTraverse(a,b,fn){fn(a,b);for(let i=0;i<a.children.length;i++)parallelTraverse(a.children[i],b.children[i],fn)}
function cloneSkinnedModel(source){const sourceLookup=new Map(),cloneLookup=new Map(),clone=source.clone(true);parallelTraverse(source,clone,(a,b)=>{sourceLookup.set(b,a);cloneLookup.set(a,b)});clone.traverse(node=>{if(!node.isSkinnedMesh)return;const sourceMesh=sourceLookup.get(node);node.skeleton=sourceMesh.skeleton.clone();node.bindMatrix.copy(sourceMesh.bindMatrix);node.skeleton.bones=sourceMesh.skeleton.bones.map(b=>cloneLookup.get(b));node.bind(node.skeleton,node.bindMatrix)});return clone}
async function beginMatch(roster){
  if(match)return;players=roster;$('#lobby').classList.add('hidden');$('#arena').classList.remove('hidden');$('#matchRoom').textContent=`房间 ${roomCode}`;
  const me=roster.find(p=>p.id===playerId),team=me?.team||0;$('#teamName').textContent=team?'赤渊队':'苍穹队';$('#teamName').className=team?'red':'';
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a1721);scene.fog=new THREE.FogExp2(0x102630,.012);const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,220);const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;$('#renderHost').appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xaedcff,0x1a281b,1.8));const sun=new THREE.DirectionalLight(0xffd8aa,2.8);sun.position.set(-18,38,16);sun.castShadow=true;scene.add(sun);buildArena(scene);
  const needed=[...new Set(roster.map(p=>p.hero))],loaded=await Promise.all(needed.map(async id=>[id,await loadHeroTemplate(id)])),templates=new Map(loaded);
  const actors=new Map();roster.forEach((p,slot)=>actors.set(p.id,spawnActor(scene,p,slot,templates.get(p.hero))));
  match={scene,camera,renderer,actors,roster,me,local:actors.get(playerId),last:performance.now(),lastSend:0,seq:0,keys:{},joy:{x:0,y:0,id:null},yaw:0,drag:false,lastPointerX:0,attacks:[],templates};
  renderMemberStrip(roster);bindMatchControls();syncMatchRoster();addFeed('联机测试开始：移动与攻击动作会同步到所有设备');requestAnimationFrame(matchLoop);
}
function buildArena(scene){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(92,48),new THREE.MeshStandardMaterial({color:0x245335,roughness:.94}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const lane=new THREE.Mesh(new THREE.PlaneGeometry(86,14),new THREE.MeshStandardMaterial({color:0x737c83,roughness:.9}));lane.rotation.x=-Math.PI/2;lane.position.y=.02;scene.add(lane);
  const river=new THREE.Mesh(new THREE.PlaneGeometry(7,48),new THREE.MeshStandardMaterial({color:0x19748b,emissive:0x0d3645,emissiveIntensity:.55,metalness:.25,roughness:.2}));river.rotation.x=-Math.PI/2;river.position.y=.04;scene.add(river);
  for(const side of [-1,1]){const color=side<0?0x36cfff:0xff536f;const base=new THREE.Group();const foot=new THREE.Mesh(new THREE.CylinderGeometry(4.2,5,1.2,12),new THREE.MeshStandardMaterial({color:0x263440,metalness:.35}));foot.position.y=.6;const core=new THREE.Mesh(new THREE.OctahedronGeometry(1.8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.4,metalness:.3}));core.position.y=3;base.add(foot,core);base.position.x=side*39;scene.add(base)}
  for(let i=0;i<34;i++){const side=i%2?1:-1,x=-42+Math.random()*84,z=side*(10+Math.random()*12),r=new THREE.Mesh(new THREE.DodecahedronGeometry(.6+Math.random(),0),new THREE.MeshStandardMaterial({color:0x385046,roughness:1}));r.position.set(x,.6,z);r.scale.y=.7;scene.add(r)}
}
function spawnActor(scene,p,slot,gltf){
  const root=new THREE.Group();root.position.copy(spawnPosition(slot));scene.add(root);let model=null,mixer=null,actions={};
  if(gltf){model=cloneSkinnedModel(gltf.scene);model.scale.setScalar(3.1);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material=o.material.clone();o.material.emissive=new THREE.Color(p.team?0x22000a:0x001c2c);o.material.emissiveIntensity=.32}});root.add(model);mixer=new THREE.AnimationMixer(model);for(const clip of gltf.animations){const n=clip.name.toLowerCase();if(n.includes('idle')&&!actions.idle)actions.idle=mixer.clipAction(clip);if((n.includes('sprint')||n.includes('run'))&&!actions.run)actions.run=mixer.clipAction(clip);if(n.includes('attack')&&!actions.attack)actions.attack=mixer.clipAction(clip)}actions.idle?.play()}
  else{const body=new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.4,5,10),new THREE.MeshStandardMaterial({color:HEROES[p.hero].color,emissive:HEROES[p.hero].color,emissiveIntensity:.25}));body.position.y=1.35;root.add(body);model=body}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1.12,32),new THREE.MeshBasicMaterial({color:p.team?0xff5878:0x4bd7ff,side:THREE.DoubleSide,transparent:true,opacity:p.id===playerId?1:.65}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;root.add(ring);
  return{id:p.id,meta:p,root,model,mixer,actions,anim:'idle',target:root.position.clone(),seq:0,lastSeen:performance.now()}
}
function spawnPosition(slot){const team=slot<3?0:1,index=slot%3;return new THREE.Vector3(team?-34:34,0,(index-1)*5)}
function setActorAnim(a,name){if(a.anim===name)return;const next=a.actions[name]||a.actions.idle;if(!next)return;Object.values(a.actions).forEach(x=>x&&x!==next&&x.fadeOut(.12));next.reset().fadeIn(.12).play();a.anim=name}
function renderMemberStrip(roster){const box=$('#memberStrip');box.innerHTML='';roster.forEach(p=>{const d=document.createElement('div');d.className='member-pill '+(p.team?'red ':'')+(p.id===playerId?'me':'');d.textContent=`${HEROES[p.hero].icon} ${p.name}`;box.appendChild(d)})}
function syncMatchRoster(){if(!match)return;$('#networkInfo').textContent=`${players.length}/6 在线 · 10Hz 同步`}
function bindMatchControls(){
  addEventListener('keydown',e=>{if(!match)return;match.keys[e.key.toLowerCase()]=true;if(e.code==='Space'){e.preventDefault();attack()}});addEventListener('keyup',e=>{if(match)match.keys[e.key.toLowerCase()]=false});
  const joy=$('#joystick'),knob=$('#knob');function move(e){const t=[...e.changedTouches].find(x=>match.joy.id===null||x.identifier===match.joy.id);if(!t)return;if(match.joy.id===null)match.joy.id=t.identifier;const r=joy.getBoundingClientRect(),dx0=t.clientX-r.left-r.width/2,dy0=t.clientY-r.top-r.height/2,max=r.width*.34,l=Math.hypot(dx0,dy0)||1,dx=l>max?dx0*max/l:dx0,dy=l>max?dy0*max/l:dy0;match.joy.x=dx/max;match.joy.y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}
  joy.addEventListener('touchstart',e=>{e.preventDefault();move(e)},{passive:false});joy.addEventListener('touchmove',e=>{e.preventDefault();move(e)},{passive:false});joy.addEventListener('touchend',e=>{if([...e.changedTouches].some(t=>t.identifier===match.joy.id)){match.joy={x:0,y:0,id:null};knob.style.transform=''}},{passive:false});
  $('#attackButton').addEventListener('pointerdown',e=>{e.preventDefault();attack()});const canvas=match.renderer.domElement;canvas.addEventListener('pointerdown',e=>{match.drag=true;match.lastPointerX=e.clientX});canvas.addEventListener('pointermove',e=>{if(match.drag){match.yaw+=(e.clientX-match.lastPointerX)*.008;match.lastPointerX=e.clientX}});addEventListener('pointerup',()=>{if(match)match.drag=false});
}
function localMovement(dt){const m=match,a=m.local;if(!a)return;let x=(m.keys.d||m.keys.arrowright?1:0)-(m.keys.a||m.keys.arrowleft?1:0)+m.joy.x,z=(m.keys.s||m.keys.arrowdown?1:0)-(m.keys.w||m.keys.arrowup?1:0)+m.joy.y,l=Math.hypot(x,z);if(l>.08){x/=l;z/=l;const cos=Math.cos(m.yaw),sin=Math.sin(m.yaw),wx=x*cos-z*sin,wz=x*sin+z*cos;a.root.position.x=clamp(a.root.position.x+wx*7.2*dt,-42,42);a.root.position.z=clamp(a.root.position.z+wz*7.2*dt,-21,21);a.root.rotation.y=Math.atan2(wx,wz);setActorAnim(a,'run')}else setActorAnim(a,'idle')}
function sendLocalState(now){if(!channel||!match?.local||now-match.lastSend<100)return;match.lastSend=now;const a=match.local,p=a.root.position;channel.send({type:'broadcast',event:'state',payload:{id:playerId,x:+p.x.toFixed(2),z:+p.z.toFixed(2),r:+a.root.rotation.y.toFixed(3),anim:a.anim,seq:++match.seq,ts:Date.now()}})}
function handleRemoteState(p){if(!match||!p||p.id===playerId)return;const a=match.actors.get(p.id);if(!a||Number(p.seq)<=a.seq)return;a.seq=Number(p.seq);a.target.set(clamp(Number(p.x)||0,-42,42),0,clamp(Number(p.z)||0,-21,21));a.targetRotation=Number(p.r)||0;a.lastSeen=performance.now();setActorAnim(a,p.anim==='run'?'run':'idle')}
function attack(){if(!match?.local||!channel)return;const a=match.local;setActorAnim(a,'attack');showAttack(a.root.position,a.root.rotation.y,HEROES[a.meta.hero].color);channel.send({type:'broadcast',event:'attack',payload:{id:playerId,x:a.root.position.x,z:a.root.position.z,r:a.root.rotation.y,hero:a.meta.hero,ts:Date.now()}});addFeed(`${a.meta.name} 发起攻击`)}
function handleRemoteAttack(p){if(!match||!p||p.id===playerId)return;const a=match.actors.get(p.id);if(!a)return;setActorAnim(a,'attack');showAttack(a.root.position,Number(p.r)||0,HEROES[a.meta.hero].color);addFeed(`${a.meta.name} 发起攻击`)}
function showAttack(pos,rotation,color){if(!match)return;const arc=new THREE.Mesh(new THREE.TorusGeometry(1.5,.11,8,32,Math.PI*.9),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));arc.position.copy(pos).add(new THREE.Vector3(Math.sin(rotation)*1.25,1.05,Math.cos(rotation)*1.25));arc.rotation.set(Math.PI/2,0,-rotation-Math.PI*.45);match.scene.add(arc);match.attacks.push({mesh:arc,life:.35})}
function addFeed(text){const d=document.createElement('div');d.textContent=text;$('#eventFeed').prepend(d);setTimeout(()=>d.remove(),3500)}
function matchLoop(now){if(!match)return;const dt=Math.min(.05,(now-match.last)/1000);match.last=now;localMovement(dt);for(const a of match.actors.values()){a.mixer?.update(dt);if(a.id!==playerId){a.root.position.lerp(a.target,1-Math.pow(.0005,dt));if(Number.isFinite(a.targetRotation)){let diff=Math.atan2(Math.sin(a.targetRotation-a.root.rotation.y),Math.cos(a.targetRotation-a.root.rotation.y));a.root.rotation.y+=diff*Math.min(1,dt*12)}}}for(const fx of match.attacks){fx.life-=dt;fx.mesh.material.opacity=clamp(fx.life/.35,0,1);fx.mesh.scale.multiplyScalar(1+dt*2)}match.attacks=match.attacks.filter(fx=>{if(fx.life>0)return true;match.scene.remove(fx.mesh);return false});sendLocalState(now);const p=match.local?.root.position||new THREE.Vector3(),offset=new THREE.Vector3(Math.sin(match.yaw)*15,14,Math.cos(match.yaw)*15);match.camera.position.lerp(p.clone().add(offset),1-Math.pow(.0001,dt));match.camera.lookAt(p.x,p.y+1,p.z);match.renderer.render(match.scene,match.camera);requestAnimationFrame(matchLoop)}
addEventListener('resize',()=>{if(match){match.camera.aspect=innerWidth/innerHeight;match.camera.updateProjectionMatrix();match.renderer.setSize(innerWidth,innerHeight)}});
