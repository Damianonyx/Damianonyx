'use strict';
const $=s=>document.querySelector(s);
const root=document.documentElement;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=reducedQuery.matches;
let pageVisible=!document.hidden;
const themeButton=$('#theme-toggle');
const themeQuery=matchMedia('(prefers-color-scheme: dark)');
function savedTheme(){try{const theme=localStorage.getItem('geek-theme');return theme==='dark'||theme==='light'?theme:null}catch{return null}}
function updateThemeButton(){const dark=root.dataset.theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');$('.theme-label').textContent=dark?'Light':'Dark';$('meta[name="theme-color"]').content=dark?'#060907':'#ffffff';}
function applyTheme(theme){root.dataset.theme=theme;updateThemeButton();drawPortrait(performance.now());}
updateThemeButton();
// The device setting decides the theme until the visitor picks one. Picking
// the theme the device already uses hands control back to the device.
themeButton.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';const system=themeQuery.matches?'dark':'light';try{if(next===system)localStorage.removeItem('geek-theme');else localStorage.setItem('geek-theme',next)}catch{}applyTheme(next);});
themeQuery.addEventListener('change',event=>{if(!savedTheme())applyTheme(event.matches?'dark':'light')});
const entrance=$('#entrance');
let entered=false;
function enter(){if(entered)return;entered=true;entrance.classList.add('is-gone');}
setTimeout(enter,reduced?0:1450);
for(const event of ['pointerdown','wheel','keydown'])window.addEventListener(event,enter,{once:true,passive:true});

const menuButton=$('#menu-toggle'),mobileNav=$('#mobile-nav');
function closeMenu(){menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation');mobileNav.hidden=true;}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');mobileNav.hidden=!open;});
mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});
window.addEventListener('resize',()=>{if(innerWidth>760)closeMenu()},{passive:true});

// One greeting at a time. Interaction state survives visibility changes.
const greetings=[
['English','en',"Hello, welcome to Geek's corner of the Internet"],
['Español','es','Hola, bienvenido al rincón de Geek en Internet'],
['Français','fr','Bonjour, bienvenue dans le coin de Geek sur Internet'],
['中文','zh','你好，欢迎来到 Geek 的互联网小天地'],
['日本語','ja','こんにちは、Geekのインターネットの片隅へようこそ'],
['Deutsch','de','Hallo, willkommen in Geeks Ecke des Internets'],
['Türkçe','tr','Merhaba, Geek’in internetteki köşesine hoş geldiniz'],
['Pidgin','pcm',"How far, welcome to Geek own corner for Internet"]
];
const greeting=$('#greeting'),greetingText=$('#greeting-text');
let language=0,userPaused=false,greetingVisible=true,greetingTimer=0,morphTimer=0,greetingMotionOverride=false;
function clearGreetingTimers(){clearTimeout(greetingTimer);clearTimeout(morphTimer);greeting.classList.remove('morph');}
function setLanguage(){const item=greetings[language];greetingText.textContent=item[2];greetingText.lang=item[1];$('#language-name').textContent=item[0];$('#language-index').textContent=String(language+1).padStart(2,'0')+' / 08';}
function scheduleGreeting(){clearGreetingTimers();const paused=userPaused||(reduced&&!greetingMotionOverride);greeting.setAttribute('aria-pressed',String(paused));greeting.setAttribute('aria-label',paused?greetingText.textContent+'. Resume changing greeting':greetingText.textContent+'. Pause changing greeting');if(paused||!greetingVisible||!pageVisible)return;greetingTimer=setTimeout(()=>{greeting.classList.add('morph');morphTimer=setTimeout(()=>{language=(language+1)%greetings.length;setLanguage();scheduleGreeting()},120)},760);}
greeting.addEventListener('click',()=>{if(reduced&&!greetingMotionOverride){greetingMotionOverride=true;userPaused=false}else userPaused=!userPaused;scheduleGreeting();});
new IntersectionObserver(entries=>{greetingVisible=entries[0].isIntersecting;scheduleGreeting()},{threshold:.05}).observe(greeting);
let lastScrollY=scrollY;
window.addEventListener('scroll',()=>{if(Math.abs(scrollY-lastScrollY)>1){userPaused=true;scheduleGreeting();enter();}lastScrollY=scrollY;},{passive:true});
scheduleGreeting();

