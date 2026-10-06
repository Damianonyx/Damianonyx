'use strict';
const $=s=>document.querySelector(s);
const root=document.documentElement;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=reducedQuery.matches;
let pageVisible=!document.hidden;
const themeButton=$('#theme-toggle');
function updateThemeButton(){const dark=root.dataset.theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');$('.theme-label').textContent=dark?'Light':'Dark';$('meta[name="theme-color"]').content=dark?'#101012':'#ffffff';}
updateThemeButton();
themeButton.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('geek-theme',root.dataset.theme)}catch{}updateThemeButton();drawPortrait(performance.now());drawGlobe(performance.now());});
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
window.addEventListener('resize',()=>{layoutDirty=true;portraitLayout();drawPortrait(performance.now());resizeGlobe();drawGlobe(performance.now())},{passive:true});
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

// Audience figures transcribed from the supplied three-month impressions snapshot.
const countries=[{code:'US',name:'United States',share:41.1,lat:38,lon:-98},{code:'JP',name:'Japan',share:20.8,lat:36,lon:138},{code:'TR',name:'Turkey',share:9.1,lat:39,lon:35},{code:'FR',name:'France',share:4.6,lat:46,lon:2},{code:'NG',name:'Nigeria',share:4.4,lat:9,lon:8},{code:'DE',name:'Germany',share:2.4,lat:51,lon:10},{code:'GB',name:'United Kingdom',share:1.6,lat:54,lon:-2},{code:'SA',name:'Saudi Arabia',share:1.3,lat:24,lon:45}];
const globe=$('#globe'),gctx=globe.getContext('2d');
let globeW=0,globeH=0,globeVisible=false,selectedCountry=0,targetRotation=98*Math.PI/180,rotation=targetRotation,globePinned=false,lastGlobeChange=0;
const countryButtons=[...document.querySelectorAll('.country')];
function selectCountry(index,manual=false){selectedCountry=index;targetRotation=-countries[index].lon*Math.PI/180;while(targetRotation-rotation>Math.PI)targetRotation-=Math.PI*2;while(targetRotation-rotation<-Math.PI)targetRotation+=Math.PI*2;countryButtons.forEach((b,i)=>{b.classList.toggle('is-active',i===index);b.setAttribute('aria-pressed',String(i===index))});$('#globe-country').textContent=countries[index].name;$('#globe-share').textContent=countries[index].share+'%';if(manual)globePinned=true;lastGlobeChange=performance.now();if(reduced){rotation=targetRotation;drawGlobe(performance.now())}}
countryButtons.forEach((b,i)=>{b.addEventListener('click',()=>selectCountry(i,true));b.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')selectCountry(i,true)});b.addEventListener('focus',()=>selectCountry(i,true));});
function resizeGlobe(){globeW=globe.clientWidth;globeH=globe.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);globe.width=Math.round(globeW*dpr);globe.height=Math.round(globeH*dpr);gctx.setTransform(dpr,0,0,dpr,0,0)}
function project(lat,lon){const a=lat*Math.PI/180,b=lon*Math.PI/180+rotation;const x=Math.cos(a)*Math.sin(b),y=-Math.sin(a),z=Math.cos(a)*Math.cos(b);const tilt=.18;return{x,y:y*Math.cos(tilt)+z*Math.sin(tilt),z:z*Math.cos(tilt)-y*Math.sin(tilt)}}
function drawGlobe(now){if(!globeVisible||!globeW||!pageVisible)return;if(!reduced)rotation+=(targetRotation-rotation)*.045;else rotation=targetRotation;const ctx=gctx,w=globeW,h=globeH,cx=w/2,cy=h/2,r=Math.min(w,h)*.405,dark=root.dataset.theme==='dark';const ink=dark?'238,238,242':'30,30,35';ctx.clearRect(0,0,w,h);ctx.lineWidth=.65;ctx.strokeStyle=`rgba(${ink},.12)`;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();let pen=false;for(let lon=-180;lon<=180;lon+=3){const p=project(lat,lon);if(p.z>-.02){if(!pen)ctx.moveTo(cx+p.x*r,cy+p.y*r);else ctx.lineTo(cx+p.x*r,cy+p.y*r);pen=true}else pen=false;}ctx.stroke();}for(let lon=-180;lon<180;lon+=30){ctx.beginPath();let pen=false;for(let lat=-90;lat<=90;lat+=3){const p=project(lat,lon);if(p.z>-.02){if(!pen)ctx.moveTo(cx+p.x*r,cy+p.y*r);else ctx.lineTo(cx+p.x*r,cy+p.y*r);pen=true}else pen=false;}ctx.stroke();}
for(let lat=-75;lat<85;lat+=6){const step=6/Math.max(.25,Math.cos(lat*Math.PI/180));for(let lon=-180;lon<180;lon+=step){const p=project(lat,lon);if(p.z<0)continue;ctx.fillStyle=`rgba(${ink},${.13+p.z*.16})`;const s=1.1+p.z*.5;ctx.fillRect(cx+p.x*r-s/2,cy+p.y*r-s/2,s,s)}}
for(let i=0;i<countries.length;i++){const c=countries[i],p=project(c.lat,c.lon);if(p.z<0)continue;const x=cx+p.x*r,y=cy+p.y*r,active=i===selectedCountry;ctx.fillStyle=`rgba(${ink},${active?1:.4})`;ctx.beginPath();ctx.arc(x,y,active?4:2,0,Math.PI*2);ctx.fill();if(active){const phase=reduced?0:now/1800%1;ctx.strokeStyle=`rgba(${ink},${.35*(1-phase)})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,8+phase*15,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=`rgba(${ink},.2)`;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();ctx.font='10px monospace';ctx.fillStyle=`rgba(${ink},.8)`;ctx.fillText(c.code,x+14,y+3);}}
if(!reduced&&!globePinned&&now-lastGlobeChange>4200)selectCountry((selectedCountry+1)%countries.length);}
selectCountry(0);resizeGlobe();
new IntersectionObserver(entries=>{globeVisible=entries[0].isIntersecting;if(globeVisible){$('#audience').classList.add('in-view');resizeGlobe();lastGlobeChange=performance.now();drawGlobe(performance.now())}},{threshold:.08}).observe($('#audience'));

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

reducedQuery.addEventListener('change',e=>{reduced=e.matches;greetingMotionOverride=false;if(reduced&&bloomDialog.open){flower.pause();flower.hidden=true;flowerStill.hidden=false;}scheduleGreeting();drawPortrait(performance.now());drawGlobe(performance.now());});
document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;scheduleGreeting();if(!pageVisible)flower.pause();else if(bloomDialog.open&&!reduced&&!flower.ended)flower.play().catch(()=>{});});
let frame=0;
function animate(now){frame++;if(pageVisible){if(layoutDirty)portraitLayout();if(!reduced||frame===1){drawPortrait(now);if(frame%2===0)drawGlobe(now);}}requestAnimationFrame(animate);}
requestAnimationFrame(animate);
