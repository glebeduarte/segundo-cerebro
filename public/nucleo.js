(function start(){
if(!window.THREE){return setTimeout(start,100)}

const AREAS=[
 {id:'hoje',nome:'Hoje',sub:'5 tarefas',n:'5',ic:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',face:'sun',msg:'5 tarefas hoje. A primeira é a proposta do aluguel.'},
 {id:'entrada',nome:'Caixa de entrada',sub:'sem classificar',n:'7',ic:'<path d="M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z"/>',face:'inbox',msg:'7 capturas esperando classificação desde quinta.'},
 {id:'projetos',nome:'Projetos',sub:'11 ativos',n:'11',ic:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 4v16M16 4v10"/>',face:'grid',msg:'11 projetos ativos em 5 áreas da vida.'},
 {id:'parados',nome:'Parados',sub:'há mais de 14 dias',n:'4',warn:1,ic:'<circle cx="12" cy="12" r="8"/><path d="M9 9v6M15 9v6"/>',face:'pause',msg:'4 parados. O RPG com os filhos está há 76 dias sem movimento.'},
 {id:'reunioes',nome:'Reuniões',sub:'Granola',n:'3',ic:'<path d="M4 6h16v10H8l-4 4z"/>',face:'chat',msg:'Jácome, 28/10: 5 próximos passos, 2 são seus.'},
 {id:'ideias',nome:'Ideias',sub:'para destilar',n:'12',ic:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11z"/>',face:'idea',msg:'12 ideias guardadas. 3 ligadas ao Spellfire.'},
 {id:'livros',nome:'Livros',sub:'em leitura',n:'2',ic:'<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/>',face:'book',msg:'2 livros abertos. Um parado na metade.'},
 {id:'foco',nome:'Foco',sub:'esta semana',n:'30 h',ic:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',face:'target',msg:'30 horas em projetos nesta semana, 14 com clientes.'}
];
const DATA=window.__AREAS__||{};AREAS.forEach(a=>{if(DATA[a.id])Object.assign(a,DATA[a.id])});
const chipsEl=document.getElementById('chips'), stage=document.getElementById('stage'), linksEl=document.getElementById('links'), toast=document.getElementById('toast');
AREAS.forEach(a=>{chipsEl.insertAdjacentHTML('beforeend',`<div class="chip${a.warn?' warn':''}" data-id="${a.id}" tabindex="0"><span class="ic"><svg viewBox="0 0 24 24">${a.ic}</svg></span><span><b>${a.nome}</b><small>${a.sub}</small></span><span class="n num">${a.n}</span></div>`)});
const chips=[...document.querySelectorAll('.chip')];
const isMobile=()=>innerWidth<=900;

/* ---------- three.js orb ---------- */
const canvas=document.getElementById('orb');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(32,1,0.1,100);
camera.position.set(0,0,9);
scene.add(new THREE.HemisphereLight(0xffffff,0x9a9a94,0.9));
const key=new THREE.DirectionalLight(0xffffff,0.9); key.position.set(-4,5,6); scene.add(key);
const rim=new THREE.DirectionalLight(0xbfe6e1,0.5); rim.position.set(5,-2,-3); scene.add(rim);

const orb=new THREE.Group(); scene.add(orb);
const shellMat=new THREE.MeshStandardMaterial({color:0xf4f4f1,roughness:.55,metalness:.05});
const darkMat=new THREE.MeshStandardMaterial({color:0x1a1b1a,roughness:.35,metalness:.3});
const accMat=new THREE.MeshStandardMaterial({color:0x13897e,roughness:.4,emissive:0x0b4d47,emissiveIntensity:.4});
const body=new THREE.Mesh(new THREE.SphereGeometry(1.5,72,72),shellMat); orb.add(body);
// seams between panels
[[0,0],[Math.PI/2,0],[Math.PI/2,Math.PI/3],[Math.PI/2,-Math.PI/3]].forEach(([rx,ry])=>{
  const s=new THREE.Mesh(new THREE.TorusGeometry(1.503,.012,6,140),darkMat); s.rotation.set(rx,ry,0); orb.add(s);
});
// face bezel: a dark plate a little proud of the shell
const bezel=new THREE.Mesh(new THREE.CylinderGeometry(1.12,1.18,.16,72),darkMat);
bezel.rotation.x=Math.PI/2; bezel.position.z=1.44; orb.add(bezel);
const lip=new THREE.Mesh(new THREE.TorusGeometry(1.14,.035,12,90),shellMat); lip.position.z=1.52; orb.add(lip);
// orbit rings: open at the front so they never cross the face
const rings=[];
[[1.72,.018,.35],[1.84,.01,-.3]].forEach(([r,t,tilt])=>{
  const g=new THREE.TorusGeometry(r,t,10,140,Math.PI*2-1.9); g.rotateZ(Math.PI/2+0.95);
  const ring=new THREE.Mesh(g,shellMat); ring.rotation.x=Math.PI/2;
  const holder=new THREE.Group(); holder.rotation.z=tilt; holder.add(ring); orb.add(holder); rings.push(holder);
});
const accRing=new THREE.Mesh(new THREE.TorusGeometry(1.23,.025,8,90,Math.PI*.5),accMat);
accRing.position.z=1.53; accRing.rotation.z=2.2; orb.add(accRing);
// bolts on the shell
for(let i=0;i<8;i++){
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.06,12),i%3===0?accMat:darkMat);
  const th=Math.PI/2+(i-3.5)*0.42, ph=i%2?0.55:2.6;
  b.position.setFromSphericalCoords(1.5,ph,th); b.lookAt(0,0,0); b.rotateX(Math.PI/2); orb.add(b);
}
// face screen (canvas texture)
const fc=document.createElement('canvas'); fc.width=fc.height=256;
const fx=fc.getContext('2d'); const faceTex=new THREE.CanvasTexture(fc);
const face=new THREE.Mesh(new THREE.CircleGeometry(1.08,64),new THREE.MeshBasicMaterial({map:faceTex,transparent:true}));
face.position.z=1.53; orb.add(face);

// shadow
const sh=new THREE.Mesh(new THREE.CircleGeometry(1.3,48),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.08}));
sh.rotation.x=-Math.PI/2; sh.position.y=-1.95; sh.scale.set(1,.35,1); scene.add(sh);

/* pixel faces */
const G=16, P=256/G;
const ICONS={
 sun:["....","..x....x....x..","...x...x...x...","....x.....x....","......xxx......",".....xxxxx.....","..xx.xxxxx.xx..",".....xxxxx.....","......xxx......","....x.....x....","...x...x...x...","..x....x....x.."],
 pause:["","","","....xx....xx....","....xx....xx....","....xx....xx....","....xx....xx....","....xx....xx....","....xx....xx....","....xx....xx....","....xx....xx...."],
};
function drawIcon(name){
  const svgPaths={
    inbox:[[3,9,10,1],[3,9,1,4],[12,9,1,4],[3,12,10,1],[5,5,6,1],[4,6,1,3],[11,6,1,3]],
    grid:[[3,3,4,4],[9,3,4,4],[3,9,4,4],[9,9,4,4]],
    chat:[[3,4,10,1],[3,4,1,6],[12,4,1,6],[3,9,10,1],[4,10,1,2],[5,11,1,1]],
    idea:[[6,3,4,1],[5,4,1,4],[10,4,1,4],[6,8,1,2],[9,8,1,2],[6,11,4,1],[7,12,2,1]],
    book:[[3,4,4,1],[9,4,4,1],[3,4,1,8],[12,4,1,8],[7,5,2,7],[3,11,4,1],[9,11,4,1]],
    target:[[5,3,6,1],[5,12,6,1],[3,5,1,6],[12,5,1,6],[4,4,1,1],[11,4,1,1],[4,11,1,1],[11,11,1,1],[7,7,2,2]],
    sun:[[6,6,4,4],[7,2,2,2],[7,12,2,2],[2,7,2,2],[12,7,2,2],[4,4,1,1],[11,4,1,1],[4,11,1,1],[11,11,1,1]],
    pause:[[5,4,2,8],[9,4,2,8]],
  }[name]||[];
  svgPaths.forEach(([x,y,w,h])=>{for(let i=0;i<w;i++)for(let j=0;j<h;j++)px(x+i,y+j,1)});
}
function px(x,y,a){fx.fillStyle=`rgba(232,255,251,${a})`;fx.fillRect(x*P+2,y*P+2,P-4,P-4)}
let look={x:0,y:0}, blink=0, mode='eyes', iconName=null, listening=0, t0=performance.now();
function drawFace(t){
  fx.clearRect(0,0,256,256);
  fx.fillStyle='#0d0e0d'; fx.beginPath(); fx.arc(128,128,128,0,Math.PI*2); fx.fill();
  // faint grid
  for(let x=0;x<G;x++)for(let y=0;y<G;y++){const dx=x-7.5,dy=y-7.5; if(dx*dx+dy*dy<52){fx.fillStyle='rgba(255,255,255,.035)';fx.fillRect(x*P+2,y*P+2,P-4,P-4)}}
  if(mode==='icon'){drawIcon(iconName);faceTex.needsUpdate=true;return}
  const ox=Math.round(look.x*1.6), oy=Math.round(look.y*1.2);
  const fal=listening||window.__falando;
  const h=blink>0?1:(fal?2+Math.round((Math.sin(t/120)+1)):4);
  [[4,6],[9,6]].forEach(([ex,ey])=>{
    const top=ey+Math.floor((4-h)/2);
    for(let i=0;i<3;i++)for(let j=0;j<h;j++)px(ex+ox+i,top+oy+j,(i===1&&j===1&&h>2)?.55:1);
  });
  // mouth
  if(fal){for(let i=0;i<4;i++){const hh=1+Math.round(Math.abs(Math.sin(t/90+i))*1.5);for(let j=0;j<hh;j++)px(6+i+ox,12-j+oy,.8)}}
  else{[[6,12],[7,13],[8,13],[9,12]].forEach(([x,y])=>px(x+ox,y+oy,.7))}
  faceTex.needsUpdate=true;
}

/* sizing + layout */
let W,H,orbScreen={x:0,y:0,r:0};
function layout(){
  const r=canvas.getBoundingClientRect(); W=r.width;H=r.height;
  renderer.setSize(W,H,false); camera.aspect=W/H; camera.updateProjectionMatrix();
  const mob=isMobile();
  orb.position.set(mob?0:.2,0,0);
  sh.position.x=orb.position.x;
  const s=mob?.9:.78; orb.scale.setScalar(s);
  camera.updateMatrixWorld();
  const v=orb.position.clone().project(camera);
  orbScreen.x=(v.x+1)/2*W; orbScreen.y=(1-v.y)/2*H;
  const edge=new THREE.Vector3(orb.position.x+1.6*s,orb.position.y,0).project(camera);
  orbScreen.r=((edge.x+1)/2*W)-orbScreen.x;
  if(mob){linksEl.innerHTML='';return}
  // chips on an arc to the right
  linksEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  let paths='';
  const R=orbScreen.r*1.6, n=chips.length;
  chips.forEach((c,i)=>{
    const ang=-1.0+i*(2.0/(n-1));
    const cy=orbScreen.y+(i-(n-1)/2)*Math.min(84,(H-120)/n); const k=(cy-orbScreen.y)/(R*1.15); const cx=orbScreen.x+Math.sqrt(Math.max(0,1-k*k))*R*1.3+20;
    c.style.left=Math.min(cx,W-200)+'px'; c.style.top=(cy-24)+'px';
    const sx=orbScreen.x+Math.cos(ang)*orbScreen.r*1.02, sy=orbScreen.y+Math.sin(ang)*orbScreen.r*1.02;
    const ex=Math.min(cx,W-200)-2, ey=cy;
    paths+=`<path data-id="${c.dataset.id}" d="M${sx},${sy} C${sx+60},${sy} ${ex-60},${ey} ${ex},${ey}"/><circle data-id="${c.dataset.id}" cx="${ex}" cy="${ey}" r="2.5"/>`;
  });
  linksEl.innerHTML=paths;
}
addEventListener('resize',layout);

/* interaction */
let target={x:0,y:0}, hot=null, hotTimer;
addEventListener('pointermove',e=>{
  const r=canvas.getBoundingClientRect();
  target.x=Math.max(-1,Math.min(1,(e.clientX-r.left-orbScreen.x)/(W/2)));
  target.y=Math.max(-1,Math.min(1,(e.clientY-r.top-orbScreen.y)/(H/2)));
});
function setHot(id){
  hot=id; const a=AREAS.find(x=>x.id===id);
  chips.forEach(c=>c.classList.toggle('hot',c.dataset.id===id));
  linksEl.querySelectorAll('[data-id]').forEach(p=>p.classList.toggle('hot',p.dataset.id===id));
  if(a){mode='icon';iconName=a.face;toast.innerHTML=`<b>${a.nome}</b><small>${a.msg}</small>`;toast.classList.add('in');
    const c=chips.find(c=>c.dataset.id===id), cr=c.getBoundingClientRect(), sr=canvas.getBoundingClientRect();
    target.x=Math.max(-1,Math.min(1,(cr.left-sr.left-orbScreen.x)/(W/2))); target.y=Math.max(-1,Math.min(1,(cr.top-sr.top-orbScreen.y)/(H/2)));
  } else {mode='eyes';toast.classList.remove('in')}
}
chips.forEach(c=>{
  c.addEventListener('mouseenter',()=>{clearTimeout(hotTimer);setHot(c.dataset.id)});
  c.addEventListener('focus',()=>setHot(c.dataset.id));
  c.addEventListener('mouseleave',()=>{hotTimer=setTimeout(()=>setHot(null),250)});
  c.addEventListener('click',()=>{setHot(c.dataset.id);clearTimeout(hotTimer);hotTimer=setTimeout(()=>setHot(null),3500);irPara(c.dataset.id)});
  c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();irPara(c.dataset.id)}});
});
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALVO={hoje:'h-hoje',entrada:'h-entrada',projetos:'h-mov',parados:'h-mov',reunioes:'h-reu',ideias:'h-ideias',livros:'h-ideias'};
function irPara(id){
  const h=document.getElementById(ALVO[id]); if(!h)return;
  const panel=h.closest('.panel')||h;
  panel.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  if(id==='parados')panel.classList.add('so-parados');else panel.classList.remove('so-parados');
  panel.classList.remove('flash');void panel.offsetWidth;panel.classList.add('flash');
  setTimeout(()=>{panel.setAttribute('tabindex','-1');panel.focus({preventScroll:true})},500);
}
const mic=document.getElementById('mic'), q=document.getElementById('q');
function listen(){
  listening=!listening; mic.classList.toggle('on',!!listening); setHot(null);
  if(listening){toast.innerHTML='<b>Ouvindo…</b><small>Pergunte o que precisa fazer hoje.</small>';toast.classList.add('in');
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SR){const r=new SR();r.lang='pt-BR';r.onresult=e=>{q.value=e.results[0][0].transcript;if(listening)listen();q.form.requestSubmit()};r.onend=()=>{if(listening)listen()};r.start()}
    else setTimeout(()=>{if(listening)listen()},3500);
  } else {toast.classList.remove('in')}
}
mic.addEventListener('click',listen); canvas.addEventListener('click',listen);