// The brand avatar as a grid of flat-colour cells, continuously repositioned
// into the header, with a forearm that waves at whoever is visiting.
const portraitFloat=$('#portrait-float'),portraitCanvas=$('#pixels'),portraitContext=portraitCanvas.getContext('2d');
const portraitAnchor=$('#portrait-anchor'),portraitDock=$('#portrait-dock'),header=$('#site-header');
const grid=128,waveFrames=13,wavePivot={x:25,y:116},waveSwing={middle:-4,reach:11};
const colours=[],colourIndex=new Map(),thumbs={};
let bodyCells=[],rimCells=[],armFrames=[];
let portraitReady=false,portraitWidth=0,portraitHeight=0,portraitDpr=1,layoutDirty=true;
let position={x:0,y:0,w:0,h:0},pointer={x:-999,y:-999};
function loadImage(source){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=source;});}
function readPixels(image){const buffer=document.createElement('canvas');buffer.width=image.naturalWidth;buffer.height=image.naturalHeight;const b=buffer.getContext('2d',{willReadFrequently:true});b.drawImage(image,0,0);return b.getImageData(0,0,buffer.width,buffer.height);}
// On the dark theme the black clothing is lifted to a deep green-grey so the
// figure keeps its shape against a near-black page.
function colourOf(r,g,b){const key=r<<16|g<<8|b;let index=colourIndex.get(key);if(index===undefined){index=colours.length;colourIndex.set(key,index);const lift=(1-(.2126*r+.7152*g+.0722*b)/255)**2;colours.push({light:`rgb(${r},${g},${b})`,dark:`rgb(${Math.round(r+26*lift)},${Math.round(g+40*lift)},${Math.round(b+31*lift)})`});}return index;}
function push(cells,index,x,y){(cells[index]||(cells[index]=[])).push(x,y);}
function buildPortrait([figure,arm]){
  const body=readPixels(figure),sprite=readPixels(arm);
  const solid=(x,y)=>x>=0&&y>=0&&x<grid&&y<grid&&body.data[(y*grid+x)*4+3]>127;
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){if(!solid(x,y))continue;const i=(y*grid+x)*4;push(bodyCells,colourOf(body.data[i],body.data[i+1],body.data[i+2]),x,y);if(!(solid(x-1,y)&&solid(x+1,y)&&solid(x,y-1)&&solid(x,y+1)))rimCells.push(x,y);}
  // Each wave frame is the forearm sprite turned about its elbow and snapped
  // back onto the grid, so the motion stays as pixelated as the portrait.
  const originX=9,originY=sprite.height-1;
  for(let frame=0;frame<waveFrames;frame++){
    const angle=(waveSwing.middle+waveSwing.reach*(frame/(waveFrames-1)*2-1))*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),cells=[];
    for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){
      const dx=x-wavePivot.x,dy=y-wavePivot.y;
      const sx=Math.round(cos*dx+sin*dy)+originX,sy=Math.round(cos*dy-sin*dx)+originY;
      if(sx<0||sy<0||sx>=sprite.width||sy>=sprite.height)continue;
      const i=(sy*sprite.width+sx)*4;
      if(sprite.data[i+3]>127)push(cells,colourOf(sprite.data[i],sprite.data[i+1],sprite.data[i+2]),x,y);
    }
    armFrames.push(cells);
  }
  // A plain bitmap per theme serves the small copy that docks in the header.
  for(const theme of ['light','dark']){
    const buffer=document.createElement('canvas');buffer.width=buffer.height=grid;const b=buffer.getContext('2d');
    for(const cells of [bodyCells,armFrames[waveFrames>>1]])cells.forEach((list,index)=>{b.fillStyle=colours[index][theme];for(let i=0;i<list.length;i+=2)b.fillRect(list[i],list[i+1],1,1);});
    thumbs[theme]=buffer;
  }
  portraitReady=true;portraitFloat.classList.add('has-canvas');layoutDirty=true;portraitLayout();drawPortrait(performance.now());
}
Promise.all([loadImage('assets/portrait-pixels.png'),loadImage('assets/portrait-wave.png')]).then(buildPortrait).catch(()=>portraitFloat.classList.add('ready'));
function portraitLayout(){const anchor=portraitAnchor.getBoundingClientRect();const hero=$('#home').getBoundingClientRect();const end=Math.max(180,hero.height*.75);let p=Math.max(0,Math.min(1,(scrollY-30)/end));const eased=p*p*(3-2*p);header.classList.toggle('scrolled',scrollY>40);const dock=portraitDock.getBoundingClientRect();const small=innerWidth<=760?32:40;position={x:anchor.left+(dock.left-anchor.left)*eased,y:anchor.top+(dock.top-anchor.top)*eased,w:anchor.width+(small-anchor.width)*eased,h:anchor.height+(small-anchor.height)*eased};portraitFloat.style.transform=`translate3d(${position.x}px,${position.y}px,0)`;portraitFloat.style.width=`${position.w}px`;portraitFloat.style.height=`${position.h}px`;portraitFloat.classList.toggle('docked',p>.98);portraitFloat.classList.add('ready');const dpr=Math.min(devicePixelRatio||1,2);const targetW=Math.round(position.w*dpr),targetH=Math.round(position.h*dpr);if(portraitCanvas.width!==targetW||portraitCanvas.height!==targetH){portraitCanvas.width=targetW;portraitCanvas.height=targetH;portraitDpr=dpr;portraitContext.setTransform(dpr,0,0,dpr,0,0);}portraitWidth=position.w;portraitHeight=position.h;layoutDirty=false;}
// Four waves, then a short rest with the hand held up.
function waveFrame(t){const beat=t%4.3;const swing=reduced||beat>2.76?0:Math.sin(beat/.69*Math.PI*2);return armFrames[Math.round((swing+1)/2*(waveFrames-1))];}
function drawPortrait(now){
  if(!portraitReady||!pageVisible)return;if(layoutDirty)portraitLayout();
  const ctx=portraitContext,w=portraitWidth,h=portraitHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);
  const theme=root.dataset.theme==='dark'?'dark':'light';
  if(w<75){ctx.imageSmoothingQuality='high';ctx.drawImage(thumbs[theme],20,2,88,88,0,0,w,h);return;}
  const t=reduced?0:now/1000;
  const scale=Math.min(w/grid,h/grid)*.98,size=Math.max(.7,scale-Math.min(.5,scale*.1)),snap=portraitDpr;
  const centre=w/2,oy=h-grid*scale;
  // Cells stay on a true grid so the face reads clearly; the figure only bobs.
  const drift=reduced?0:Math.round(Math.sin(t*.8)*1.2*snap)/snap;
  const fill=(list,colour)=>{
    ctx.fillStyle=colour;ctx.beginPath();
    for(let i=0;i<list.length;i+=2){
      let x=centre+(list[i]-grid/2)*scale,y=oy+list[i+1]*scale+drift;
      if(!reduced){const dx=x-pointer.x,dy=y-pointer.y,dist=Math.hypot(dx,dy);if(dist<45){const force=(1-dist/45)*5;x+=dx/(dist||1)*force;y+=dy/(dist||1)*force;}}
      ctx.rect(Math.round(x*snap)/snap,Math.round(y*snap)/snap,size,size);
    }
    ctx.fill();
  };
  bodyCells.forEach((list,index)=>fill(list,colours[index][theme]));
  if(theme==='dark')fill(rimCells,'#1f6b3d');
  waveFrame(t).forEach((list,index)=>fill(list,colours[index][theme]));
}
window.addEventListener('pointermove',e=>{pointer={x:e.clientX-position.x,y:e.clientY-position.y}},{passive:true});
window.addEventListener('pointerout',()=>{pointer={x:-999,y:-999}},{passive:true});
window.addEventListener('scroll',()=>{layoutDirty=true;if(reduced){portraitLayout();drawPortrait(performance.now())}},{passive:true});
window.addEventListener('resize',()=>{layoutDirty=true;portraitLayout();drawPortrait(performance.now());},{passive:true});
new ResizeObserver(()=>{layoutDirty=true}).observe(portraitAnchor);
portraitLayout();

