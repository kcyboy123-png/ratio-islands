import{QUALITY_KEY,recommendedQuality}from'./quality-policy.js';
const gate=document.querySelector('#quality-gate'),note=document.querySelector('#quality-note');
const recommended=recommendedQuality({coarse:matchMedia('(pointer:coarse)').matches,touch:navigator.maxTouchPoints,memory:navigator.deviceMemory??8,cores:navigator.hardwareConcurrency??8,width:innerWidth});
let saved;try{saved=localStorage.getItem(QUALITY_KEY);}catch{}
const chosen=['light','high'].includes(saved)?saved:recommended;
gate.querySelector('[value="'+chosen+'"]').checked=true;
note.textContent=recommended==='light'?'휴대폰·태블릿은 ‘가볍게’를 추천해요.':'끊김이 느껴지면 ‘가볍게’를 골라요.';
gate.hidden=false;document.querySelector('#loading').hidden=true;
const video=document.querySelector('#entry-background');
const motionButton=document.querySelector('#entry-motion');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled=true;
function releaseBackground(){
 video.pause();
 video.removeAttribute('src');
 video.load();
 gate.classList.remove('entry-playing');
 motionButton.hidden=true;
}
function startBackground(){
 if(document.hidden||gate.hidden||reducedMotion.matches||!motionEnabled)return;
 if(!video.hasAttribute('src'))video.src='./assets/cinematics/entrance-loop-mobile.mp4';
 video.muted=true;
 video.play().catch(()=>{});
}
video.addEventListener('playing',()=>{
 if(gate.hidden)return;
 gate.classList.add('entry-playing');
 motionButton.hidden=false;
 motionButton.textContent='배경 영상 멈추기';
});
video.addEventListener('error',()=>{gate.classList.remove('entry-playing');motionButton.hidden=true;});
motionButton.onclick=()=>{
 motionEnabled=!motionEnabled;
 if(motionEnabled)startBackground();
 else{video.pause();motionButton.textContent='배경 영상 다시 재생';}
};
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)releaseBackground();else startBackground();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else startBackground();});
startBackground();
document.querySelector('#quality-enter').onclick=async()=>{
 const mode=gate.querySelector('input:checked').value;
 document.documentElement.dataset.quality=mode;
 try{localStorage.setItem(QUALITY_KEY,mode);}catch{}
 gate.hidden=true;releaseBackground();document.querySelector('#loading').hidden=false;
 try{await import('./main.js?v=105');}catch(e){document.querySelector('#load-message').textContent='불러오지 못했어요. 새로고침해 주세요.';document.querySelector('#loading small').textContent='인터넷 연결을 확인해 주세요.';console.error(e);}
};

document.querySelector('#loading-quality').onclick=()=>location.reload();
