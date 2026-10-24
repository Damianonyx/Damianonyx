(() => {
  'use strict';
  const canvas = document.querySelector('#audience-globe');
  const ctx = canvas.getContext('2d');
  const motion = document.querySelector('#audience-motion');
  const buttons = [...document.querySelectorAll('.country')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const radians = Math.PI / 180;
  // Geographic positions on the land surface, independent of audience share.
  const countries = [
    { code: 'US', lat: 38, lon: -98 }, { code: 'JP', lat: 36, lon: 138 },
    { code: 'TR', lat: 39, lon: 35 }, { code: 'FR', lat: 46.6, lon: 2.5 },
    { code: 'NG', lat: 9, lon: 8 }, { code: 'DE', lat: 51, lon: 10 },
    { code: 'GB', lat: 54, lon: -2 }, { code: 'SA', lat: 24, lon: 45 }
  ].map((country, i) => ({ ...country,
    name: buttons[i].querySelector('.country-name').textContent,
    share: buttons[i].querySelector('.country-value').textContent,
    point: sphere(country.lat, country.lon)
  }));
  let width = 0, height = 0, radius = 0, selected = 0;
  let latitude = countries[0].lat * radians, longitude = countries[0].lon * radians;
  let transition = null, visible = false, paused = reduce.matches;
  let frame = 0, lastDraw = 0, nextCountryAt = 0, hits = [];
  let land = [], ocean = [];
  const buckets = Array.from({ length: 8 }, () => []);

  function sphere(lat, lon) {
    const a = lat * radians, b = lon * radians;
    return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
  }
  function shortestAngle(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }
  function project(point, cosLon, sinLon, cosLat, sinLat) {
    const depth = point[0] * sinLon + point[2] * cosLon;
    return [point[0] * cosLon - point[2] * sinLon,
      point[1] * cosLat - depth * sinLat,
      point[1] * sinLat + depth * cosLat];
  }
  function updateControl() {
    motion.setAttribute('aria-pressed', String(paused));
    motion.setAttribute('aria-label', paused ? 'Resume globe rotation' : 'Pause globe rotation');
  }
  function selectCountry(index, manual = false, immediate = false) {
    selected = index;
    if (manual) paused = true;
    const country = countries[index];
    const targetLat = country.lat * radians;
    const targetLon = longitude + shortestAngle(longitude, country.lon * radians);
    if (immediate || reduce.matches) {
      latitude = targetLat; longitude = targetLon; transition = null;
    } else {
      transition = { start: performance.now(), lat: latitude, lon: longitude,
        targetLat, targetLon, duration: 1450 };
    }
    buttons.forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
      button.setAttribute('aria-controls', 'audience-globe');
    });
    document.querySelector('#globe-country').textContent = country.name;
    document.querySelector('#globe-share').textContent = country.share;
    canvas.setAttribute('aria-label', `Audience globe: ${country.name}, ${country.share} of impressions. Eight country markers on the globe.`);
    canvas.dataset.country = country.code;
    nextCountryAt = performance.now() + 7000;
    updateControl();
    draw(performance.now());
    schedule();
    if (manual && innerWidth <= 760) {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.top < 86 || bounds.bottom > innerHeight - 20) {
        canvas.closest('.globe-panel').scrollIntoView({ block: 'center', behavior: reduce.matches ? 'instant' : 'smooth' });
      }
    }
  }
  buttons.forEach((button, i) => button.addEventListener('click', () => selectCountry(i, true)));
  motion.addEventListener('click', () => {
    paused = !paused;
    nextCountryAt = performance.now() + 4500;
    updateControl();
    schedule();
    draw(performance.now());
  });
  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * width / rect.width;
    const y = (event.clientY - rect.top) * height / rect.height;
    const closest = hits.map(hit => ({ ...hit, distance: Math.hypot(hit.x - x, hit.y - y) }))
      .filter(hit => hit.distance < 16).sort((a, b) => a.distance - b.distance)[0];
    if (closest) selectCountry(closest.index, true);
  });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height; radius = Math.min(width, height) * .385;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }
  function draw(now) {
    if (!width || !height) return;
    if (transition) {
      const progress = Math.min(1, (now - transition.start) / transition.duration);
      const ease = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
      latitude = transition.lat + (transition.targetLat - transition.lat) * ease;
      longitude = transition.lon + (transition.targetLon - transition.lon) * ease;
      if (progress >= 1) transition = null;
    }
    const dark = document.documentElement.dataset.theme === 'dark';
    const rgb = dark ? '244,247,252' : '35,42,52';
    const cx = width / 2, cy = height / 2;
    const cosLon = Math.cos(longitude), sinLon = Math.sin(longitude);
    const cosLat = Math.cos(latitude), sinLat = Math.sin(latitude);
    const view = point => project(point, cosLon, sinLon, cosLat, sinLat);
    ctx.clearRect(0, 0, width, height);
    const halo = ctx.createRadialGradient(cx, cy, radius * .94, cx, cy, radius * 1.15);
    halo.addColorStop(0, `rgba(${rgb},${dark ? .075 : .04})`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    const body = ctx.createRadialGradient(cx - radius * .35, cy - radius * .4, 0, cx, cy, radius);
    body.addColorStop(0, dark ? '#1c2027' : '#f4f5f7');
    body.addColorStop(.65, dark ? '#111318' : '#f9fafb');
    body.addColorStop(1, dark ? '#0d0e11' : '#ffffff');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},.15)`; ctx.lineWidth = .7; ctx.stroke();

    // Faint latitude/longitude lines provide depth without hiding the land.
    ctx.strokeStyle = `rgba(${rgb},${dark ? .055 : .07})`; ctx.lineWidth = .5;
    function line(points) {
      ctx.beginPath(); let pen = false;
      for (const point of points) {
        const p = view(point);
        if (p[2] <= 0) { pen = false; continue; }
        const x = cx + p[0] * radius, y = cy - p[1] * radius;
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }
    graticules.forEach(line);
    ctx.fillStyle = `rgba(${rgb},${dark ? .105 : .10})`;
    ctx.beginPath();
    for (const point of ocean) {
      const p = view(point);
      if (p[2] > .02) ctx.rect(cx + p[0] * radius, cy - p[1] * radius, .65, .65);
    }
    ctx.fill();
    buckets.forEach(bucket => { bucket.length = 0; });
    for (const point of land) {
      const p = view(point);
      if (p[2] <= .015) continue;
      const brightness = Math.max(0, Math.min(7, Math.floor(p[2] * 5 + point[3] * 2)));
      const size = Math.max(.65, width / 500) * (.65 + p[2] * .55);
      buckets[brightness].push(cx + p[0] * radius, cy - p[1] * radius, size);
    }
    buckets.forEach((bucket, i) => {
      ctx.fillStyle = `rgba(${rgb},${(dark ? .22 : .24) + i * .09})`;
      ctx.beginPath();
      for (let j = 0; j < bucket.length; j += 3) ctx.rect(bucket[j], bucket[j + 1], bucket[j + 2], bucket[j + 2]);
      ctx.fill();
    });

    hits = [];
    const projected = countries.map((country, index) => ({ country, index, p: view(country.point) }));
    // Paint the selected marker last so it remains clear in clustered regions.
    projected.sort((a, b) => (a.index === selected) - (b.index === selected));
    for (const { country, index, p } of projected) {
      if (p[2] < .03) continue; // Markers on the far side stay behind the earth.
      const x = cx + p[0] * radius, y = cy - p[1] * radius, active = index === selected;
      hits.push({ x, y, index });
      ctx.fillStyle = dark ? '#101114' : '#fff';
      ctx.beginPath(); ctx.arc(x, y, active ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},${active ? 1 : .7})`; ctx.lineWidth = active ? 1.8 : 1.1;
      ctx.stroke();
      ctx.fillStyle = `rgba(${rgb},${active ? 1 : .65})`;
      ctx.beginPath(); ctx.arc(x, y, active ? 3 : 1.6, 0, Math.PI * 2); ctx.fill();
      if (active) {
        const pulse = paused || reduce.matches ? .35 : (now % 1900) / 1900;
        ctx.strokeStyle = `rgba(${rgb},${.4 * (1 - pulse)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 10 + pulse * 9, 0, Math.PI * 2); ctx.stroke();
        ctx.font = `500 ${width < 350 ? 11 : 12}px monospace`;
        const text = country.code, tw = ctx.measureText(text).width;
        const labelX = Math.min(width - tw - 24, x + 23);
        ctx.fillStyle = dark ? 'rgba(15,17,22,.92)' : 'rgba(255,255,255,.95)';
        ctx.beginPath(); ctx.roundRect(labelX - 7, y - 13, tw + 14, 26, 6); ctx.fill();
        ctx.fillStyle = `rgba(${rgb},1)`; ctx.textBaseline = 'middle'; ctx.fillText(text, labelX, y);
      }
    }
    canvas.dataset.centerLat = (latitude / radians).toFixed(2);
    canvas.dataset.centerLon = (((longitude / radians + 180) % 360 + 360) % 360 - 180).toFixed(2);
    canvas.dataset.visibleMarkers = hits.map(hit => countries[hit.index].code).join(',');
  }

  const graticules = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const line = []; for (let lon = -180; lon <= 180; lon += 4) line.push(sphere(lat, lon)); graticules.push(line);
  }
  for (let lon = -180; lon < 180; lon += 45) {
    const line = []; for (let lat = -90; lat <= 90; lat += 3) line.push(sphere(lat, lon)); graticules.push(line);
  }
  function schedule() {
    if (!frame && visible && !document.hidden && (transition || !paused)) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    if (now - lastDraw >= 30) {
      if (!paused && now >= nextCountryAt) selectCountry((selected + 1) % countries.length);
      draw(now); lastDraw = now;
    }
    schedule();
  }
  const mask = new Image();
  mask.onload = () => {
    const buffer = document.createElement('canvas');
    buffer.width = mask.naturalWidth; buffer.height = mask.naturalHeight;
    const context = buffer.getContext('2d', { willReadFrequently: true });
    context.drawImage(mask, 0, 0);
    const pixels = context.getImageData(0, 0, buffer.width, buffer.height).data;
    const count = 44000, goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i + .5) / count * 2;
      const noise = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      const variation = noise - Math.floor(noise);
      const lat = Math.max(-89.9, Math.min(89.9, Math.asin(y) / radians + (variation - .5) * .8));
      const lon = ((i * goldenAngle / radians + variation * .8) % 360) - 180;
      const px = Math.round((lon + 180) / 360 * (buffer.width - 1));
      const py = Math.round((90 - lat) / 180 * (buffer.height - 1));
      const point = [...sphere(lat, lon), variation];
      if (pixels[(py * buffer.width + px) * 4] > 127) land.push(point);
      else if (i % 8 === 0) ocean.push(point);
    }
    canvas.dataset.landPoints = String(land.length);
    draw(performance.now()); schedule();
  };
  mask.src = 'assets/globe-land.png';
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) {
      document.querySelector('#audience').classList.add('in-view');
      nextCountryAt = performance.now() + 7000;
      resize(); schedule();
    }
  }, { threshold: .05 }).observe(canvas);
  new MutationObserver(() => draw(performance.now())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => { nextCountryAt = performance.now() + 7000; schedule(); });
  reduce.addEventListener('change', () => {
    if (reduce.matches) { paused = true; selectCountry(selected, false, true); }
    updateControl(); schedule();
  });
  selectCountry(0, false, true);
  resize();
})();
