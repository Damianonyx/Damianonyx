'use strict';
const $=s=>document.querySelector(s);
const root=document.documentElement;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=reducedQuery.matches;
let pageVisible=!document.hidden;
const themeButton=$('#theme-toggle');
function updateThemeButton(){const dark=root.dataset.theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');$('.theme-label').textContent=dark?'Light':'Dark';$('meta[name="theme-color"]').content=dark?'#101012':'#ffffff';}
updateThemeButton();
themeButton.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('geek-theme',root.dataset.theme)}catch{}updateThemeButton();drawPortrait(performance.now());});
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

// An actual sampled pixel portrait, continuously repositioned into the header.
const portraitFloat=$('#portrait-float'),portraitCanvas=$('#pixels'),portraitContext=portraitCanvas.getContext('2d');
const portraitAnchor=$('#portrait-anchor'),portraitDock=$('#portrait-dock'),header=$('#site-header');
const portraitImage=new Image();
let points=[],portraitReady=false,portraitWidth=0,portraitHeight=0,portraitDpr=1,layoutDirty=true;
let position={x:0,y:0,w:0,h:0},pointer={x:-999,y:-999};
const gridW=144,gridH=158;
function samplePortrait(){const buffer=document.createElement('canvas');buffer.width=gridW;buffer.height=gridH;const b=buffer.getContext('2d',{willReadFrequently:true});const ratio=portraitImage.naturalWidth/1536;b.drawImage(portraitImage,170*ratio,190*ratio,1210*ratio,1346*ratio,0,0,gridW,gridH);const values=b.getImageData(0,0,gridW,gridH).data;points=[];for(let y=0;y<gridH;y++)for(let x=0;x<gridW;x++){const i=(y*gridW+x)*4;const lum=.2126*values[i]+.7152*values[i+1]+.0722*values[i+2];if(lum<205){const level=lum<65?0:lum<130?1:2;if(level===2&&(x+y)%2)continue;points.push({x,y,level});}}portraitReady=true;portraitFloat.classList.add('has-canvas');layoutDirty=true;portraitLayout();drawPortrait(performance.now());}
portraitImage.onload=samplePortrait;portraitImage.onerror=()=>portraitFloat.classList.add('ready');portraitImage.src='assets/portrait.webp';
function portraitLayout(){const anchor=portraitAnchor.getBoundingClientRect();const hero=$('#home').getBoundingClientRect();const end=Math.max(180,hero.height*.75);let p=Math.max(0,Math.min(1,(scrollY-30)/end));const eased=p*p*(3-2*p);header.classList.toggle('scrolled',scrollY>40);const dock=portraitDock.getBoundingClientRect();const small=innerWidth<=760?32:40;position={x:anchor.left+(dock.left-anchor.left)*eased,y:anchor.top+(dock.top-anchor.top)*eased,w:anchor.width+(small-anchor.width)*eased,h:anchor.height+(small-anchor.height)*eased};portraitFloat.style.transform=`translate3d(${position.x}px,${position.y}px,0)`;portraitFloat.style.width=`${position.w}px`;portraitFloat.style.height=`${position.h}px`;portraitFloat.classList.toggle('docked',p>.98);portraitFloat.classList.add('ready');const dpr=Math.min(devicePixelRatio||1,2);const targetW=Math.round(position.w*dpr),targetH=Math.round(position.h*dpr);if(portraitCanvas.width!==targetW||portraitCanvas.height!==targetH){portraitCanvas.width=targetW;portraitCanvas.height=targetH;portraitDpr=dpr;portraitContext.setTransform(dpr,0,0,dpr,0,0);}portraitWidth=position.w;portraitHeight=position.h;layoutDirty=false;}
function drawPortrait(now){if(!portraitReady||!pageVisible)return;if(layoutDirty)portraitLayout();const ctx=portraitContext,w=portraitWidth,h=portraitHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);const t=reduced?0:now/1000;const dark=root.dataset.theme==='dark';const colors=dark?['#ededf0','#a5a5ae','#5c5c65']:['#171719','#69696f','#a8a8af'];const isSmall=w<75;const scale=Math.min(w/gridW,h/gridH)*(isSmall?1.25:.98);const ox=(w-gridW*scale)/2,oy=(h-gridH*scale)+(isSmall?h*.07:0);const yaw=reduced?1:.987+Math.sin(t*.65)*.012;const drift=reduced||isSmall?0:Math.sin(t*.8)*1.2;for(let level=0;level<3;level++){ctx.fillStyle=colors[level];ctx.beginPath();for(const pt of points){if(pt.level!==level)continue;let x=ox+gridW*scale/2+(pt.x-gridW/2)*scale*yaw;let y=oy+pt.y*scale+drift;if(!reduced&&!isSmall){x+=Math.sin(pt.y*.055+t*1.3)*scale*.42;const dx=x-pointer.x,dy=y-pointer.y,dist=Math.hypot(dx,dy);if(dist<45){const force=(1-dist/45)*5;x+=dx/(dist||1)*force;y+=dy/(dist||1)*force;}}ctx.rect(Math.round(x),Math.round(y),Math.max(.7,scale*.93),Math.max(.7,scale*.93));}ctx.fill();}}
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

// Audience figures stay selectable alongside the supplied globe video.
const audienceVideo = $('#audience-video');
const audienceMotion = $('#audience-motion');
const countryButtons = [...document.querySelectorAll('.country')];
let audienceVisible = false;
let audiencePausedByUser = false;
let audienceMotionOverride = false;
function selectCountry(index) {
  countryButtons.forEach((button, i) => {
    button.classList.toggle('is-active', i === index);
    button.setAttribute('aria-pressed', String(i === index));
  });
  $('#globe-country').textContent = countryButtons[index].querySelector('.country-name').textContent;
  $('#globe-share').textContent = countryButtons[index].querySelector('.country-value').textContent;
}
countryButtons.forEach((button, index) => {
  button.addEventListener('click', () => selectCountry(index));
  button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') selectCountry(index); });
  button.addEventListener('focus', () => selectCountry(index));
});
selectCountry(0);
function updateAudienceControl() {
  const paused = audienceVideo.paused;
  audienceMotion.setAttribute('aria-pressed', String(paused));
  audienceMotion.setAttribute('aria-label', paused ? 'Play audience animation' : 'Pause audience animation');
}
function syncAudiencePlayback() {
  if (!audienceVisible || document.hidden || audiencePausedByUser || (reducedQuery.matches && !audienceMotionOverride)) {
    audienceVideo.pause();
  } else {
    audienceVideo.play().catch(updateAudienceControl);
  }
  updateAudienceControl();
}
audienceVideo.muted = true;
audienceVideo.controls = false;
audienceMotion.hidden = false;
audienceMotion.addEventListener('click', () => {
  audiencePausedByUser = !audienceVideo.paused;
  audienceMotionOverride = !audiencePausedByUser;
  syncAudiencePlayback();
});
for (const event of ['play', 'pause', 'loadeddata']) audienceVideo.addEventListener(event, updateAudienceControl);
new IntersectionObserver(entries => {
  audienceVisible = entries[0].isIntersecting;
  if (audienceVisible) $('#audience').classList.add('in-view');
  syncAudiencePlayback();
}, { threshold: .1 }).observe($('.audience-visual'));
document.addEventListener('visibilitychange', syncAudiencePlayback);
reducedQuery.addEventListener('change', () => { audienceMotionOverride = false; syncAudiencePlayback(); });

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