// The supplied topic card stays readable while its tags gently drift.
const contentCard=$('#content-card'),contentMotion=$('#content-motion');
let contentVisible=false,contentPaused=false;
function updateContentMotion(){
  contentCard.dataset.running=String(contentVisible&&!document.hidden&&!reducedQuery.matches&&!contentPaused);
  contentMotion.hidden=reducedQuery.matches;
  contentMotion.setAttribute('aria-pressed',String(contentPaused));
  contentMotion.setAttribute('aria-label',contentPaused?'Resume topic animation':'Pause topic animation');
}
contentMotion.addEventListener('click',()=>{contentPaused=!contentPaused;updateContentMotion();});
new IntersectionObserver(entries=>{contentVisible=entries[0].isIntersecting;updateContentMotion();},{threshold:.05}).observe(contentCard);
function illuminateTopics(event){
  if(reducedQuery.matches||contentPaused)return;
  const bounds=contentCard.getBoundingClientRect();
  contentCard.style.setProperty('--pointer-x',(event.clientX-bounds.left)+'px');
  contentCard.style.setProperty('--pointer-y',(event.clientY-bounds.top)+'px');
  contentCard.classList.add('pointer-near');
}
contentCard.addEventListener('pointermove',illuminateTopics,{passive:true});
contentCard.addEventListener('pointerdown',illuminateTopics,{passive:true});
contentCard.addEventListener('pointerleave',()=>contentCard.classList.remove('pointer-near'),{passive:true});
document.addEventListener('visibilitychange',updateContentMotion);
reducedQuery.addEventListener('change',()=>{contentCard.classList.remove('pointer-near');updateContentMotion();});
updateContentMotion();

