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

// The brand avatar as a one-bit style print: solid ink cells, dithered greys
// and the beanie's green, continuously repositioned into the header.
const portraitFloat=$('#portrait-float'),portraitCanvas=$('#pixels'),portraitContext=portraitCanvas.getContext('2d');
const portraitAnchor=$('#portrait-anchor'),portraitDock=$('#portrait-dock'),header=$('#site-header');
const grid=144;
// Cell classes written by scripts/generate-portrait-pixels.py, in draw order.
const inks={
  light:[null,'#0a0f0c','#8a958e','#1c6b3a','#2fae62','#ffffff'],
  dark:[null,'#000000','#7f8f85','#1f7a44','#3ddc84','#eef6f0']
};
// On the dark page the black figure is traced in green so it keeps its shape.
const rimInk='#2a9a57';
const portraitCells=[[],[],[],[],[],[]],rimCells=[],thumbs={},bursts=[];
let portraitReady=false,portraitWidth=0,portraitHeight=0,portraitDpr=1,layoutDirty=true,riseStart=0;
let position={x:0,y:0,w:0,h:0},pointer={x:-999,y:-999};
function buildPortrait(image){
  const buffer=document.createElement('canvas');buffer.width=buffer.height=grid;
  const b=buffer.getContext('2d',{willReadFrequently:true});b.drawImage(image,0,0,grid,grid);
  const data=b.getImageData(0,0,grid,grid).data;
  const kind=(x,y)=>x<0||y<0||x>=grid||y>=grid?-1:data[(y*grid+x)*4+3]>127?Math.round(data[(y*grid+x)*4]/40):0;
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const cell=kind(x,y);if(!cell||!portraitCells[cell])continue;portraitCells[cell].push(x,y);if(cell===1&&!(kind(x-1,y)&&kind(x+1,y)&&kind(x,y-1)&&kind(x,y+1)))rimCells.push(x,y);}
  // A plain bitmap per theme serves the small copy that docks in the header.
  for(const theme of ['light','dark']){
    const small=document.createElement('canvas');small.width=small.height=grid;const c=small.getContext('2d');
    const paint=(list,ink)=>{c.fillStyle=ink;for(let i=0;i<list.length;i+=2)c.fillRect(list[i],list[i+1],1,1);};
    portraitCells.forEach((list,cell)=>{if(inks[theme][cell])paint(list,inks[theme][cell]);});
    if(theme==='dark')paint(rimCells,rimInk);
    thumbs[theme]=small;
  }
  portraitReady=true;portraitFloat.classList.add('has-canvas');layoutDirty=true;portraitLayout();drawPortrait(performance.now());
}
const portraitImage=new Image();
portraitImage.onload=()=>buildPortrait(portraitImage);portraitImage.onerror=()=>portraitFloat.classList.add('ready');portraitImage.src='assets/portrait-pixels.png';
function portraitLayout(){const anchor=portraitAnchor.getBoundingClientRect();const hero=$('#home').getBoundingClientRect();const end=Math.max(180,hero.height*.75);let p=Math.max(0,Math.min(1,(scrollY-30)/end));const eased=p*p*(3-2*p);header.classList.toggle('scrolled',scrollY>40);const dock=portraitDock.getBoundingClientRect();const small=innerWidth<=760?32:40;position={x:anchor.left+(dock.left-anchor.left)*eased,y:anchor.top+(dock.top-anchor.top)*eased,w:anchor.width+(small-anchor.width)*eased,h:anchor.height+(small-anchor.height)*eased};portraitFloat.style.transform=`translate3d(${position.x}px,${position.y}px,0)`;portraitFloat.style.width=`${position.w}px`;portraitFloat.style.height=`${position.h}px`;portraitFloat.classList.toggle('docked',p>.98);portraitFloat.classList.add('ready');const dpr=Math.min(devicePixelRatio||1,2);const targetW=Math.round(position.w*dpr),targetH=Math.round(position.h*dpr);if(portraitCanvas.width!==targetW||portraitCanvas.height!==targetH){portraitCanvas.width=targetW;portraitCanvas.height=targetH;portraitDpr=dpr;portraitContext.setTransform(dpr,0,0,dpr,0,0);}portraitWidth=position.w;portraitHeight=position.h;layoutDirty=false;}
function drawPortrait(now){
  if(!portraitReady||!pageVisible)return;if(layoutDirty)portraitLayout();
  const ctx=portraitContext,w=portraitWidth,h=portraitHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);
  const theme=root.dataset.theme==='dark'?'dark':'light';
  if(w<75){ctx.imageSmoothingQuality='high';ctx.drawImage(thumbs[theme],26,4,98,98,0,0,w,h);return;}
  const t=reduced?0:now/1000,snap=portraitDpr;
  const scale=Math.min(w/grid,h/grid),size=Math.ceil(scale*snap)/snap+(reduced?0:1/snap);
  const centre=w/2;
  // The print rises into place once, then sways: each row drifts a little
  // out of step with its neighbours, as if the page were breathing.
  if(!riseStart&&entered)riseStart=now;
  const rise=reduced?1:riseStart?Math.min(1,(now-riseStart)/1100):0,settle=1-(1-rise)**3;
  const oy=h-grid*scale+(1-settle)*h*.22+(reduced?0:Math.sin(t*.8)*1.2);
  const yaw=reduced?1:.987+Math.sin(t*.65)*.012,sway=reduced?0:scale*.42;
  // A tap nudges a small ring of cells outward along rays, then they fall back.
  while(bursts.length&&now-bursts[0].start>620)bursts.shift();
  const reach=Math.max(34,w*.11);
  const fill=(list,ink)=>{
    ctx.fillStyle=ink;ctx.beginPath();
    for(let i=0;i<list.length;i+=2){
      const cx=list[i],cy=list[i+1];
      let x=centre+(cx-grid/2)*scale*yaw+Math.sin(cy*.055+t*1.3)*sway,y=oy+cy*scale;
      if(!reduced){
        const dx=x-pointer.x,dy=y-pointer.y,dist=Math.hypot(dx,dy);
        if(dist<45){const force=(1-dist/45)*5;x+=dx/(dist||1)*force;y+=dy/(dist||1)*force;}
        for(const burst of bursts){
          const bx=x-burst.x,by=y-burst.y,far=Math.hypot(bx,by);if(far>=reach)continue;
          const age=(now-burst.start)/620,swell=age<.22?1-(1-age/.22)**2:(1-(age-.22)/.78)**2;
          const throwBy=swell*(1-far/reach)**.6*reach*.5*(.3+.7*(((cx*73856093)^(cy*19349663))&255)/255);
          x+=bx/(far||1)*throwBy;y+=by/(far||1)*throwBy;
        }
      }
      ctx.rect(Math.round(x*snap)/snap,Math.round(y*snap)/snap,size,size);
    }
    ctx.fill();
  };
  portraitCells.forEach((list,cell)=>{if(inks[theme][cell])fill(list,inks[theme][cell]);});
  if(theme==='dark')fill(rimCells,rimInk);
}
window.addEventListener('pointerdown',e=>{const x=e.clientX-position.x,y=e.clientY-position.y;if(reduced||position.w<75||x<0||y<0||x>position.w||y>position.h)return;bursts.push({x,y,start:performance.now()});if(bursts.length>4)bursts.shift();},{passive:true});
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
