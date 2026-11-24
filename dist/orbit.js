// Projects I've worked with, as a wheel of cards standing in a disc. The wheel
// turns one card at a time and rests; visitors can drag it, step it with the
// buttons, or tab to a card to bring it to the top. The plain grid shows instead
// for visitors without scripts, and whenever reduced motion is on.
(() => {
  'use strict';
  const section = document.querySelector('#projects');
  const grid = section && section.querySelector('.project-grid');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!grid) return;
  const projects = [...grid.querySelectorAll('.project')].map(link => {
    const logo = link.querySelector('img').getAttribute('src');
    return { href: link.href, logo, card: logo.replace('assets/', 'assets/cards/'),
      name: link.querySelector('span:not(.project-network)').textContent.trim() };
  });
  const count = projects.length;
  if (!count) return;

  const STEP = 1300;   // ms to turn by one card
  const HOLD = 2200;   // ms to rest between turns
  const LEAD = 26;     // px above the top card, room for its lift
  const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const escape = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const orbit = document.createElement('div');
  orbit.className = 'orbit';
  orbit.innerHTML = `<div class="orbit-stage">
    <ul class="orbit-ring" aria-label="Projects I’ve worked with"></ul>
    <div class="orbit-floor" aria-hidden="true"><span class="orbit-disc"></span></div>
    <div class="orbit-hud">
      <p class="orbit-caption" aria-hidden="true"><a class="orbit-name" tabindex="-1" target="_blank" rel="noopener noreferrer"></a><span class="orbit-network">X profile</span></p>
      <div class="orbit-controls">
        <button class="orbit-button orbit-prev" type="button" aria-label="Previous project">${icon('<path d="m14 6-6 6 6 6"/>')}</button>
        <button class="orbit-button orbit-motion" type="button" aria-label="Pause rotation" aria-pressed="false">${icon('<path class="orbit-pause" d="M9 6v12M15 6v12"/><path class="orbit-play" d="m9 5 10 7-10 7Z"/>')}</button>
        <button class="orbit-button orbit-next" type="button" aria-label="Next project">${icon('<path d="m10 6 6 6-6 6"/>')}</button>
      </div>
    </div>
  </div>`;
  orbit.hidden = true;
  section.querySelector('.projects-head').after(orbit);
  const stage = orbit.querySelector('.orbit-stage'), ring = orbit.querySelector('.orbit-ring');
  const disc = orbit.querySelector('.orbit-disc'), hud = orbit.querySelector('.orbit-hud');
  const caption = orbit.querySelector('.orbit-caption'), nameLink = orbit.querySelector('.orbit-name');
  const motion = orbit.querySelector('.orbit-motion');

  // Geometry, in CSS pixels. The cards' bottom edges stand on a circle whose
  // centre is below the stage. s is the wheel's position in cards; card e sits
  // p = e - s places from the top, at angle p * spacing.
  let width = 0, cardW = 0, cardH = 0, radius = 0, spacing = 0, centreX = 0, centreY = 0, reach = 0;
  let active = false, items = [], slots = 0, s = 0, tween = null, drag = null, hovered = -1, focused = -1;
  let shown = -1, visible = false, userPaused = false, suppressClick = false;
  let frame = 0, wake = 0, restUntil = performance.now() + HOLD, drawnAt = NaN, settling = true;

  function build(total) {
    ring.textContent = '';
    hovered = focused = -1;
    items = Array.from({ length: total }, (_, e) => {
      const project = projects[e % count], copy = e >= count;
      const item = document.createElement('li');
      item.className = 'orbit-item';
      if (copy) item.setAttribute('aria-hidden', 'true');
      item.innerHTML = `<a class="orbit-card" href="${escape(project.href)}" target="_blank" rel="noopener noreferrer" draggable="false"${copy ? ' tabindex="-1"' : ''} aria-label="${escape(project.name)}, X profile"><img src="${escape(project.card)}" alt="" draggable="false" decoding="async"></a>`;
      const img = item.querySelector('img');
      img.addEventListener('error', () => { img.src = project.logo; img.classList.add('is-logo'); }, { once: true });
      item.addEventListener('pointerenter', () => { hovered = e; settling = true; schedule(); });
      item.addEventListener('pointerleave', () => {
        if (hovered === e) hovered = -1;
        restUntil = Math.max(restUntil, performance.now() + 1200);
        settling = true; schedule();
      });
      ring.append(item);
      return { item, project: e % count, lift: 0, parked: false };
    });
    slots = total;
  }

  function layout(force) {
    const next = stage.clientWidth;
    if (!next || (next === width && !force)) return;
    width = next;
    cardW = Math.round(Math.min(210, Math.max(86, width * .08 + 70)));
    cardH = Math.round(cardW * 1.5);
    radius = Math.max(width * .9, 330);
    spacing = .97 * cardW / radius;              // neighbours meet at their bottom corners
    centreX = width / 2;
    centreY = LEAD + cardH + radius;
    reach = Math.asin(Math.min(1, (width / 2 + cardW) / (radius + cardH)));
    const needed = count * Math.ceil((2 * reach / spacing + 3) / count);
    if (needed !== slots) build(needed);
    const hudTop = LEAD + cardH + (width < 600 ? 20 : 30);
    stage.style.setProperty('--card-w', `${cardW}px`);
    stage.style.setProperty('--card-h', `${cardH}px`);
    stage.style.setProperty('--hud-top', `${hudTop}px`);
    // Tall enough that the outermost cards leave through the sides, not the bottom.
    const sag = radius * (1 - Math.cos(Math.asin(Math.min(1, width / 2 / radius))));
    const height = Math.round(Math.max(hudTop + hud.offsetHeight + 34, LEAD + cardH + sag + 16));
    stage.style.height = `${height}px`;
    // The disc's rim meets the cards' bottom edges. It stays opaque so card
    // bottoms never show through it, and shades into the page near the bottom.
    const rim = radius + 1, discTop = centreY - rim;
    Object.assign(disc.style, { width: `${rim * 2}px`, height: `${rim * 2}px`, left: `${centreX - rim}px`, top: `${discTop}px` });
    disc.style.setProperty('--fade-from', `${height * .62 - discTop}px`);
    disc.style.setProperty('--fade-to', `${height - discTop}px`);
    draw(true);
  }

  const wrap = p => { p = ((p % slots) + slots) % slots; return p >= slots / 2 ? p - slots : p; };
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const easeOut = t => 1 - (1 - t) ** 3;
  function turnTo(goal, duration = STEP, ease = easeInOut) {
    tween = { from: s, to: goal, start: performance.now(), duration, ease };
    schedule();
  }

  function draw(force) {
    if (!slots || (!force && s === drawnAt && !settling)) return;
    drawnAt = s; settling = false;
    let top = 0, nearest = Infinity;
    for (let e = 0; e < slots; e++) {
      const card = items[e], p = wrap(e - s), angle = p * spacing;
      if (Math.abs(p) < nearest) { nearest = Math.abs(p); top = e; }
      // Cards round the back are parked off the stage rather than hidden, so the
      // keyboard can still reach every project in order.
      if (Math.abs(angle) > reach + spacing) {
        if (!card.parked) { card.item.style.transform = 'translate3d(-300vw,0,0)'; card.parked = true; }
        continue;
      }
      card.parked = false;
      const lift = hovered === e && !drag ? 14 : 0;
      card.lift = Math.abs(lift - card.lift) < .05 ? lift : card.lift + (lift - card.lift) * .22;
      if (card.lift !== lift) settling = true;
      const r = radius + card.lift;
      const x = centreX + r * Math.sin(angle), y = centreY - r * Math.cos(angle);
      card.item.style.zIndex = String(Math.round((p + slots) * 100));   // each card overlaps the one to its left
      card.item.style.transform = `translate3d(${(x - cardW / 2).toFixed(2)}px,${(y - cardH).toFixed(2)}px,0) rotate(${angle.toFixed(5)}rad)`;
    }
    const label = hovered >= 0 ? items[hovered].project : items[top].project;
    if (label !== shown) {
      shown = label;
      nameLink.textContent = projects[label].name;
      nameLink.href = projects[label].href;
      caption.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
    }
  }

  // One animation frame. While the wheel rests, no frames run: a timer wakes it
  // for the next turn.
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.duration);
      s = tween.from + (tween.to - tween.from) * tween.ease(t);
      if (t >= 1) { s = tween.to; tween = null; restUntil = now + HOLD; }
    } else if (focused >= 0 && Math.abs(wrap(focused - s)) > .001) {
      turnTo(s + wrap(focused - s), 700);
    } else if (!drag && !userPaused && hovered < 0 && focused < 0 && now >= restUntil) {
      turnTo(Math.round(s) + 1);
    }
    draw();
    if (tween || settling || (drag && drag.moved)) { schedule(); return; }
    clearTimeout(wake);
    if (!drag && !userPaused && hovered < 0 && focused < 0) wake = setTimeout(schedule, Math.max(16, restUntil - performance.now()));
  }
  function schedule() { if (active && !frame && visible && !document.hidden) frame = requestAnimationFrame(tick); }

  // Stepping, pausing and keyboard focus.
  const step = by => { focused = -1; turnTo(Math.round(tween ? tween.to : s) + by, 900); };
  orbit.querySelector('.orbit-prev').addEventListener('click', () => step(-1));
  orbit.querySelector('.orbit-next').addEventListener('click', () => step(1));
  function updateMotion() {
    motion.setAttribute('aria-pressed', String(userPaused));
    motion.setAttribute('aria-label', userPaused ? 'Resume rotation' : 'Pause rotation');
  }
  motion.addEventListener('click', () => {
    userPaused = !userPaused;
    restUntil = performance.now() + 600;
    updateMotion(); schedule();
  });
  // Only keyboard focus steers the wheel; a mouse press also focuses the card it lands on.
  const fromKeyboard = el => { try { return el.matches(':focus-visible'); } catch { return true; } };
  ring.addEventListener('focusin', event => {
    stage.scrollLeft = stage.scrollTop = 0;   // where overflow: clip is missing, focus can scroll the stage
    if (!fromKeyboard(event.target)) return;
    const index = items.findIndex(card => card.item.contains(event.target));
    if (index >= 0) { focused = index; schedule(); }
  });
  ring.addEventListener('focusout', () => { if (focused < 0) return; focused = -1; restUntil = performance.now() + HOLD; schedule(); });

  // Dragging turns the wheel under the pointer; letting go settles on a card.
  stage.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.orbit-hud')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: s, moved: false, trail: [] };
  });
  stage.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    // The button came up somewhere this page never heard about.
    if (event.pointerType === 'mouse' && !(event.buttons & 1)) { release(event); return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      drag.moved = true; drag.x = event.clientX; drag.from = s; tween = null; focused = -1;
      stage.setPointerCapture(event.pointerId);
      orbit.classList.add('is-dragging');
    }
    s = drag.from - (event.clientX - drag.x) / ((radius + cardH * .3) * spacing);
    drag.trail.push({ t: event.timeStamp, s });
    while (drag.trail.length > 2 && event.timeStamp - drag.trail[0].t > 120) drag.trail.shift();
    schedule();
  });
  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      const first = drag.trail[0], last = drag.trail[drag.trail.length - 1];
      const velocity = first && last && last.t > first.t ? (last.s - first.s) / (last.t - first.t) * 1000 : 0;
      const goal = Math.round(Math.max(s - 4, Math.min(s + 4, s + velocity * .3)));
      turnTo(goal, Math.min(1100, 380 + 260 * Math.abs(goal - s)), easeOut);
      suppressClick = true;
      orbit.classList.remove('is-dragging');
    }
    drag = null;
    schedule();
  }
  // A press can end anywhere, not only over the wheel.
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('blur', () => { if (drag) release({ pointerId: drag.id }); });
  stage.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
  }, true);

  // The stage's own height is set here, so watch the window rather than the stage.
  let resizing = 0;
  addEventListener('resize', () => { if (!resizing) resizing = requestAnimationFrame(() => { resizing = 0; layout(); }); });
  if (document.fonts) document.fonts.ready.then(() => layout(true));
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { restUntil = Math.max(restUntil, performance.now() + 900); schedule(); }
  }).observe(stage);
  document.addEventListener('visibilitychange', () => { restUntil = performance.now() + HOLD; schedule(); });
  // Reduced motion swaps the wheel for the plain grid, even while the page is open.
  function setActive(on) {
    if (on === active) return;
    active = on;
    const focusedCard = on ? null : items.find(card => card.item.contains(document.activeElement));
    orbit.hidden = !on;
    section.classList.toggle('has-orbit', on);
    if (on) { layout(true); restUntil = performance.now() + HOLD; schedule(); return; }
    cancelAnimationFrame(frame); frame = 0; clearTimeout(wake);
    tween = drag = null; hovered = focused = -1;
    orbit.classList.remove('is-dragging');
    if (focusedCard) grid.querySelectorAll('.project')[focusedCard.project].focus({ preventScroll: true });
  }
  reduce.addEventListener('change', () => setActive(!reduce.matches));
  updateMotion();
  setActive(!reduce.matches);
})();