/* loop */
let spinY=0, nextBlink=performance.now()+2500;
function tick(t){
  look.x+=(target.x-look.x)*.08; look.y+=(target.y-look.y)*.08;
  if(t>nextBlink){blink=6;nextBlink=t+2500+Math.random()*3000}
  if(blink>0)blink--;
  const bob=reduce?0:Math.sin(t/900)*.08;
  orb.position.y=bob;
  sh.scale.set(1-bob*.6,.35,1); sh.material.opacity=.08-bob*.15;
  const tx=look.x*.55, ty=look.y*.35;
  orb.rotation.y+=((tx)-orb.rotation.y)*.06;
  orb.rotation.x+=((ty)-orb.rotation.x)*.06;
  if(!reduce){accRing.rotation.z=2.2+Math.sin(t/1400)*.4; rings[0].rotation.y=Math.sin(t/2200)*.25; rings[1].rotation.y=-Math.sin(t/2600)*.25}
  drawFace(t);
  renderer.render(scene,camera);
  requestAnimationFrame(tick);
}
document.fonts.ready.then(()=>{layout();requestAnimationFrame(tick)});

})();
/* ---------- som e circuitos ---------- */
(function extras(){
  if(!document.getElementById('stage')){return}
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* som: sintetizado, sem arquivos */
  let ctx=null, mudo=false; try{mudo=localStorage.getItem('sc-mudo')==='1'}catch(e){}
  const ac=()=>ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
  function bip(tipo){
    if(mudo)return; let a; try{a=ac()}catch(e){return}
    if(a.state==='suspended')a.resume();
    const t=a.currentTime, o=a.createOscillator(), g=a.createGain(), f=a.createBiquadFilter();
    f.type='lowpass'; f.frequency.value=2400;
    const [f1,f2,dur]=tipo==='ir'?[520,1040,.16]:tipo==='mic'?[660,440,.2]:[880,1320,.07];
    o.type='sine'; o.frequency.setValueAtTime(f1,t); o.frequency.exponentialRampToValueAtTime(f2,t+dur*.7);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(tipo==='olhar'?.035:.06,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(f).connect(g).connect(a.destination); o.start(t); o.stop(t+dur+.02);
  }
  let interagiu=false; addEventListener('pointerdown',()=>{interagiu=true},{once:true});
  document.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('mouseenter',()=>{if(interagiu)bip('olhar')});
    c.addEventListener('click',()=>bip('ir'));
  });
  const micBtn=document.getElementById('mic'); if(micBtn)micBtn.addEventListener('click',()=>bip('mic'));
  const orbC=document.getElementById('orb'); if(orbC)orbC.addEventListener('click',()=>bip('mic'));
  /* botão de som no topo */
  const hdr=document.querySelector('header');
  if(hdr){
    const b=document.createElement('button'); b.className='som'; b.type='button';
    const pinta=()=>{b.setAttribute('aria-label',mudo?'Ligar som':'Desligar som');b.innerHTML=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h4l5-4v14l-5-4H4z"/>${mudo?'<path d="M17 9l4 6M21 9l-4 6"/>':'<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'}</svg>`};
    pinta(); b.addEventListener('click',()=>{mudo=!mudo;try{localStorage.setItem('sc-mudo',mudo?'1':'0')}catch(e){};pinta();if(!mudo)bip('olhar')});
    hdr.appendChild(b);
  }
  /* circuitos: trilhas ortogonais com pulsos que correm por elas */
  const stage=document.getElementById('stage');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','circuitos'); svg.setAttribute('aria-hidden','true');
  stage.prepend(svg);
  let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  function desenha(){
    const W=stage.clientWidth,H=stage.clientHeight; svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    seed=7; let html='';
    const sr=stage.getBoundingClientRect(), zonas=[...stage.querySelectorAll('.left,.chip,.status')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return[r.left-sr.left-16,r.top-sr.top-16,r.right-sr.left+16,r.bottom-sr.top+16]});
    const livre=(x,y)=>!zonas.some(([a,b,c,d])=>x>a&&x<c&&y>b&&y<d);
    const n=Math.round(W*H/40000);
    for(let i=0,tent=0;i<n&&tent<n*20;tent++){
      let x=Math.round(rnd()*W/24)*24, y=Math.round(rnd()*H/24)*24, d=`M${x},${y}`; const pts=[[x,y]];
      const passos=3+Math.floor(rnd()*4); let dir=rnd()<.5?0:1;
      for(let k=0;k<passos;k++){
        const L=(2+Math.floor(rnd()*6))*24, s=rnd()<.5?-1:1;
        if(dir===0)x+=L*s; else y+=L*s;
        if(rnd()<.4){x+=12*s;y+=12*(rnd()<.5?-1:1)}
        d+=` L${x},${y}`; dir=1-dir; pts.push([x,y]);
      }
      if(!pts.every(([px,py])=>livre(px,py)&&livre((px+pts[0][0])/2,(py+pts[0][1])/2)))continue;
      i++;
      const dur=(4+rnd()*6).toFixed(1), atraso=(-rnd()*10).toFixed(1);
      html+=`<path class="trilha" d="${d}"/><circle class="no" cx="${x}" cy="${y}" r="2.2"/>`;
      if(!reduce)html+=`<path class="pulso" d="${d}" pathLength="100" style="animation-duration:${dur}s;animation-delay:${atraso}s"/>`;
    }
    svg.innerHTML=html;
  }
  setTimeout(desenha,300); let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(desenha,200)});
  /* quando uma área acende, a linha até ela ganha um pulso */
  document.querySelectorAll('.chip').forEach(c=>c.addEventListener('mouseenter',()=>{
    document.querySelectorAll('svg.links path.corre').forEach(p=>p.remove());
    const base=document.querySelector(`svg.links path[data-id="${c.dataset.id}"]`); if(!base||reduce)return;
    const p=base.cloneNode(); p.setAttribute('class','corre'); p.setAttribute('pathLength','100'); base.after(p);
  }));
})();

