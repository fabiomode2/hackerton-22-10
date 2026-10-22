/* =========================================================
   OUTFIT CHECK — DECK ENGINE
   ---------------------------------------------------------
   Carga las slides desde slides/*.html según manifest.js.
   No necesitas tocar este archivo para crear una slide:
   copia slides/_template.html y añádela al manifest.
   ========================================================= */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('deckStage');
  const slidesRoot = document.getElementById('slides');
  const progressBar = document.getElementById('progressBar');
  const sectionLabel = document.getElementById('sectionLabel');
  const slideCurrent = document.getElementById('slideCurrent');
  const slideTotal = document.getElementById('slideTotal');
  const overview = document.getElementById('overview');
  const overviewGrid = document.getElementById('overviewGrid');
  const demoExit = document.getElementById('demoExit');

  const manifest = window.SEGUNDA_PIEL_DECK || { slides: [] };
  let slides = [];
  let current = 0;
  let idleTimer = null;
  let demoLoaded = {};
  let demoActiveTab = 'phone';

  /* =========================================================
     CARGA DE SLIDES
     ========================================================= */
  async function loadSlides() {
    if (!manifest.slides.length) {
      slidesRoot.innerHTML = '<div style="color:#F2EFE8;font:16px monospace;padding:80px">manifest.js está vacío. Añade una slide.</div>';
      return;
    }

    const parts = await Promise.all(manifest.slides.map(async (entry, i) => {
      try {
        const res = await fetch(entry.file, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        return await res.text();
      } catch (err) {
        console.error('[deck] No se pudo cargar', entry.file, err);
        return '<section class="slide"><div class="slide__inner"><div class="kicker">ERROR</div><h2 class="title">No se pudo cargar ' + entry.file + '</h2><p class="lede">Comprueba que existe y que estás sirviendo el deck por HTTP (./deck/start.sh).</p></div></section>';
      }
    }));

    slidesRoot.innerHTML = parts.join('\n');
    slides = Array.from(slidesRoot.querySelectorAll('.slide'));

    slides.forEach((slide, i) => {
      const meta = manifest.slides[i] || {};
      if (meta.title) slide.dataset.title = meta.title;
      if (meta.section) slide.dataset.section = meta.section;
      if (meta.theme) slide.classList.add(meta.theme);
      slide.setAttribute('aria-label', slide.dataset.title || ('Slide ' + (i + 1)));
      slide.setAttribute('aria-hidden', 'true');
    });

    slideTotal.textContent = String(slides.length).padStart(2, '0');
    buildOverview();
    buildRings();
    buildGauges();
    buildDotRings();
    bindDemo();
    initChrome();
    initKeyboard();
    initTouch();

    let initial = 0;
    try {
      const p = new URLSearchParams(window.location.search).get('slide');
      if (p) initial = Math.max(0, Math.min(parseInt(p, 10) - 1, slides.length - 1));
    } catch (e) {}
    requestAnimationFrame(() => show(initial, { force: true }));
  }

  /* =========================================================
     RING FIGURES
     ========================================================= */
  const PROFILES = {
    body:    [34, 46, 62, 78, 90, 96, 92, 82, 74, 70, 74, 82, 88, 82, 66, 52],
    garment: [46, 58, 74, 90, 102, 108, 104, 94, 86, 82, 86, 94, 100, 94, 78, 64]
  };
  const HEAT = {
    'heat-a': ['#4ADE9B','#4ADE9B','#4ADE9B','#4ADE9B','#4ADE9B','#FFB05C','#4ADE9B','#4ADE9B','#4ADE9B','#4ADE9B','#6EA8FF','#6EA8FF','#6EA8FF','#6EA8FF','#6EA8FF','#6EA8FF']
  };

  function buildRings() {
    document.querySelectorAll('svg[data-rings]').forEach(function (svg) {
      const type = svg.dataset.rings || 'body';
      const isHeat = type.indexOf('heat') === 0;
      const profile = isHeat ? PROFILES.body : (PROFILES[type] || PROFILES.body);
      const cx = 230;
      const top = parseFloat(svg.dataset.top || 70);
      const gap = parseFloat(svg.dataset.gap || 38);
      const scale = parseFloat(svg.dataset.scale || 1);
      const colorKey = svg.dataset.color || 'ink';
      const color = colorKey === 'teal' ? 'var(--chart-main)' : 'var(--paper)';
      const dashed = svg.dataset.dashed === 'true';
      const heat = isHeat ? HEAT[type] : null;
      const frag = document.createDocumentFragment();

      profile.forEach(function (base, i) {
        const rx = base * scale;
        const ry = (10 + base * 0.08) * scale;
        const el = document.createElementNS(NS, 'ellipse');
        el.setAttribute('cx', cx);
        el.setAttribute('cy', top + i * gap);
        el.setAttribute('rx', rx);
        el.setAttribute('ry', ry);
        if (heat) {
          el.style.fill = heat[i];
          el.style.fillOpacity = '.16';
          el.style.stroke = heat[i];
          el.setAttribute('stroke-width', 4.2);
          el.setAttribute('class', 'ring ring--heat');
          el.style.filter = 'drop-shadow(0 0 7px ' + heat[i] + ')';
        } else {
          el.style.fill = dashed ? 'rgba(22,184,176,.025)' : 'none';
          el.style.stroke = color;
          el.setAttribute('stroke-width', dashed ? 2 : 1.5);
          el.setAttribute('stroke-opacity', dashed ? '.9' : '.72');
          el.setAttribute('class', 'ring');
        }
        if (dashed) el.setAttribute('stroke-dasharray', '5 8');
        el.style.setProperty('--i', i);
        frag.appendChild(el);
      });
      svg.appendChild(frag);
    });
  }

  /* =========================================================
     GAUGE (270°, generado desde data-gauge)
     ========================================================= */
  function polar(cx, cy, r, angleDeg) {
    const a = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function arcPath(cx, cy, r, start, end) {
    const a = polar(cx, cy, r, start);
    const b = polar(cx, cy, r, end);
    const large = end - start > 180 ? 1 : 0;
    return 'M ' + a.x.toFixed(2) + ' ' + a.y.toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' +
      b.x.toFixed(2) + ' ' + b.y.toFixed(2);
  }
  function buildGauges() {
    document.querySelectorAll('[data-gauge]').forEach(function (el) {
      if (el.dataset.built === 'true') return;
      el.dataset.built = 'true';
      const value = parseFloat(el.dataset.gauge || 0);
      const max = parseFloat(el.dataset.gaugeMax || 100);
      const ticks = parseInt(el.dataset.ticks || 60, 10);
      const start = -135;
      const end = 135;
      const cx = 280, cy = 280, r = 224;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 560 560');
      svg.setAttribute('aria-hidden', 'true');

      const defs = document.createElementNS(NS, 'defs');
      const grad = document.createElementNS(NS, 'linearGradient');
      grad.setAttribute('id', 'gaugeGradient');
      grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
      grad.setAttribute('x2', '1'); grad.setAttribute('y2', '1');
      [['0%', 'var(--chart-main-2)'], ['100%', 'var(--chart-main)']].forEach(function (stopDef) {
        const stop = document.createElementNS(NS, 'stop');
        stop.setAttribute('offset', stopDef[0]);
        stop.setAttribute('stop-color', stopDef[1]);
        grad.appendChild(stop);
      });
      defs.appendChild(grad);
      svg.appendChild(defs);

      const track = document.createElementNS(NS, 'path');
      track.setAttribute('d', arcPath(cx, cy, r, start, end));
      track.setAttribute('class', 'gauge__track');
      svg.appendChild(track);

      const valuePath = document.createElementNS(NS, 'path');
      valuePath.setAttribute('d', arcPath(cx, cy, r, start, end));
      valuePath.setAttribute('pathLength', '100');
      valuePath.setAttribute('class', 'gauge__value');
      valuePath.style.setProperty('--gauge-value', value / max * 100);
      svg.appendChild(valuePath);

      const tickGroup = document.createElementNS(NS, 'g');
      for (let i = 0; i <= ticks; i++) {
        const angle = start + (end - start) * (i / ticks);
        const p1 = polar(cx, cy, r - 26, angle);
        const p2 = polar(cx, cy, r - (i % 5 === 0 ? 38 : 32), angle);
        const tick = document.createElementNS(NS, 'line');
        tick.setAttribute('x1', p1.x); tick.setAttribute('y1', p1.y);
        tick.setAttribute('x2', p2.x); tick.setAttribute('y2', p2.y);
        tick.setAttribute('class', 'gauge__tick' + (i % 5 === 0 ? ' gauge__tick--major' : ''));
        tick.style.setProperty('--i', i);
        tickGroup.appendChild(tick);
      }
      svg.appendChild(tickGroup);

      const dot = document.createElementNS(NS, 'circle');
      const dotPos = polar(cx, cy, r, start + (end - start) * (value / max));
      dot.setAttribute('cx', dotPos.x);
      dot.setAttribute('cy', dotPos.y);
      dot.setAttribute('r', '7');
      dot.setAttribute('class', 'gauge__dot');
      svg.appendChild(dot);

      el.prepend(svg);
    });
  }

  /* =========================================================
     DOT RING (100 puntos)
     ========================================================= */
  function buildDotRings() {
    document.querySelectorAll('[data-dot-ring]').forEach(function (ring) {
      if (ring.dataset.built === 'true') return;
      ring.dataset.built = 'true';
      const on = parseInt(ring.dataset.dotRing || 85, 10);
      const total = 100;
      const cx = 310, cy = 310, radius = 270;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < total; i++) {
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const dot = document.createElement('i');
        dot.style.left = (x / 620 * 100) + '%';
        dot.style.top = (y / 620 * 100) + '%';
        dot.style.setProperty('--i', i);
        if (i >= on) dot.classList.add('off');
        frag.appendChild(dot);
      }
      ring.appendChild(frag);
    });
  }

  /* =========================================================
     COUNTERS
     ========================================================= */
  function formatCount(val, decimals) {
    const fixed = val.toFixed(decimals);
    const parts = fixed.split('.');
    const grouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimals ? grouped + ',' + parts[1] : grouped;
  }
  function startCounters(slide) {
    slide.querySelectorAll('[data-count]').forEach(function (el) {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const duration = parseInt(el.dataset.duration || '1300', 10);
      const start = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + formatCount(target * eased, decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* =========================================================
     DEMO — tabs, lazy iframes, focus
     ========================================================= */
  function demoSlide() {
    return slides.find(s => s.dataset.demo === 'true');
  }
  function demoUrl(device) {
    const frame = device.querySelector('iframe[data-src]');
    if (!frame) return '';
    let url = frame.dataset.src;
    try {
      const u = new URL(url, window.location.href);
      const params = new URLSearchParams(window.location.search);
      const viewer = params.get('viewer');
      if (viewer) u.searchParams.set('viewer', viewer);
      return u.toString();
    } catch (e) { return url; }
  }
  function loadDemoDevice(device) {
    if (!device) return;
    const frame = device.querySelector('iframe[data-src]');
    const loader = device.querySelector('.demo__loader');
    if (!frame || !loader) return;
    if (frame.dataset.loaded === 'true') return;
    frame.dataset.loaded = 'true';
    loader.classList.remove('is-hidden', 'is-error');
    const url = demoUrl(device);
    const timer = setTimeout(function () {
      if (!loader.classList.contains('is-hidden')) loader.classList.add('is-error');
    }, 5000);
    frame.addEventListener('load', function () {
      clearTimeout(timer);
      let ok = true;
      try {
        ok = !!(frame.contentDocument && (frame.contentDocument.querySelector('.stage') || frame.contentDocument.querySelector('.app')));
      } catch (e) { ok = true; }
      if (!ok) { loader.classList.add('is-error'); return; }
      // Ajuste específico del mock móvil: deja la buybar limpia y el CTA
      // de la ficha visible al abrir la demo.
      try {
        const doc = frame.contentDocument;
        doc.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape') {
            try { window.parent.postMessage({ type: 'segunda:demo-exit' }, '*'); } catch (e) {}
          }
        }, true);
        if (device.dataset.device === 'phone') {
          const style = doc.createElement('style');
          style.textContent = '.buybar{padding-bottom:calc(22px + env(safe-area-inset-bottom,0px))!important}.fit-hero .btn{display:none!important}';
          doc.head.appendChild(style);
          const scroller = doc.querySelector('.app-scroll');
          if (scroller) scroller.scrollTop = 58;
        }
      } catch (e) {}
      loader.classList.remove('is-error');
      loader.classList.add('is-hidden');
    }, { once: true });
    frame.src = url;
  }
  function setDemoTab(tab) {
    const slide = demoSlide();
    if (!slide) return;
    demoActiveTab = tab;
    slide.querySelectorAll('[data-demo-tab]').forEach(btn => {
      const active = btn.dataset.demoTab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    slide.querySelectorAll('[data-device]').forEach(device => {
      const active = device.dataset.device === tab;
      device.classList.toggle('is-active', active);
      if (active) loadDemoDevice(device);
    });
    const external = slide.querySelector('[data-demo-external]');
    if (external) {
      const active = slide.querySelector('[data-device].is-active');
      if (active) external.href = demoUrl(active);
    }
  }
  function fitDemoDevice(device) {
    if (!device) return;
    const desktop = device.dataset.device === 'desktop';
    const nativeW = desktop ? 1440 : 430;
    const nativeH = 900;
    const pad = 24; // margen negro alrededor de la demo
    const stageW = 1920;
    const stageH = 1080;
    const scale = Math.min(
      (stageW - pad * 2) / nativeW,
      (stageH - pad * 2) / nativeH
    );
    device.style.setProperty('--demo-focus-scale', scale.toFixed(4));
  }
  function enterDemoFocus() {
    const slide = demoSlide();
    if (!slide || !slide.classList.contains('visible')) return;
    const active = slide.querySelector('[data-device].is-active') || slide.querySelector('[data-device]');
    if (active) loadDemoDevice(active);
    fitDemoDevice(active);
    document.body.classList.add('demo-focus');
  }
  function exitDemoFocus() {
    document.body.classList.remove('demo-focus');
  }
  function bindDemo() {
    const slide = demoSlide();
    if (!slide) return;
    window.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'segunda:demo-exit') exitDemoFocus();
    });
    slide.querySelectorAll('[data-demo-tab]').forEach(btn => {
      btn.addEventListener('click', function () { setDemoTab(btn.dataset.demoTab); });
    });
    slide.querySelectorAll('[data-demo-focus]').forEach(btn => {
      btn.addEventListener('click', enterDemoFocus);
    });
    const external = slide.querySelector('[data-demo-external]');
    if (external) {
      const active = slide.querySelector('[data-device].is-active');
      if (active) external.href = demoUrl(active);
    }
    if (demoExit) demoExit.addEventListener('click', exitDemoFocus);
    setDemoTab(demoActiveTab);
  }

  /* =========================================================
     OVERVIEW
     ========================================================= */
  function buildOverview() {
    if (!overviewGrid) return;
    overviewGrid.innerHTML = '';
    manifest.slides.forEach((entry, i) => {
      const card = document.createElement('button');
      card.className = 'overview__card';
      card.type = 'button';
      card.innerHTML = '<span>' + String(i + 1).padStart(2, '0') + '</span><b>' + (entry.title || 'Slide') + '</b><small>' + (entry.section || '') + '</small>';
      card.addEventListener('click', function () {
        closeOverview();
        show(i);
      });
      overviewGrid.appendChild(card);
    });
  }
  function openOverview() {
    if (!overview) return;
    overview.classList.add('is-open');
    overview.querySelectorAll('.overview__card').forEach((c, i) => c.classList.toggle('is-active', i === current));
  }
  function closeOverview() {
    if (overview) overview.classList.remove('is-open');
  }

  /* =========================================================
     CHROME / STAGE
     ========================================================= */
  function scaleStage() {
    const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = (window.innerWidth - 1920 * factor) / 2;
    const y = (window.innerHeight - 1080 * factor) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + factor + ')';
  }
  function initChrome() {
    window.addEventListener('resize', scaleStage);
    scaleStage();
    function wake() {
      document.body.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { document.body.classList.add('is-idle'); }, 3200);
    }
    window.addEventListener('mousemove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    wake();
  }

  /* =========================================================
     SLIDE SWITCH
     ========================================================= */
  function show(index, opts) {
    opts = opts || {};
    index = Math.max(0, Math.min(index, slides.length - 1));
    if (index === current && !opts.force) return;
    exitDemoFocus();
    slides[current].classList.remove('active', 'visible');
    slides[current].setAttribute('aria-hidden', 'true');
    current = index;
    const slide = slides[current];
    slide.classList.add('active', 'visible');
    slide.setAttribute('aria-hidden', 'false');
    sectionLabel.textContent = slide.dataset.section || '';
    slideCurrent.textContent = String(current + 1).padStart(2, '0');
    progressBar.style.width = ((current + 1) / slides.length * 100) + '%';
    startCounters(slide);
    if (slide.dataset.demo === 'true') {
      const active = slide.querySelector('[data-device].is-active');
      if (active) loadDemoDevice(active);
    }
    try { history.replaceState(null, '', '?slide=' + (current + 1)); } catch (e) {}
  }
  function next() { show(current + 1); }
  function prev() { show(current - 1); }

  /* =========================================================
     KEYBOARD / TOUCH
     ========================================================= */
  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;

      if (e.key === 'Escape') {
        if (document.body.classList.contains('demo-focus')) { exitDemoFocus(); e.preventDefault(); return; }
        if (overview && overview.classList.contains('is-open')) { closeOverview(); e.preventDefault(); return; }
      }
      if (overview && overview.classList.contains('is-open')) {
        if (e.key === 'o' || e.key === 'O' || e.key === 'Escape') { closeOverview(); e.preventDefault(); }
        return;
      }
      if (e.key === 'o' || e.key === 'O') {
        if (overview && overview.classList.contains('is-open')) closeOverview();
        else openOverview();
        e.preventDefault(); return;
      }
      if (e.key === 'd' || e.key === 'D') {
        if (document.body.classList.contains('demo-focus')) exitDemoFocus();
        else enterDemoFocus();
        e.preventDefault(); return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault(); next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault(); prev();
      } else if (e.key === 'Home') {
        e.preventDefault(); show(0);
      } else if (e.key === 'End') {
        e.preventDefault(); show(slides.length - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        else document.exitFullscreen && document.exitFullscreen();
      }
    });
  }
  function initTouch() {
    let touchX = null, touchY = null;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 55 && Math.abs(dy) < 60) { dx < 0 ? next() : prev(); }
      touchX = touchY = null;
    }, { passive: true });
  }

  window.__deck = {
    show: function (i) { show(i); },
    next: next,
    prev: prev,
    get slides() { return slides; },
    get current() { return current; }
  };

  loadSlides();
})();
