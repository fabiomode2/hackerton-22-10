/* =========================================================
   Vinted desktop mock — outfit check
   Render de feed + panel de detalle sobre window.LISTINGS.
   La demo 3D abre el mismo FitViewer de la demo móvil.
   ========================================================= */
(function () {
  'use strict';

  const listings = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
  const categories = Array.isArray(window.CATEGORIES) ? window.CATEGORIES : ['Todo'];
  const grid = document.getElementById('grid');
  const detail = document.getElementById('detail');
  const categoriesEl = document.getElementById('categories');
  const searchEl = document.getElementById('search');
  const feedCount = document.getElementById('feedCount');
  const sizesEl = document.getElementById('sizes');
  const SIZES = ['XS','S','M','L','XL','38','40','42'];

  const MEASURE_LABELS = {
    pit_to_pit_cm: 'Axila–axila',
    length_cm: 'Largo',
    shoulder_cm: 'Hombro',
    sleeve_cm: 'Manga',
    waist_cm: 'Cintura',
    hips_cm: 'Cadera',
    inseam_cm: 'Entrepierna',
    rise_cm: 'Tiro',
    thigh_cm: 'Muslo',
    hem_cm: 'Bajo'
  };

  const state = {
    category: 'Todo',
    query: '',
    selectedId: listings[0] ? listings[0].id : null
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatPrice(value) {
    return Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function catKey(listing) {
    return (listing.category || '').toLowerCase();
  }
  function selectedListing() {
    return listings.find(function (l) { return l.id === state.selectedId; }) || listings[0] || null;
  }

  function renderCategories() {
    if (!categoriesEl) return;
    categoriesEl.innerHTML = categories.map(function (cat) {
      const key = cat.toLowerCase();
      const count = key === 'todo' ? listings.length : listings.filter(function (l) { return catKey(l) === key; }).length;
      return '<button type="button" data-category="' + escapeHtml(cat) + '"' +
        (state.category === cat ? ' class="is-active"' : '') + '>' +
        '<span style="font-family:inherit;font-size:inherit;color:inherit">' + escapeHtml(cat) + '</span>' +
        '<span>' + count + '</span></button>';
    }).join('');
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return listings.filter(function (l) {
      const byCat = state.category === 'Todo' || catKey(l) === state.category.toLowerCase();
      if (!byCat) return false;
      if (!q) return true;
      return [l.title, l.brand, l.description, l.size_label, l.category_label]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function cardHTML(l) {
    return '<button class="card' + (l.id === state.selectedId ? ' is-selected' : '') + '" type="button" data-listing="' + escapeHtml(l.id) + '" aria-label="' + escapeHtml(l.title) + '">' +
      '<div class="card__media">' +
        '<img src="' + escapeHtml(l.photos[0]) + '" alt="' + escapeHtml(l.title) + '" loading="lazy">' +
        '<span class="card__badge">3D</span>' +
        '<span class="card__fav" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg></span>' +
      '</div>' +
      '<div class="card__body">' +
        '<span class="card__brand">' + escapeHtml(l.brand) + '</span>' +
        '<span class="card__title">' + escapeHtml(l.title) + '</span>' +
        '<div class="card__row"><span class="card__price">' + formatPrice(l.price) + '</span><span class="card__size">' + escapeHtml(l.size_label) + '</span></div>' +
      '</div>' +
    '</button>';
  }

  function renderGrid() {
    const rows = filtered();
    if (feedCount) feedCount.textContent = rows.length + (rows.length === 1 ? ' anuncio' : ' anuncios');
    if (!grid) return;
    grid.innerHTML = rows.length
      ? rows.map(cardHTML).join('')
      : '<div class="empty">No hay anuncios con estos filtros.<br>Prueba con otra categoría o búsqueda.</div>';
  }

  function renderDetail() {
    const l = selectedListing();
    if (!detail) return;
    if (!l) {
      detail.innerHTML = '<div class="detail__body"><p class="detail__desc">Selecciona un anuncio.</p></div>';
      return;
    }
    const measures = (l.garment && l.garment.measurements) || {};
    const measureRows = Object.keys(measures).filter(function (k) { return measures[k] != null; }).map(function (k) {
      return '<div class="detail__measure"><span>' + escapeHtml(MEASURE_LABELS[k] || k) + '</span><b>' + escapeHtml(measures[k]) + ' cm</b></div>';
    }).join('');
    const seller = l.seller || {};

    detail.innerHTML =
      '<div class="detail__media"><img src="' + escapeHtml(l.photos[0]) + '" alt="' + escapeHtml(l.title) + '"><span class="card__badge">PRUEBA 3D</span></div>' +
      '<div class="detail__body">' +
        '<div class="detail__brand">' + escapeHtml(l.brand) + '</div>' +
        '<h2 class="detail__title">' + escapeHtml(l.title) + '</h2>' +
        '<div class="detail__price">' + formatPrice(l.price) + '</div>' +
        '<div class="detail__meta">' + escapeHtml(l.size_label) + ' · ' + escapeHtml(l.condition || 'Buen estado') + '</div>' +
        '<div class="detail__seller">' +
          '<span class="detail__avatar">' + escapeHtml(seller.initials || 'V') + '</span>' +
          '<div><b>' + escapeHtml(seller.name || 'Vendedor') + '</b><span>★ ' + escapeHtml(seller.rating || '4,8') + ' · ' + escapeHtml(seller.reviews || 0) + ' valoraciones · ' + escapeHtml(seller.city || 'España') + '</span></div>' +
        '</div>' +
        '<button class="detail__cta" type="button" data-fit>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/></svg>' +
          'Ver cómo te queda' +
        '</button>' +
        '<div class="detail__section"><h4>Medidas del listing</h4>' + (measureRows || '<p class="detail__desc">Medidas no disponibles.</p>') + '</div>' +
        '<div class="detail__section"><h4>Descripción</h4><p class="detail__desc">' + escapeHtml(l.description) + '</p></div>' +
        '<div class="detail__footer">Mock local para demo · No afiliado a Vinted</div>' +
      '</div>';

    const cta = detail.querySelector('[data-fit]');
    if (cta) {
      cta.addEventListener('click', function () {
        if (window.FitViewer && typeof window.FitViewer.open === 'function') {
          window.FitViewer.open(l);
        }
      });
    }
  }

  function selectListing(id) {
    state.selectedId = id;
    renderGrid();
    renderDetail();
  }

  /* Eventos */
  if (categoriesEl) {
    categoriesEl.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.getAttribute('data-category');
      renderCategories();
      renderGrid();
    });
  }
  if (grid) {
    grid.addEventListener('click', function (event) {
      const card = event.target.closest('[data-listing]');
      if (!card) return;
      selectListing(card.getAttribute('data-listing'));
    });
  }
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      state.query = searchEl.value;
      renderGrid();
    });
  }

  if (sizesEl) sizesEl.innerHTML = SIZES.map(function (s) { return '<span>' + s + '</span>'; }).join('');
  renderCategories();
  renderGrid();
  renderDetail();
})();