/* ---------- perguntar e registrar com o Claude ---------- */
(function conversa(){
  const form=document.querySelector('form.ask'), q=document.getElementById('q'), toast=document.getElementById('toast');
  if(!form||!q||!toast)return;
  const vozes=()=>speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.toLowerCase().startsWith('pt'));
  function falar(txt,depois){
    if(!('speechSynthesis' in window)){depois&&depois();return}
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(txt); u.lang='pt-BR'; u.rate=1.05;
    const v=vozes().find(v=>/br/i.test(v.lang))||vozes()[0]; if(v)u.voice=v;
    window.__falando=true;
    u.onend=u.onerror=()=>{window.__falando=false;depois&&depois()};
    speechSynthesis.speak(u);
  }
  let ocupado=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault(); const texto=q.value.trim(); if(!texto||ocupado)return;
    ocupado=true; q.value=''; q.placeholder='Pensando…';
    toast.innerHTML='<b>Pensando…</b><small>'+texto.replace(/[<>&]/g,'')+'</small>'; toast.classList.add('in');
    try{
      const r=await fetch('/api/perguntar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({texto})});
      const j=await r.json();
      const resp=j.resposta||j.erro||'Não consegui responder agora.';
      toast.innerHTML='<b>'+(j.intencao==='registro'?'Registrado':'Resposta')+'</b><small>'+resp.replace(/[<>&]/g,'')+'</small>';
      falar(resp,()=>{ if(j.intencao==='registro'&&r.ok)location.reload(); else setTimeout(()=>toast.classList.remove('in'),4000) });
    }catch(err){ toast.innerHTML='<b>Sem conexão</b><small>Não consegui falar com o servidor.</small>'; }
    finally{ ocupado=false; q.placeholder='Pergunte ou registre algo'; }
  });
  if('speechSynthesis' in window)speechSynthesis.getVoices();
})();
