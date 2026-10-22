/**
 * Segunda Piel — integración del probador 3D en la demo.
 *
 * Este módulo es autónomo: inyecta su hoja de estilos, construye el drawer y
 * gestiona todo el ciclo de vida del iframe. No requiere markup en index.html.
 *
 * API pública:
 *   FitViewer.open(listing)
 *   FitViewer.close()
 *   FitViewer.setUrl(url)
 *   FitViewer.isOpen()
 *   FitViewer.getUrl()
 *   SegundaPiel.openFit(idOrListing)
 */
(() => {
  'use strict';

  const DEFAULT_VIEWER_URL = 'http://localhost:5173';
  const HANDSHAKE_TIMEOUT_MS = 5000;
  const PANEL_ANIMATION_MS = 240;
  const OVERLAY_FADE_MS = 220;
  const STYLE_ID = 'spv-viewer-css';
  const ROOT_ID = 'spv-viewer-root';
  const READY_TYPES = ['segunda:ready', 'viewer:ready', 'fit:ready'];
  const CLOSE_TYPES = ['segunda:close', 'close'];

  const MANNEQUIN_SVG = `
    <svg class="spv-mannequin" viewBox="0 0 160 280" aria-hidden="true" focusable="false">
      <ellipse class="spv-mannequin-shadow" cx="80" cy="259" rx="39" ry="7"></ellipse>
      <g class="spv-mannequin-body">
        <circle cx="80" cy="33" r="15"></circle>
        <path d="M75 47h10v13H75z"></path>
        <path d="M80 57c-14 0-24 5-27 14l4 66c1 9 7 15 16 15h14c9 0 15-6 16-15l4-66c-3-9-13-14-27-14Z"></path>
        <path class="spv-mannequin-limb" d="M54 71c-7 4-10 11-9 19l5 55"></path>
        <path class="spv-mannequin-limb" d="M106 71c7 4 10 11 9 19l-5 55"></path>
        <path class="spv-mannequin-limb spv-mannequin-leg" d="M69 152l-3 92"></path>
        <path class="spv-mannequin-limb spv-mannequin-leg" d="M91 152l3 92"></path>
        <path class="spv-mannequin-limb" d="M62 247h9"></path>
        <path class="spv-mannequin-limb" d="M89 247h9"></path>
      </g>
    </svg>`;

  const EXTERNAL_ICON = `
    <svg class="spv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 3h6v6"></path>
      <path d="M10 14 21 3"></path>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    </svg>`;

  const RETRY_ICON = `
    <svg class="spv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
      <path d="M3 3v5h5"></path>
    </svg>`;

  const state = {
    open: false,
    url: resolveInitialUrl(),
    listing: null,
    opener: null,
    overlay: 'idle',
    handshakeTimer: null,
    hideTimer: null,
    closeTimer: null,
    loadSeq: 0,
    retryCount: 0,
  };

  let els = null;
  let globalsBound = false;

  /* ------------------------------------------------------------------ */
  /* Inicialización y montaje                                            */
  /* ------------------------------------------------------------------ */

  function resolveInitialUrl() {
    let requested = null;
    try {
      requested = new URLSearchParams(window.location.search).get('viewer');
    } catch (error) {
      requested = null;
    }
    return normalizeViewerUrl(requested) || DEFAULT_VIEWER_URL;
  }

  function normalizeViewerUrl(value) {
    if (value === null || value === undefined) return null;

    let raw = String(value).trim();
    if (!raw) return null;

    if (raw.startsWith('//')) {
      raw = 'http:' + raw;
    } else if (/^[\w.-]+:\d+(?:\/|$)/.test(raw)) {
      // localhost:5173 / 127.0.0.1:5174 sin esquema
      raw = 'http://' + raw;
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      // Rutas relativas: ?viewer=./viewer/ o ?viewer=/viewer/
      try {
        raw = new URL(raw, window.location.href).toString();
      } catch (error) {
        raw = 'http://' + raw;
      }
    }

    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      url.hash = '';
      let normalized = url.toString();
      if (url.pathname === '/' && !url.search) normalized = normalized.replace(/\/$/, '');
      return normalized;
    } catch (error) {
      return null;
    }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ensureStyles() {
    if (!document.head) return;

    const styleLink = document.getElementById(STYLE_ID);
    const alreadyLinked = Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).some((link) => {
      if (link.id === STYLE_ID) return false;
      const href = link.getAttribute('href');
      if (!href) return false;
      try {
        return new URL(href, document.baseURI).pathname.endsWith('/viewer.css');
      } catch (error) {
        return false;
      }
    });

    if (alreadyLinked) {
      if (styleLink) styleLink.remove();
      return;
    }
    if (styleLink) return;

    const script =
      document.currentScript ||
      Array.from(document.scripts)
        .reverse()
        .find((item) => /\/viewer\.js(?:[?#]|$)/.test(item.src));
    const base = script && script.src ? script.src : document.baseURI;

    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = new URL('viewer.css', base).href;
    document.head.append(link);
  }

  function ensureMounted() {
    if (!document.body) return false;
    if (els && els.root && els.root.isConnected) return true;

    let root = document.getElementById(ROOT_ID);
    if (root && !root.querySelector('[data-spv-frame]')) {
      root.remove();
      root = null;
    }
    if (!root) {
      root = buildRoot();
      document.body.append(root);
    }

    els = {
      root,
      scrim: root.querySelector('[data-spv-scrim]'),
      panel: root.querySelector('[data-spv-panel]'),
      close: root.querySelector('[data-spv-close]'),
      subtitle: root.querySelector('[data-spv-subtitle]'),
      openTab: root.querySelector('[data-spv-open-tab]'),
      frame: root.querySelector('[data-spv-frame]'),
      layer: root.querySelector('[data-spv-layer]'),
      loading: root.querySelector('[data-spv-loading]'),
      offline: root.querySelector('[data-spv-offline]'),
      retry: root.querySelector('[data-spv-retry]'),
      offlineTab: root.querySelector('[data-spv-offline-tab]'),
      host: root.querySelector('[data-spv-host]'),
    };

    bindUi();
    updateOfflineCopy();
    return true;
  }

  function buildRoot() {
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'spv';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-spv-root', '');
    root.innerHTML = `
      <div class="spv-scrim" data-spv-scrim aria-hidden="true"></div>
      <section class="spv-panel" data-spv-panel role="dialog" aria-modal="true" aria-labelledby="spv-viewer-title" aria-describedby="spv-viewer-subtitle" tabindex="-1">
        <header class="spv-head">
          <div class="spv-heading">
            <h2 class="spv-title" id="spv-viewer-title" data-spv-title>Probador 3D</h2>
            <p class="spv-subtitle" id="spv-viewer-subtitle" data-spv-subtitle>Preparando la vista previa</p>
          </div>
          <div class="spv-head-actions">
            <a class="spv-tab-link" data-spv-open-tab href="#" target="_blank" rel="noopener noreferrer" title="Abrir en pestaña">
              <span>Abrir en pestaña</span>
              ${EXTERNAL_ICON}
            </a>
            <button class="spv-close" data-spv-close type="button" aria-label="Cerrar probador">
              <svg class="spv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18"></path>
                <path d="M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </header>

        <div class="spv-body">
          <iframe class="spv-frame" data-spv-frame title="Probador 3D" allow="fullscreen; accelerometer; gyroscope" allowfullscreen loading="eager"></iframe>

          <div class="spv-layer" data-spv-layer role="status" aria-live="polite">
            <div class="spv-state is-active" data-spv-loading>
              <div class="spv-stage">
                ${MANNEQUIN_SVG}
                <p class="spv-caption">Cargando probador…</p>
                <span class="spv-progress" aria-hidden="true"><span></span></span>
              </div>
            </div>

            <div class="spv-state" data-spv-offline>
              <div class="spv-stage">
                ${MANNEQUIN_SVG}
                <h3 class="spv-offline-title">El probador se conectará aquí</h3>
                <p class="spv-offline-text">Abre el viewer en <span data-spv-host>localhost:5173</span> o pásalo por <code>?viewer=…</code></p>
                <div class="spv-offline-actions">
                  <button class="spv-retry" data-spv-retry type="button">
                    ${RETRY_ICON}
                    <span>Reintentar</span>
                  </button>
                  <a class="spv-tab-link spv-tab-link--outline" data-spv-offline-tab href="#" target="_blank" rel="noopener noreferrer" title="Abrir en pestaña">
                    <span>Abrir en pestaña</span>
                    ${EXTERNAL_ICON}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
    return root;
  }

  function bindUi() {
    if (!els) return;

    els.close.addEventListener('click', close);
    els.scrim.addEventListener('click', close);
    els.retry.addEventListener('click', retry);
    els.frame.addEventListener('error', onFrameError);

    if (!globalsBound) {
      globalsBound = true;
      document.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('message', onMessage);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Drawer                                                              */
  /* ------------------------------------------------------------------ */

  function open(listing) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => open(listing), { once: true });
      return;
    }

    ensureStyles();
    ensureMounted();
    if (!els) return;

    const wasOpen = state.open;

    if (!wasOpen) {
      const active = document.activeElement;
      const insideViewer = active && typeof active.closest === 'function' && active.closest('.spv');
      state.opener = active && active !== document.body && !insideViewer && typeof active.focus === 'function' ? active : null;
      lockScroll();
    }

    state.open = true;
    state.listing = normalizeListing(listing);
    state.retryCount = 0;
    clearTimeout(state.closeTimer);
    state.closeTimer = null;

    if (els.root.hidden) {
      els.root.hidden = false;
      // Fuerza un reflow para que la transición arranque desde el estado cerrado.
      void els.root.offsetWidth;
    }
    els.root.setAttribute('aria-hidden', 'false');
    els.root.classList.add('is-open');

    updateChrome();
    updateOfflineCopy();
    loadFrame();

    if (!wasOpen) {
      requestAnimationFrame(() => {
        if (!state.open || !els) return;
        try {
          els.panel.focus({ preventScroll: true });
        } catch (error) {
          els.panel.focus();
        }
      });
    }
  }

  function close() {
    if (!state.open) return false;

    state.open = false;
    state.loadSeq += 1;
    clearHandshakeTimer();
    clearTimeout(state.closeTimer);
    clearTimeout(state.hideTimer);
    state.closeTimer = null;
    state.hideTimer = null;

    if (els) {
      els.root.classList.remove('is-open');
      els.root.setAttribute('aria-hidden', 'true');
      els.frame.src = 'about:blank';
      els.frame.style.height = '';
      els.frame.removeAttribute('aria-busy');
      els.frame.setAttribute('tabindex', '-1');

      // Mantiene el estudio visible durante la animación de salida.
      state.overlay = 'loading';
      els.loading.classList.add('is-active');
      els.offline.classList.remove('is-active');
      els.layer.classList.remove('is-ready');
      els.layer.hidden = false;
      els.layer.removeAttribute('aria-hidden');
    }

    unlockScroll();

    const opener = state.opener;
    state.opener = null;
    if (opener && opener.isConnected && typeof opener.focus === 'function') {
      try {
        opener.focus({ preventScroll: true });
      } catch (error) {
        opener.focus();
      }
    }

    const delay = prefersReducedMotion() ? 0 : PANEL_ANIMATION_MS;
    state.closeTimer = setTimeout(() => {
      state.closeTimer = null;
      if (state.open || !els) return;
      els.root.hidden = true;
      els.layer.hidden = true;
      state.overlay = 'idle';
    }, delay);

    return true;
  }

  function retry() {
    if (!state.open) return;
    loadFrame({ retry: true });
  }

  function loadFrame(options) {
    if (!state.open || !els) return;

    const isRetry = !!(options && options.retry);
    clearHandshakeTimer();
    setOverlay('loading');

    state.retryCount = isRetry ? state.retryCount + 1 : 0;

    let url;
    try {
      const target = new URL(buildViewerUrl(state.listing, true));
      if (isRetry) target.searchParams.set('_retry', String(state.retryCount));
      url = target.toString();
    } catch (error) {
      url = DEFAULT_VIEWER_URL;
    }

    const seq = ++state.loadSeq;
    els.frame.style.height = '';
    els.frame.setAttribute('aria-busy', 'true');
    els.frame.src = url;

    state.handshakeTimer = setTimeout(() => {
      if (!state.open || seq !== state.loadSeq || state.overlay === 'ready') return;
      setOverlay('offline');
    }, HANDSHAKE_TIMEOUT_MS);
  }

  function setOverlay(mode) {
    if (!els) return;

    state.overlay = mode;
    clearTimeout(state.hideTimer);
    state.hideTimer = null;

    const isReady = mode === 'ready';
    els.loading.classList.toggle('is-active', mode === 'loading');
    els.offline.classList.toggle('is-active', mode === 'offline');
    els.layer.classList.toggle('is-ready', isReady);
    els.layer.hidden = false;

    if (isReady) {
      els.layer.setAttribute('aria-hidden', 'true');
      els.frame.setAttribute('aria-busy', 'false');
      els.frame.removeAttribute('tabindex');
      const delay = prefersReducedMotion() ? 0 : OVERLAY_FADE_MS;
      state.hideTimer = setTimeout(() => {
        state.hideTimer = null;
        if (state.overlay === 'ready' && els) els.layer.hidden = true;
      }, delay);
    } else {
      els.layer.removeAttribute('aria-hidden');
      els.frame.setAttribute('aria-busy', mode === 'loading' ? 'true' : 'false');
      els.frame.setAttribute('tabindex', '-1');
      if (mode === 'offline') updateOfflineCopy();
    }
  }

  function markReady() {
    if (!state.open || !els) return;
    clearHandshakeTimer();
    if (state.overlay === 'ready') return;
    setOverlay('ready');
  }

  function onFrameError() {
    if (!state.open) return;
    clearHandshakeTimer();
    setOverlay('offline');
  }

  function applyReportedHeight(value) {
    if (!els) return;
    const height = Number(value);
    if (!Number.isFinite(height) || height <= 0) return;
    const px = Math.round(Math.min(Math.max(height, 320), 4000));
    els.frame.style.height = `max(100%, ${px}px)`;
  }

  function updateChrome() {
    if (!els) return;

    const listing = state.listing || {};
    const title = listing.title !== null && listing.title !== undefined ? String(listing.title).trim() : '';
    const size =
      listing.size_label !== null && listing.size_label !== undefined
        ? String(listing.size_label).trim()
        : listing.size !== null && listing.size !== undefined
          ? String(listing.size).trim()
          : '';

    const parts = [];
    if (title) parts.push(title);
    if (size) parts.push(`Talla ${size}`);
    if (!parts.length && listing.id !== null && listing.id !== undefined && String(listing.id)) {
      parts.push(`Anuncio ${listing.id}`);
    }
    const subtitle = parts.join(' · ') || 'Vista previa del anuncio';
    els.subtitle.textContent = subtitle;
    els.subtitle.setAttribute('title', subtitle);

    const standalone = buildViewerUrl(listing, false);
    els.openTab.href = standalone;
    els.offlineTab.href = standalone;

    const label = title ? `Abrir ${title} en una pestaña nueva` : 'Abrir el probador en una pestaña nueva';
    els.openTab.setAttribute('aria-label', label);
    els.offlineTab.setAttribute('aria-label', label);

    els.frame.title = title ? `Probador 3D: ${title}` : 'Probador 3D';
  }

  function updateOfflineCopy() {
    if (!els || !els.host) return;
    let label = state.url;
    try {
      label = new URL(state.url).host;
    } catch (error) {
      // Si no se puede parsear, se muestra la URL tal cual.
    }
    els.host.textContent = label;
  }

  function normalizeListing(listing) {
    if (typeof listing === 'string' || typeof listing === 'number') return { id: String(listing) };
    if (listing && typeof listing === 'object') return listing;
    return {};
  }

  function buildViewerUrl(listing, embed) {
    let url;
    try {
      url = new URL(state.url);
    } catch (error) {
      url = new URL(DEFAULT_VIEWER_URL);
    }

    const id = listing && listing.id !== null && listing.id !== undefined ? String(listing.id) : '';
    if (id) url.searchParams.set('listing', id);
    else url.searchParams.delete('listing');

    if (embed) url.searchParams.set('embed', '1');
    else url.searchParams.delete('embed');

    return url.toString();
  }

  function lockScroll() {
    document.documentElement.classList.add('spv-lock');
  }

  function unlockScroll() {
    document.documentElement.classList.remove('spv-lock');
  }

  function clearHandshakeTimer() {
    clearTimeout(state.handshakeTimer);
    state.handshakeTimer = null;
  }

  /* ------------------------------------------------------------------ */
  /* Eventos globales                                                    */
  /* ------------------------------------------------------------------ */

  function onKeyDown(event) {
    if (!state.open) return;
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    // El drawer es modal: Escape no debe llegar a los atajos de la página.
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }

  function onMessage(event) {
    if (!state.open || !els) return;

    const frameWindow = els.frame.contentWindow;
    const fromFrame = !!frameWindow && event.source === frameWindow;
    // Permite probar el handshake desde la propia página (mismo origen).
    const fromSelf = event.source === window && (event.origin === window.location.origin || event.origin === 'null');
    if (!fromFrame && !fromSelf) return;

    let data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return;
      }
    }
    if (!data || typeof data !== 'object') return;

    const type = typeof data.type === 'string' ? data.type : '';

    if (CLOSE_TYPES.indexOf(type) !== -1) {
      close();
      return;
    }

    if (type === 'segunda:height') {
      applyReportedHeight(data.height);
      return;
    }

    if (data.ready === true || READY_TYPES.indexOf(type) !== -1) markReady();
  }

  /* ------------------------------------------------------------------ */
  /* API pública                                                         */
  /* ------------------------------------------------------------------ */

  function setUrl(url) {
    const next = normalizeViewerUrl(url);
    if (!next) {
      console.warn('[FitViewer] URL de viewer no válida:', url);
      return state.url;
    }

    state.url = next;
    updateOfflineCopy();

    if (state.open) {
      state.retryCount = 0;
      updateChrome();
      loadFrame();
    }

    return state.url;
  }

  function getUrl() {
    return state.url;
  }

  function isOpen() {
    return state.open;
  }

  const api = { open, close, setUrl, isOpen, getUrl };
  window.FitViewer = api;

  const segundaPiel =
    window.SegundaPiel && typeof window.SegundaPiel === 'object'
      ? window.SegundaPiel
      : (window.SegundaPiel = {});
  segundaPiel.openFit = (idOrListing) => {
    if (idOrListing && typeof idOrListing === 'object') return api.open(idOrListing);
    return api.open({ id: idOrListing });
  };

  ensureStyles();
  if (document.body) ensureMounted();
  else document.addEventListener('DOMContentLoaded', ensureMounted, { once: true });
})();

// Integración del viewer real:
// 1. El viewer debe cargarse en el iframe con ?listing=<id>&embed=1
// 2. Al montar, llamar parent.postMessage({type:'segunda:ready'}, '*')
// 3. Para cerrar: parent.postMessage({type:'segunda:close'}, '*')
// 4. URL configurable: ?viewer=http://localhost:5173 o FitViewer.setUrl(url)
