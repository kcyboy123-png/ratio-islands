import{quality,fitTexture}from'./quality.js';
import{renderDue,QUALITY_KEY,canAnimate}from'./quality-policy.js';
import{createCompanionFollow}from'./companion-follow.js';
import{arrivalShot}from'./arrival-path.js';
import{createArrival}from'./arrival.js';
import{worldAction}from'./progress-actions.js';
import{groundNature,plantedMargins}from'./concept-polish.js';
import{dressWorld}from'./world-detail.js';
import * as T from 'three';
import {createCameraInput} from './camera-input.js';
import {taskDestination,routePoints,cameraClearance,restorationView,nextRoutePoint} from './navigation.js';
import{addHarborSky}from'./atmosphere.js';
import{loadHaruHero}from'./haru.js';
import{buildHarbor}from'./harbor.js';
import{mat,mesh,box,ball,rope,rounded,cloth,makeMoru,loadHarborSurfaces,loadHarborSculptures,loadArtisanProps}from'./art.js';
import{createExplorationInput}from'./reused/exploration-input.js';
import{parseSave,moveOnQuay,SAVE_KEY}from'./rules.js';
import{REGIONS,MISSIONS,unlockedRegion,canTravel,moveOnIsland}from'./campaign.js?v=104';
import{buildIsland,harborRestorations,createCrew,stationFurniture,STATIONS}from'./islands.js';
import{loadJourney,createJourneyUI}from'./journey-ui.js?v=104';
const $=s=>document.querySelector(s),canvas=$('#world'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const labelProjection=new T.Vector3();let debugNext=0;let frameId=0;function requestFrame(){if(!frameId)frameId=requestAnimationFrame(frame);}
let arrival;let ready=false,world,renderer,player,haruRig,elapsed=0,last=performance.now(),save=readSave(),audioContext,audioGain,soundOn=false,lastNear=false,toastUntil=0;
const journey=loadJourney(false);let voyageRegion=journey.region;let sunLight,ambientLight,skyControl,journeyUI,harborRoot,harborChanges,activeIsland,crew,nearTask=-1;const islands=new Map();
const scene=new T.Scene();scene.background=new T.Color('#a5cddd');scene.fog=new T.Fog('#b5ddec',65,185);
const camera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.1,240),moru=makeMoru();moru.root.scale.setScalar(.85);moru.root.position.set(1.15,0,6.15);moru.root.rotation.y=Math.PI;scene.add(moru.root);
const frameTimes=new Float64Array(300);let nextSample=0,sampleCount=0,metricFrames=0,uiNext=0,shadowNext=0,renderCount=0;const pos={x:0,z:6.8},desiredCamera=new T.Vector3(),desiredLook=new T.Vector3();let traveled=0,moruTraveled=0,revealUntil=0,revealView=null,moving=0,lookTarget=new T.Vector3(-1,1.4,7.8);
const companion=createCompanionFollow(pos);
const orbit=createCameraInput(canvas,()=>!ready||arrival?.active||Boolean(document.querySelector('dialog[open]')),()=>{revealUntil=0;});
let destination;const navGroup=new T.Group(),routeMaterial=new T.MeshBasicMaterial({color:'#ffd986',transparent:true,opacity:.8,depthWrite:false}),routeMarks=new T.InstancedMesh(new T.RingGeometry(.065,.115,12).rotateX(-Math.PI/2),routeMaterial,64),navMatrix=new T.Matrix4();routeMarks.frustumCulled=false;navGroup.add(routeMarks);
const beacon=new T.Group(),halo=new T.Mesh(new T.RingGeometry(.83,.90,64).rotateX(-Math.PI/2),routeMaterial);beacon.add(halo);
const lightCanvas=document.createElement('canvas');lightCanvas.width=32;lightCanvas.height=128;const lightCtx=lightCanvas.getContext('2d'),lightFade=lightCtx.createLinearGradient(0,128,0,0);lightFade.addColorStop(0,'rgba(255,203,92,.32)');lightFade.addColorStop(.6,'rgba(255,220,138,.10)');lightFade.addColorStop(1,'rgba(255,229,167,0)');lightCtx.fillStyle=lightFade;lightCtx.fillRect(0,0,32,128);lightCtx.globalCompositeOperation='destination-in';const sideFade=lightCtx.createLinearGradient(0,0,32,0);sideFade.addColorStop(0,'rgba(255,255,255,0)');sideFade.addColorStop(.5,'rgba(255,255,255,.65)');sideFade.addColorStop(1,'rgba(255,255,255,0)');lightCtx.fillStyle=sideFade;lightCtx.fillRect(0,0,32,128);const shaftMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(lightCanvas),transparent:true,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending});for(const angle of[0,Math.PI/2]){const shaft=new T.Mesh(new T.PlaneGeometry(.8,4.1),shaftMaterial);shaft.position.y=2;shaft.rotation.y=angle;beacon.add(shaft);}const diamond=new T.Mesh(new T.OctahedronGeometry(.15),new T.MeshBasicMaterial({color:'#ffe3a3'}));diamond.position.y=2.7;beacon.add(diamond);navGroup.add(beacon);
const input=createExplorationInput(()=>!ready||arrival?.active||Boolean(document.querySelector('dialog[open]')),interact,()=>$('#guide').showModal(),()=>orbit.reset());
function readSave(){try{return parseSave(localStorage.getItem(SAVE_KEY));}catch{return{completed:false};}}
function storeProgress(){save.completed=true;try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,completed:true}));}catch{showToast('깃발을 올렸어요. 이 브라우저에서는 진행을 저장할 수 없어요.',7000);}}
function showToast(text,ms=4500){$('#toast').textContent=text;$('#toast').style.opacity='1';toastUntil=performance.now()+Math.max(ms,Math.min(12000,text.length*95));}
async function init(){try{
 renderer=new T.WebGLRenderer({canvas,antialias:quality.antialias,alpha:false,powerPreference:'high-performance'});resizeWorld();renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=quality.mode!=='light';renderer.shadowMap.type=T.PCFSoftShadowMap;
 const sun=new T.DirectionalLight('#ffe9cf',3.7);sunLight=sun;sun.position.set(-13,20,9);sun.target.position.set(-1,0,1);sun.castShadow=true;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);Object.assign(sun.shadow.camera,{left:-24,right:24,top:28,bottom:-20,near:1,far:80});sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun,sun.target,ambientLight=new T.HemisphereLight('#c2e2f4','#9a896e',1.1));
 skyControl=addHarborSky(scene,renderer);await loadHarborSurfaces(renderer);await Promise.all([loadHarborSculptures(),loadArtisanProps()]);moru.refineHead();moru.refineClothes();
 const fill=new T.DirectionalLight('#c9e0e8',.58);fill.position.set(12,9,8);scene.add(fill);
 const prior=new Set(scene.children);world=await buildHarbor(scene,renderer,message=>$('#load-message').textContent=message);harborRoot=new T.Group();for(const child of [...scene.children])if(!prior.has(child))harborRoot.add(child);scene.add(harborRoot);harborChanges=harborRestorations(harborRoot);stationFurniture(harborRoot);await dressWorld(harborRoot,0);groundNature(harborRoot,0);plantedMargins(harborRoot,0);crew=await createCrew(scene);journeyUI=createJourneyUI(journey,{travel:travelTo,warp:index=>travelTo(index,false,true),complete:completeMission,reveal:revealRestoration,saveRegion:()=>voyageRegion,toast:showToast,guide:()=>$('#wayfinder').click()});restoreWorld();
 $('#load-message').textContent='하루와 모루가 출항을 준비하고 있어요';await loadHaru();scene.add(navGroup);
 if(journey.done.includes(0)){save.completed=true;world.raise(true);}if(journey.region>0)await travelTo(journey.region,true);
 arrival=createArrival({onStart(){input.reset();orbit.reset();},onCamera(){const shot=arrivalShot(0,pos);camera.position.fromArray(shot.eye);lookTarget.fromArray(shot.target);camera.lookAt(lookTarget);navGroup.visible=false;world.marker.visible=false;last=performance.now();renderer.render(scene,camera);},onFinish(){input.reset();last=performance.now();const {yaw,pitch,distance:r}=orbit.view;camera.position.set(pos.x+Math.sin(yaw)*Math.cos(pitch)*r,2.45+Math.sin(pitch)*r,pos.z+Math.cos(yaw)*Math.cos(pitch)*r);lookTarget.set(pos.x,2.45,pos.z);camera.lookAt(lookTarget);canvas.focus({preventScroll:true});}});
 camera.position.set(pos.x+.75,3.15,pos.z+5.7);lookTarget.set(pos.x-.15,1.95,pos.z-3.5);camera.lookAt(lookTarget);scene.updateMatrixWorld(true);renderer.compile(scene,camera);renderer.render(scene,camera);
 $('#loading').hidden=true;$('#hud').hidden=false;ready=true;canvas.focus({preventScroll:true});showToast(journey.region>0?REGIONS[journey.region].host+': '+REGIONS[journey.region].intro:journey.done.includes(0)?'다시 왔구나! 우리가 만든 깃발이 부두에서 기다려.':'모루: 저 주황 차양 아래가 내 공방이야. 같이 가자!',6500);arrival.show(journey.region);requestFrame();
}catch(error){console.error(error);$('#load-message').textContent='항구를 불러오지 못했어요. 새로고침해 주세요.';$('#loading small').textContent=error.message;}}
async function loadHaru(){
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const ctx=contactCanvas.getContext('2d'),shade=ctx.createRadialGradient(64,64,4,64,64,64);shade.addColorStop(0,'rgba(31,33,28,.34)');shade.addColorStop(.4,'rgba(31,33,28,.2)');shade.addColorStop(1,'rgba(31,33,28,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,128,128);
 scene.userData.actorContact=new T.MeshBasicMaterial({map:new T.CanvasTexture(contactCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 haruRig=await loadHaruHero(scene);player=haruRig.root;player.position.set(pos.x,0,pos.z);player.rotation.y=Math.PI;
 player.getObjectByName('tripo-contact-shadow').position.y=.035;const moruContact=new T.Mesh(new T.PlaneGeometry(.9,.65).rotateX(-Math.PI/2),scene.userData.actorContact);moruContact.position.y=.041;moru.root.add(moruContact);
 haruRig.pose(0,false,0,false,reduce,0,'look');
}

const restoreExit=$('#restore-exit');
function moveCompanion(p,x,z){return (journey.region===0?moveOnQuay:moveOnIsland)(p,x,z,journey.region);}
function routeCompanion(p,q){return routePoints(p,q,journey.region);}
function frame(now){frameId=0;if(!renderDue(now,last,quality.fps)){requestFrame();return;}const frameMs=now-last;const dt=Math.min(frameMs/1000,.05);last=now;if(frameMs>0&&frameMs<500){frameTimes[nextSample]=frameMs;nextSample=(nextSample+1)%frameTimes.length;if(sampleCount<frameTimes.length)sampleCount++;if(sampleCount===300&&++metricFrames%120===0){const sorted=[...frameTimes].sort((a,b)=>a-b);canvas.dataset.frameMetrics=JSON.stringify({samples:300,meanMs:Math.round(frameTimes.reduce((a,b)=>a+b,0)/300*100)/100,p95Ms:Math.round(sorted[284]*100)/100});}}elapsed+=dt;if(document.hidden||document.querySelector('dialog[open]'))return;
 const v=input.read(),direction=orbit.movement(v,dt,reduce),speed=3.1,dx=direction.x*speed*dt,dz=direction.z*speed*dt,next=(journey.region===0?moveOnQuay:moveOnIsland)(pos,dx,dz,journey.region);moving=Math.hypot(next.x-pos.x,next.z-pos.z);pos.x=next.x;pos.z=next.z;player.position.set(pos.x,0,pos.z);
 if(moving>.0001){const angle=Math.atan2(dx,dz);player.rotation.y+=Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y))*(1-Math.exp(-dt*13));}traveled+=moving;haruRig.pose(traveled,moving>.0001,elapsed,false,reduce,0,'look');
 const friend=companion.step(moru.root.position,pos,dt,moveCompanion,routeCompanion);
 const friendDX=friend.x-moru.root.position.x,friendDZ=friend.z-moru.root.position.z;
 moruTraveled+=friend.distance;moru.root.position.set(friend.x,0,friend.z);
 if(friend.walking){const a=Math.atan2(friendDX,friendDZ);moru.root.rotation.y+=Math.atan2(Math.sin(a-moru.root.rotation.y),Math.cos(a-moru.root.rotation.y))*(1-Math.exp(-dt*6));}
 moru.update(elapsed,!reduce&&friend.walking,moruTraveled,dt,reduce);
 if(now>=debugNext)canvas.dataset.companion=JSON.stringify({x:friend.x,z:friend.z,speed:friend.speed,walking:friend.walking,distance:moruTraveled});

 const focusHeight=journey.region===4?3.0:2.45;desiredLook.set(pos.x,focusHeight,pos.z);const {yaw,pitch,distance:radius}=orbit.view;desiredCamera.set(pos.x+Math.sin(yaw)*Math.cos(pitch)*radius,focusHeight+Math.sin(pitch)*radius,pos.z+Math.cos(yaw)*Math.cos(pitch)*radius);if(now<revealUntil&&revealView){if(moving>.0001)revealUntil=0;else{desiredCamera.fromArray(revealView.eye);desiredLook.fromArray(revealView.target);}}const hideRestore=!(now<revealUntil&&revealView);if(restoreExit.hidden!==hideRestore)restoreExit.hidden=hideRestore;const shot=arrival?.tick(Math.max(0,frameMs/1000),pos);if(shot){desiredCamera.fromArray(shot.eye);desiredLook.fromArray(shot.target);}const safeEye=cameraClearance(desiredLook,desiredCamera,journey.region);desiredCamera.set(safeEye.x,safeEye.y,safeEye.z);camera.position.lerp(desiredCamera,1-Math.exp(-dt*9));lookTarget.lerp(desiredLook,1-Math.exp(-dt*9));camera.lookAt(lookTarget);
 if(now>=debugNext){canvas.dataset.quality=quality.mode;canvas.dataset.pixelRatio=String(renderer.getPixelRatio());canvas.dataset.camera=JSON.stringify({yaw:Math.round(yaw*1000)/1000,pitch:Math.round(pitch*1000)/1000,distance:Math.round(radius*100)/100});}
 if(now>=uiNext){uiNext=now+120;
 let closest=-1;for(let i=0;i<3;i++){const id=journey.region*3+i,p=STATIONS[i];if(id<=journey.done.length&&Math.hypot(pos.x-p.x,pos.z-p.z)<2.4)closest=id;}nearTask=closest;const near=closest>=0;lastNear=near;const action=worldAction(journey,closest);$('#interact').disabled=action.kind==='walk';if($('#interact').dataset.action!==action.label){$('#interact').dataset.action=action.label;$('#interact').innerHTML=action.label+'<span>E</span>';}$('#near-label').style.opacity=near?'1':'0';$('#near-label').textContent=near?MISSIONS[closest].title:'';destination=journey.region>unlockedRegion(journey)?null:taskDestination(journey.region,journey.done,STATIONS);const station=destination??STATIONS[(near?closest:journey.region*3+2)%3];world.marker.visible=!!destination&&!arrival?.active;world.marker.position.set(station.x,.09,station.z);updateGuidance(now,dt);
 if(near){const labelStation=STATIONS[closest%3];const proj=labelProjection.set(labelStation.x,1.74,labelStation.z).project(camera);if(proj.z>1)$('#near-label').style.opacity='0';$('#near-label').style.left=((proj.x+1)/2*innerWidth)+'px';$('#near-label').style.top=((-proj.y+1)/2*innerHeight)+'px';}if(now>toastUntil)$('#toast').style.opacity='0';
 }
 crew.update(pos,elapsed,journey.done,reduce);
 if(journey.region===0)world.tick(elapsed,dt,reduce);else activeIsland?.tick(elapsed,dt,reduce);if(quality.mode==='light'&&now>=shadowNext){renderer.shadowMap.needsUpdate=true;shadowNext=now+100;}renderer.render(scene,camera);renderCount++;if(now>=debugNext){debugNext=now+250;canvas.dataset.renderCount=String(renderCount);canvas.dataset.memory=JSON.stringify(renderer.info.memory);canvas.dataset.islandCache=String(islands.size);canvas.dataset.region=String(journey.region);canvas.dataset.missions=JSON.stringify(journey.done);canvas.dataset.nearTask=String(nearTask);canvas.dataset.position=JSON.stringify(pos);canvas.dataset.completed=String(save.completed);canvas.dataset.flagVisible=String(world.flagRoot.visible);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);}requestFrame();}
function interact(){if(!ready||arrival?.active||document.querySelector('dialog[open]'))return;input.reset();const action=worldAction(journey,nearTask);if(action.kind==='journal')journeyUI.showJournal(true);else if(action.kind==='map')journeyUI.showMap();else if(action.kind==='task')journeyUI.open(action.id);}
function restoreWorld(){save.completed=journey.done.includes(0);if(world)world.flagRoot.visible=save.completed;harborChanges?.restore(journey.done);for(const region of islands.values())region.restore(journey.done);journeyUI?.refresh();}
function completeMission(id,first){if(id===0){world.raise(!first);storeProgress();}restoreWorld();if(first)tone(660,.25);}
function revealRestoration(id){if(Math.floor(id/3)!==journey.region)return;revealView=restorationView(id);if(!revealView)return;input.reset();revealUntil=Infinity;if(reduce){camera.position.fromArray(revealView.eye);lookTarget.fromArray(revealView.target);}showToast('우리가 남긴 변화예요. 천천히 보고, 걷거나 돌아가기 버튼을 눌러요.',6500);}
async function travelTo(index,initial=false,warp=false){if(!canTravel(journey,index)||(!ready&&!initial))return false;if(index===journey.region&&index===voyageRegion&&!initial&&!warp){canvas.focus({preventScroll:true});return true;}document.querySelector('#arrival-replay').hidden=index>1;const previous=journey.region;ready=false;input.reset();$('#sailing').hidden=false;$('#sailing-title').textContent=REGIONS[index].name+'으로';try{
 if(index>0&&!islands.has(index)){const built=await buildIsland(index);built.root.visible=false;scene.add(built.root);islands.set(index,built);}
 harborRoot.visible=index===0;for(const[i,island]of islands)island.root.visible=i===index;
 for(const [i,island]of [...islands])if(i!==index&&i!==previous){island.root.removeFromParent();const kept=new Set();scene.traverse(o=>{if(o.geometry)kept.add(o.geometry);});const dropped=new Set();island.root.traverse(o=>{if(o.geometry&&!kept.has(o.geometry))dropped.add(o.geometry);});for(const g of dropped)g.dispose();islands.delete(i);}
activeIsland=islands.get(index);journey.region=index;skyControl.setRegion(index);sunLight.color.set(index===4?'#ffd09b':'#ffe5bd');sunLight.intensity=index===4?2.8:index===0?3.7:3.3;sunLight.position.set(index===4?-18:-13,index===4?12:20,9);ambientLight.intensity=index===0?1.1:1.05;ambientLight.color.set(index===4?'#c4bdcc':'#c2e2f4');ambientLight.groundColor.set(index===4?'#aa8362':'#9a896e');scene.fog.color.set(index===4?'#dbbdab':'#b5ddec');camera.fov=index===4?62:52;camera.updateProjectionMatrix();
 // The interaction marker belongs to the active island, while its material stays shared.
 (index===0?harborRoot:activeIsland.root).add(world.marker);pos.x=0;pos.z=6.8;player?.position.set(0,0,6.8);if(player)player.rotation.y=Math.PI;moru.root.position.set(1.15,0,6.15);moru.root.rotation.y=Math.PI;companion.reset(pos);moruTraveled=0;camera.position.set(.75,3.15,12.5);lookTarget.set(-.15,1.95,3.3);revealUntil=0;restoreWorld();if(!warp){voyageRegion=index;journeyUI.persist();}orbit.reset();$('#game').setAttribute('aria-label',REGIONS[index].name+' 탐험');canvas.setAttribute('aria-label',REGIONS[index].name+' 3D 탐험. 드래그로 시점을 돌리고 방향키나 WASD로 걸어요. '+(index>unlockedRegion(journey)?'섬 구경 버튼으로 다른 지역을 둘러보세요.':'금빛 길을 따라 미션 표식 가까이에서 E를 눌러요.'));showToast(index>unlockedRegion(journey)?'섬 구경 도착! 자유롭게 둘러보세요. 미션은 앞 섬의 이야기를 마치면 열려요.':REGIONS[index].host+': '+REGIONS[index].intro,7000);
 return true;
 }catch(e){console.error(e);journey.region=previous;harborRoot.visible=previous===0;for(const[i,island]of islands)island.root.visible=i===previous;activeIsland=islands.get(previous);showToast('섬을 불러오지 못했어요. 현재 섬에서 지도 버튼을 눌러 다시 시도해 주세요.',7000);return false;}finally{$('#sailing').hidden=true;if(!initial)ready=true;canvas.focus({preventScroll:true});if(!initial&&!warp&&journey.region===index)arrival?.show(index);if(!initial)resumeLoop();}}
$('#restore-exit').addEventListener('click',()=>{revealUntil=0;canvas.focus({preventScroll:true});});
addEventListener('keydown',e=>{if(e.code==='Escape'&&!document.querySelector('dialog[open]'))revealUntil=0;});
$('#camera-reset').addEventListener('click',()=>orbit.reset());$('#wayfinder').addEventListener('click',()=>{destination=journey.region>unlockedRegion(journey)?null:taskDestination(journey.region,journey.done,STATIONS);if(destination){if(Math.hypot(pos.x-destination.x,pos.z-destination.z)<2.4){journeyUI.open(destination.id);return;}orbit.face(nextRoutePoint(pos,routePoints(pos,destination,journey.region),destination),pos);showToast('금빛 바닥 표시를 따라가면 '+MISSIONS[destination.id].title+' 장소에 닿아요.',3500);}else journeyUI.showMap(journey.region>unlockedRegion(journey));});
$('#interact').addEventListener('click',interact);$('#help').addEventListener('click',()=>{input.reset();$('#guide').showModal();});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{input.reset();canvas.focus({preventScroll:true});}));
$('#sound').addEventListener('click',async()=>{if(!audioContext){audioContext=new AudioContext();audioGain=audioContext.createGain();audioGain.gain.value=0;audioGain.connect(audioContext.destination);const buffer=audioContext.createBuffer(1,audioContext.sampleRate*4,audioContext.sampleRate),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.2;const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=550;source.connect(filter).connect(audioGain);source.start();}await audioContext.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn?.14:0,audioContext.currentTime,.3);$('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound small').textContent=soundOn?'켜짐':'꺼짐';$('#sound').setAttribute('aria-label',soundOn?'소리 끄기':'소리 켜기');$('#sound svg').innerHTML=soundOn?'<path d="M11 4 6 8H3v8h3l5 4ZM16 7c3 3 3 7 0 10m3-13c5 5 5 11 0 16"/>':'<path d="M11 4 6 8H3v8h3l5 4ZM16 9l5 6m0-6-5 6"/>';});
function tone(hz,seconds){if(!soundOn||!audioContext)return;const o=audioContext.createOscillator(),g=audioContext.createGain();o.frequency.value=hz;o.type='sine';g.gain.setValueAtTime(.025,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+seconds);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+seconds);}
const resumeLoop=()=>{if(!canAnimate(ready,document.hidden,Boolean(document.querySelector('dialog[open]')))){if(frameId)cancelAnimationFrame(frameId);frameId=0;}else if(ready){last=performance.now();requestFrame();}};
new MutationObserver(resumeLoop).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
document.addEventListener('visibilitychange',()=>{input.reset();last=performance.now();resumeLoop();if(audioContext)document.hidden?audioContext.suspend():soundOn&&audioContext.resume();});
let resizeTicket=0;
function resizeWorld(){
 const pixelBudget=quality.mode==='light'?1100000:5500000;
 const ratio=Math.min(devicePixelRatio,quality.pixelRatio,Math.sqrt(pixelBudget/(innerWidth*innerHeight)));
 renderer.setDrawingBufferSize(innerWidth,innerHeight,ratio);
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
}
addEventListener('resize',()=>{if(!renderer||resizeTicket)return;resizeTicket=requestAnimationFrame(()=>{resizeTicket=0;resizeWorld();});});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;input.reset();const stored=journeyUI?.persist();$('#recovery-save').textContent=stored?'항해 기록을 저장했어요. 쓰던 문제도 다시 이어갈 수 있어요.':'기록을 저장하지 못했어요. 다시 열면 마지막 저장 이후 풀이가 사라질 수 있어요.';$('#graphics-recovery').showModal();});
$('#quality-change').addEventListener('click',()=>{journeyUI?.persist();location.reload();});
$('#reload-light').addEventListener('click',()=>{try{localStorage.setItem(QUALITY_KEY,'light');}catch{}location.reload();});
$('#reload-game').addEventListener('click',()=>location.reload());
// Expose only read-only scene diagnostics for this local build's verification.
window.harborState=()=>({ready,position:{...pos},near:lastNear,completed:save.completed,flagVisible:world?.flagRoot.visible,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,region:journey.region,missions:[...journey.done]});
document.querySelector('#arrival-replay').onclick=()=>{document.querySelector('#guide').close();arrival?.show(journey.region,true);};
init();