// Archive categories with keyboard support, no image placeholders.
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab,focus=false){tabs.forEach(t=>{const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!selected;});if(focus)tab.focus();}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',e=>{let target;if(e.key==='ArrowRight')target=(i+1)%tabs.length;if(e.key==='ArrowLeft')target=(i+tabs.length-1)%tabs.length;if(e.key==='Home')target=0;if(e.key==='End')target=tabs.length-1;if(target!==undefined){e.preventDefault();selectTab(tabs[target],true)}})});

// The flower exists only in the closing dialog and starts on visitor activation.
const bloomDialog=$('#bloom-dialog'),bloomTrigger=$('#bloom-trigger'),flower=$('#flower'),flowerStill=$('#flower-still');
let oldOverflow='';
function openBloom(){oldOverflow=document.body.style.overflow;bloomDialog.showModal();document.body.style.overflow='hidden';flower.currentTime=0;flower.hidden=reduced;flowerStill.hidden=!reduced;if(!reduced){flower.play().catch(()=>{flower.hidden=true;flowerStill.hidden=false;});}$('#bloom-close').focus();}
function closeBloom(){if(bloomDialog.open)bloomDialog.close();}
bloomTrigger.addEventListener('click',openBloom);$('#bloom-close').addEventListener('click',closeBloom);
bloomDialog.addEventListener('close',()=>{flower.pause();document.body.style.overflow=oldOverflow;bloomTrigger.focus();});
bloomDialog.addEventListener('click',e=>{if(e.target===bloomDialog){const b=bloomDialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeBloom();}});
$('#bloom-replay').addEventListener('click',()=>{flowerStill.hidden=true;flower.hidden=false;flower.currentTime=0;flower.play().catch(()=>{flower.hidden=true;flowerStill.hidden=false;});});
flower.addEventListener('error',()=>{if(bloomDialog.open){flower.hidden=true;flowerStill.hidden=false;}});

const navigationLinks=[...document.querySelectorAll('.desktop-nav a')];
new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){navigationLinks.forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id));}}},{rootMargin:'-15% 0px -60% 0px',threshold:0}).observe($('#about'));
for(const id of ['archive','projects','audience','contact'])new IntersectionObserver(entries=>{if(entries[0].isIntersecting)navigationLinks.forEach(a=>a.classList.toggle('active',a.hash==='#'+id));},{rootMargin:'-15% 0px -60% 0px',threshold:0}).observe(document.getElementById(id));

reducedQuery.addEventListener('change',e=>{reduced=e.matches;greetingMotionOverride=false;if(reduced&&bloomDialog.open){flower.pause();flower.hidden=true;flowerStill.hidden=false;}scheduleGreeting();drawPortrait(performance.now());});
document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;scheduleGreeting();if(!pageVisible)flower.pause();else if(bloomDialog.open&&!reduced&&!flower.ended)flower.play().catch(()=>{});});
let frame=0;
function animate(now){frame++;if(pageVisible){if(layoutDirty)portraitLayout();if(!reduced||frame===1){drawPortrait(now);}}requestAnimationFrame(animate);}
requestAnimationFrame(animate);
// Keep the address available without displaying a second contact line.
const copyEmailButton = $('#copy-email');
const copyEmailStatus = $('#copy-email-status');
let copyEmailReset;
copyEmailButton.hidden = false;
copyEmailButton.addEventListener('click', async () => {
  const address = document.querySelector('.contact-email a').getAttribute('href').slice(7);
  clearTimeout(copyEmailReset);
  copyEmailStatus.textContent = '';
  copyEmailButton.disabled = true;
  try {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const field = document.createElement('textarea');
      field.value = address;
      field.readOnly = true;
      field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(field);
      try {
        field.select();
        if (!document.execCommand('copy')) throw new Error('Copy unavailable');
      } finally {
        field.remove();
      }
    }
    copyEmailStatus.textContent = 'Email copied';
  } catch {
    copyEmailStatus.textContent = 'Unable to copy';
  } finally {
    copyEmailButton.disabled = false;
    copyEmailButton.focus({ preventScroll: true });
    copyEmailReset = setTimeout(() => { copyEmailStatus.textContent = ''; }, 3000);
  }
});