let routeCache=null;const guidancePoint=new T.Vector3();
function updateGuidance(now,dt){
 beacon.visible=!!destination;routeMarks.visible=!!destination;navGroup.visible=ready&&!arrival?.active;const button=$('#wayfinder');button.setAttribute('aria-label',journey.region>unlockedRegion(journey)?'다른 섬 구경하기':'다음 미션 방향 보기');
 if(!destination){canvas.dataset.destination='';if(journey.region>unlockedRegion(journey)){$('#destination-name').textContent='섬 구경 중';$('#destination-distance').textContent='눌러 다른 섬 선택 · 미션 진행도 유지';$('#destination-arrow').textContent='◇';$('#destination-arrow').style.transform='none';$('#mission-label').hidden=true;$('#interact').textContent='둘러보는 중';return;}$('#destination-name').textContent=journey.done.length===15?'모든 항로 복원 완료':'이 섬 복원 완료';$('#destination-distance').textContent=journey.done.length===15?'항해 지도에서 다시 방문해요':'항해 지도를 열어 다음 섬으로';$('#destination-arrow').textContent='✓';$('#destination-arrow').style.transform='rotate(0rad)';$('#mission-label').hidden=true;return;}
 if(!routeCache||routeCache.region!==journey.region||routeCache.id!==destination.id||Math.hypot(pos.x-routeCache.x,pos.z-routeCache.z)>.45){routeCache={region:journey.region,id:destination.id,x:pos.x,z:pos.z,points:routePoints(pos,destination,journey.region)};
 const points=routeCache.points;let total=0,n=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);total+=length;for(let d=.65;d<length&&n<64;d+=.65){const t=d/length;navMatrix.makeTranslation(a.x+(b.x-a.x)*t,.11,a.z+(b.z-a.z)*t);routeMarks.setMatrixAt(n++,navMatrix);}}routeMarks.count=n;routeMarks.instanceMatrix.needsUpdate=true;routeCache.total=points.length<2?null:total;}
 const {points,total}=routeCache;beacon.position.set(destination.x,.12,destination.z);diamond.rotation.y=reduce?0:now*.001;diamond.position.y=2.7+(reduce?0:Math.sin(now*.003)*.10);
 if(nearTask===destination.id)$('#near-label').textContent='이 미션 시작 · E';
 $('#destination-name').textContent=MISSIONS[destination.id].title;$('#destination-distance').textContent=Math.hypot(pos.x-destination.x,pos.z-destination.z)<2.4?'도착! 여기를 눌러 시작 · E':total===null?'넓은 돌길로 나온 뒤 길 안내를 눌러요':'금빛 길 따라 '+Math.ceil(total)+'m · 누르면 시점이 길을 향해요';
 const nextWaypoint=nextRoutePoint(pos,points,destination);const bearing=Math.atan2(nextWaypoint.x-pos.x,-(nextWaypoint.z-pos.z));const arrived=Math.hypot(pos.x-destination.x,pos.z-destination.z)<2.4;button.setAttribute('aria-label',arrived?'도착한 미션 시작':'다음 미션 방향 보기');$('#destination-arrow').textContent=arrived?'✓':'↑';$('#destination-arrow').style.transform=arrived?'none':'rotate('+(bearing+orbit.view.yaw)+'rad)';
 const point=guidancePoint.set(destination.x,3.2,destination.z).project(camera),visible=point.z>-1&&point.z<1&&Math.abs(point.x)<.85&&point.y<.58&&point.y>-.48;const label=$('#mission-label');label.hidden=!visible;if(visible){label.textContent=MISSIONS[destination.id].title;label.style.left=((point.x+1)/2*innerWidth)+'px';label.style.top=((1-point.y)/2*innerHeight)+'px';}canvas.dataset.destination=String(destination.id);
}
