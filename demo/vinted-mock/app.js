/* =========================================================
   Vinted mobile demo — Segunda Piel
   Vanilla JS, History API, offline.
   Integration hook: window.FitViewer.open(listing)
   ========================================================= */

(() => {
  "use strict";

  const FAVORITES_KEY = "sp_favorites";
  const FALLBACK_CATEGORIES = ["Todo", "Mujer", "Hombre", "Niños", "Hogar", "Electrónica"];

  const MEASUREMENT_LABELS = {
    pit_to_pit_cm: "Ancho de pecho",
    length_cm: "Largo total",
    shoulder_cm: "Hombros",
    sleeve_cm: "Largo de manga",
    waist_cm: "Cintura",
    hips_cm: "Cadera",
    inseam_cm: "Entrepierna",
    rise_cm: "Tiro",
    thigh_cm: "Muslo",
    hem_cm: "Bajo",
  };

  const EXPECTED_MEASUREMENTS = {
    tshirt: 4,
    hoodie: 4,
    dress: 3,
    jeans: 5,
    jacket: 4,
    skirt: 2,
  };

  const TONES = [
    { bg: "#e7e0d2", ink: "#75664d" },
    { bg: "#dde5da", ink: "#526450" },
    { bg: "#e1e6e9", ink: "#52616c" },
    { bg: "#ecdfd7", ink: "#7a5c4b" },
    { bg: "#e6e4db", ink: "#635f4c" },
    { bg: "#dbe6e7", ink: "#4b6568" },
    { bg: "#e9e1e5", ink: "#6e5560" },
  ];

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7.25"/><path d="m20.5 20.5-4.1-4.1"/>',
    bell: '<path d="M6.2 8.4a5.8 5.8 0 0 1 11.6 0c0 6.4 2.5 8 2.5 8H3.7s2.5-1.6 2.5-8Z"/><path d="M10.2 20.4a2 2 0 0 0 3.6 0"/>',
    camera: '<path d="M14.6 4.5h-5L7.4 7.2H4.2a1.8 1.8 0 0 0-1.8 1.8v8.6a1.8 1.8 0 0 0 1.8 1.8h15.6a1.8 1.8 0 0 0 1.8-1.8V9a1.8 1.8 0 0 0-1.8-1.8h-3.2l-2-2.7Z"/><circle cx="12" cy="13" r="3.4"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    home: '<path d="m3.2 10.3 8.8-7 8.8 7V20a1 1 0 0 1-1 1h-5.2v-7H9.4v7H4.2a1 1 0 0 1-1-1v-9.7Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.2 21v-.7a7.2 7.2 0 0 1 7.2-7.2h1.2a7.2 7.2 0 0 1 7.2 7.2v.7"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    share: '<path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7.2A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V12"/>',
    star: '<path d="m12 2.6 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.6Z" fill="currentColor" stroke="none"/>',
    dummy: '<circle cx="12" cy="4.2" r="2.1"/><path d="M9.3 8.2c.6 1.7 4.8 1.7 5.4 0l2 5.3-2.2 2.2.9 5.3H8.6l.9-5.3-2.2-2.2 2-5.3Z"/>',
    truck: '<path d="M3.2 5.8h10.6v10.7H3.2z"/><path d="M13.8 9.1h3.8l3.2 3.2v4.2h-7V9.1Z"/><circle cx="7.1" cy="18.2" r="1.9"/><circle cx="17.2" cy="18.2" r="1.9"/>',
    shield: '<path d="M12 3 4.8 5.9v5.2c0 4.9 3 8.2 7.2 9.9 4.2-1.7 7.2-5 7.2-9.9V5.9L12 3Z"/><path d="m9 12 2 2 4-4.2"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    pin: '<path d="M19 10.4c0 4.7-7 10.6-7 10.6s-7-5.9-7-10.6a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10.2" r="2.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    scan: '<path d="M4 8V5.2A1.2 1.2 0 0 1 5.2 4H8"/><path d="M16 4h2.8A1.2 1.2 0 0 1 20 5.2V8"/><path d="M20 16v2.8a1.2 1.2 0 0 1-1.2 1.2H16"/><path d="M8 20H5.2A1.2 1.2 0 0 1 4 18.8V16"/><path d="M8.2 13v-2.6a3.8 3.8 0 0 1 7.6 0V13"/><path d="M7 13h10"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
  };

  const state = {
    query: "",
    category: "Todo",
    favorites: new Set(),
    route: "home",
    currentId: null,
    lastCardId: null,
    homeScroll: 0,
  };

  const dom = {};
  let currentListing = null;
  let toastTimer = 0;
  let viewAbort = null;

  const priceFormatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const numberFormatter = new Intl.NumberFormat("es-ES");

  /* ---------- small helpers ---------- */

  function icon(name, size = 20) {
    const content = ICONS[name] || ICONS.tag;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
  }

  function escapeHtml(value) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => map[character]);
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function formatPrice(value) {
    const number = Number(value);
    return Number.isFinite(number) ? priceFormatter.format(number) : "—";
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? numberFormatter.format(number) : "0";
  }

  function formatRating(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : null;
  }

  function firstCharacter(value) {
    const match = String(value == null ? "" : value).trim().match(/[\p{L}\p{N}]/u);
    return match ? match[0].toUpperCase() : "·";
  }

  function initialsFor(name) {
    const words = String(name == null ? "" : name).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "V";
    return words.slice(0, 2).map((word) => firstCharacter(word)).join("");
  }

  function toneFor(seed) {
    const text = String(seed == null ? "" : seed);
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return TONES[hash % TONES.length];
  }

  function getListings() {
    return Array.isArray(window.LISTINGS)
      ? window.LISTINGS.filter((listing) => listing && typeof listing === "object" && listing.id != null)
      : [];
  }

  function findListing(id) {
    if (id == null) return null;
    return getListings().find((listing) => String(listing.id) === String(id)) || null;
  }

  function getCategories() {
    const raw = Array.isArray(window.CATEGORIES) && window.CATEGORIES.length
      ? window.CATEGORIES
      : FALLBACK_CATEGORIES;
    const categories = raw.filter((category) => typeof category === "string" && category.trim());
    if (!categories.some((category) => normalize(category) === "todo")) categories.unshift("Todo");
    if (!state.category || !categories.some((category) => normalize(category) === normalize(state.category))) {
      state.category = categories[0] || "Todo";
    }
    return categories;
  }

  function getPhotos(listing) {
    return Array.isArray(listing.photos)
      ? listing.photos.filter((photo) => typeof photo === "string" && photo.trim())
      : [];
  }

  function sizeLabel(listing) {
    return listing.size_label ? `Talla ${listing.size_label}` : "Talla única";
  }

  function listingMeta(listing) {
    const parts = [];
    if (listing.brand) parts.push(listing.brand);
    if (listing.size_label) parts.push(`Talla ${listing.size_label}`);
    else if (listing.category_label) parts.push(listing.category_label);
    return parts.join(" · ") || "Prenda de segunda mano";
  }

  function relativeTime(value) {
    if (value == null || value === "") return "Recién publicado";
    let timestamp;
    if (value instanceof Date) {
      timestamp = value.getTime();
    } else if (typeof value === "number") {
      timestamp = value < 1e12 ? value * 1000 : value;
    } else {
      const text = String(value).trim();
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) return text;
      timestamp = parsed.getTime();
    }
    if (!Number.isFinite(timestamp)) return "Recién publicado";

    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return "Ahora mismo";
    const minutes = Math.floor(diff / (60 * 1000));
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "hace 1 día";
    if (days < 7) return `hace ${days} días`;
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(timestamp));
  }

  function joinedYear(value) {
    if (value == null || value === "") return "";
    const text = String(value).trim();
    if (/^\d{4}$/.test(text)) return text;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : String(parsed.getFullYear());
  }

  function shippingLabel(value) {
    if (value == null) return "3,49 € · 2-4 días";
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return formatPrice(value);
    if (typeof value === "object") {
      if (typeof value.label === "string" && value.label.trim()) return value.label.trim();
      const cost = value.price ?? value.cost ?? value.amount;
      const minimum = value.min_days ?? value.days_min;
      const maximum = value.max_days ?? value.days_max;
      const days = typeof value.days === "string"
        ? value.days
        : Number.isFinite(Number(minimum)) && Number.isFinite(Number(maximum))
          ? `${minimum}-${maximum} días`
          : Number.isFinite(Number(minimum))
            ? `${minimum} días`
            : "";
      if (cost != null && days) return `${formatPrice(cost)} · ${days}`;
      if (cost != null) return formatPrice(cost);
      if (days) return days;
      if (typeof value.description === "string" && value.description.trim()) return value.description.trim();
    }
    return "3,49 € · 2-4 días";
  }

  function measurementEntries(listing) {
    const measurements = listing.garment && listing.garment.measurements;
    if (!measurements || typeof measurements !== "object") return [];
    return Object.keys(measurements)
      .filter((key) => Number.isFinite(Number(measurements[key])))
      .map((key) => ({
        key,
        label: MEASUREMENT_LABELS[key] || key.replace(/_cm$/, "").replace(/_/g, " "),
        value: Number(measurements[key]),
      }));
  }

  function measurementCompleteness(listing, entries) {
    const type = listing.garment && listing.garment.type;
    const expected = Number.isFinite(EXPECTED_MEASUREMENTS[type])
      ? EXPECTED_MEASUREMENTS[type]
      : entries.length;
    return entries.length > 0 && entries.length >= expected;
  }

  function isViewerOpen() {
    try {
      return Boolean(
        window.FitViewer
        && typeof window.FitViewer.isOpen === "function"
        && window.FitViewer.isOpen()
      );
    } catch (error) {
      return false;
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function plainClick(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function currentUrlForHome() {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    url.hash = "";
    return `${url.pathname}${url.search}`;
  }

  function currentUrlForDetail(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("id", String(id));
    url.hash = "";
    return `${url.pathname}${url.search}`;
  }

  /* ---------- storage ---------- */

  function loadFavorites() {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveFavorites() {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
    } catch (error) {
      /* Storage can be unavailable in private/incognito modes. The UI still works. */
    }
  }

  /* ---------- toast / announcement ---------- */

  function hideToast() {
    window.clearTimeout(toastTimer);
    if (dom.toast) dom.toast.classList.remove("is-visible");
  }

  function showToast(message) {
    if (!dom.toast) return;
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      dom.toast.classList.remove("is-visible");
    }, 2800);
  }

  function announce(message) {
    if (!dom.srLive) return;
    dom.srLive.textContent = message;
  }

  /* ---------- data views ---------- */

  function defaultEmptyState() {
    return `
      <div class="empty-state">
        <span class="empty-icon">${icon("tag", 24)}</span>
        <h2>No hay anuncios cargados</h2>
        <p>La demo se llenará en cuanto estén disponibles los datos del catálogo.</p>
      </div>
    `;
  }

  function filteredEmptyState() {
    return `
      <div class="empty-state">
        <span class="empty-icon">${icon("search", 24)}</span>
        <h2>No encontramos nada</h2>
        <p>Prueba con otra búsqueda o cambia de categoría para descubrir más prendas.</p>
        <button class="btn btn--outline" type="button" data-action="reset-filters">Quitar filtros</button>
      </div>
    `;
  }

  function filteredListings() {
    const query = normalize(state.query);
    const category = normalize(state.category);
    return getListings().filter((listing) => {
      if (category && category !== "todo") {
        const matchesCategory = [listing.category, listing.category_label]
          .some((value) => normalize(value) === category);
        if (!matchesCategory) return false;
      }
      if (!query) return true;
      return normalize(`${listing.title || ""} ${listing.brand || ""}`).includes(query);
    });
  }

  function countLabel(count) {
    return count === 1 ? "1 artículo" : `${formatNumber(count)} artículos`;
  }

  function photoHTML(listing, options = {}) {
    const index = Number.isInteger(options.index) ? options.index : 0;
    const photos = getPhotos(listing);
    const source = photos[index] || "";
    const tone = toneFor(listing.brand || listing.id || listing.title);
    const brand = listing.brand ? escapeHtml(listing.brand) : "";
    const altText = options.alt
      || `${listing.title || "Prenda"}${photos.length > 1 ? ` — foto ${index + 1}` : ""}`;
    const classes = ["photo"];
    if (options.detail) classes.push("photo--detail");
    if (!source) classes.push("has-fallback");

    return `
      <div class="${classes.join(" ")}" data-photo style="--ph-bg:${tone.bg};--ph-ink:${tone.ink}">
        <div class="photo-fallback" aria-hidden="true">
          <span class="ph-mono">${escapeHtml(firstCharacter(listing.brand || listing.title))}</span>
          ${brand ? `<span class="ph-name">${brand}</span>` : ""}
        </div>
        <div class="photo-skeleton" aria-hidden="true"></div>
        ${source
          ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(altText)}" ${options.eager ? "" : 'loading="lazy"'} decoding="async">`
          : ""}
      </div>
    `;
  }

  function wirePhotos(root) {
    root.querySelectorAll("[data-photo]").forEach((photo) => {
      if (photo.dataset.wired === "true") return;
      photo.dataset.wired = "true";
      const image = photo.querySelector("img");
      if (!image) {
        photo.classList.add("has-fallback");
        return;
      }

      const settle = (loaded) => {
        photo.classList.toggle("is-loaded", loaded);
        photo.classList.toggle("has-fallback", !loaded);
      };

      if (image.complete) {
        settle(image.naturalWidth > 0);
      } else {
        image.addEventListener("load", () => settle(true), { once: true });
        image.addEventListener("error", () => settle(false), { once: true });
      }
    });
  }

  function favoriteButtonHTML(listing, options = {}) {
    const active = state.favorites.has(listing.id);
    const tag = options.header ? "header-fav" : "fav-btn";
    const extra = options.gallery ? " gallery-fav" : "";
    return `
      <button class="${tag} js-fav${extra}${active ? " is-fav" : ""}"
        type="button"
        data-fav-id="${escapeHtml(listing.id)}"
        aria-pressed="${active}"
        aria-label="${active ? "Quitar de favoritos" : "Añadir a favoritos"}: ${escapeHtml(listing.title || "anuncio")}">
        ${icon("heart", options.size || (options.header ? 21 : 17))}
      </button>
    `;
  }

  function cardHTML(listing, index) {
    const likes = (Number(listing.likes) || 0) + (state.favorites.has(listing.id) ? 1 : 0);
    const price = formatPrice(listing.price);
    const aria = `${listing.title || "Anuncio"}, ${price}, ${listingMeta(listing)}`;
    return `
      <article class="listing-card">
        <a class="card-link" href="${escapeHtml(currentUrlForDetail(listing.id))}"
          data-route-id="${escapeHtml(listing.id)}"
          aria-label="${escapeHtml(aria)}">
          <div class="card-media">
            ${photoHTML(listing, { eager: index < 4 })}
            ${listing.badge ? `<span class="photo-badge">${escapeHtml(listing.badge)}</span>` : ""}
            ${index === 0 ? `<span class="tag-3d">${icon("scan", 10)} Prueba 3D</span>` : ""}
          </div>
          <div class="card-info">
            <p class="card-price">${price}</p>
            <p class="card-meta">${escapeHtml(listingMeta(listing))}</p>
            <p class="card-likes">
              ${icon("heart", 11)}
              <span data-likes-id="${escapeHtml(listing.id)}">${formatNumber(likes)}</span>
              <span class="sr-only">me gusta</span>
            </p>
          </div>
        </a>
        ${favoriteButtonHTML(listing)}
      </article>
    `;
  }

  function gridHTML(listings) {
    if (!getListings().length) return defaultEmptyState();
    if (!listings.length) return filteredEmptyState();
    return listings.map((listing, index) => cardHTML(listing, index)).join("");
  }

  function chipsHTML() {
    return getCategories().map((category) => {
      const active = normalize(category) === normalize(state.category);
      return `
        <button class="chip${active ? " is-active" : ""}" type="button"
          data-category="${escapeHtml(category)}" aria-pressed="${active}">
          ${escapeHtml(category)}
        </button>
      `;
    }).join("");
  }

  function homeHTML() {
    const results = filteredListings();
    return `
      <main class="home">
        <h1 class="sr-only">Vinted · anuncios de segunda mano</h1>
        <header class="home-header">
          <div class="home-top">
            <a class="wordmark" href="${escapeHtml(currentUrlForHome())}" data-home-link aria-label="Vinted, ir al inicio">Vinted</a>
            <button class="icon-btn" type="button" data-action="notifications" aria-label="Notificaciones">
              ${icon("bell", 22)}
              <span class="bell-dot" aria-hidden="true"></span>
            </button>
          </div>
          <div class="search-box" role="search">
            ${icon("search", 18)}
            <label class="sr-only" for="search-input">Buscar artículos</label>
            <input class="search-input" id="search-input" type="search" inputmode="search"
              placeholder="Buscar artículos" autocomplete="off" autocapitalize="none" spellcheck="false"
              value="${escapeHtml(state.query)}">
            <button class="camera-btn" type="button" data-action="camera" aria-label="Buscar con una foto">
              ${icon("camera", 20)}
            </button>
          </div>
          <div class="chips" aria-label="Filtrar por categoría">
            ${chipsHTML()}
          </div>
        </header>
        <div class="results-bar">
          <p class="results-count" id="results-count" aria-live="polite">${countLabel(results.length)}</p>
          <button class="sort-btn" type="button" data-action="sort">
            ${icon("sliders", 13)} Ordenar
          </button>
        </div>
        <div class="listing-grid" id="listing-grid" aria-label="Anuncios">
          ${gridHTML(results)}
        </div>
      </main>
    `;
  }

  function fitHeroHTML(listing) {
    return `
      <aside class="fit-hero" aria-labelledby="fit-hero-title">
        <div class="fit-hero-head">
          <span class="fit-hero-icon" aria-hidden="true">${icon("dummy", 21)}</span>
          <div class="fit-hero-copy">
            <h2 id="fit-hero-title">Pruébatelo en 3D</h2>
            <p>Mira cómo te queda con tus medidas antes de comprar</p>
          </div>
        </div>
        <button class="btn btn--teal js-fit-cta" type="button"
          data-fit-open="${escapeHtml(listing.id)}"
          aria-label="Ver cómo me queda: abrir probador 3D">
          ${icon("scan", 16)} Ver cómo me queda
        </button>
      </aside>
    `;
  }

  function sellerHTML(listing) {
    const seller = listing.seller && typeof listing.seller === "object" ? listing.seller : {};
    const name = seller.name || "Vendedor particular";
    const initials = seller.initials || initialsFor(name);
    const rating = formatRating(seller.rating);
    const reviews = Number(seller.reviews);
    const city = seller.city || "";
    const joined = joinedYear(seller.joined);
    const tone = toneFor(name);

    const ratingMarkup = rating
      ? `<span class="star" aria-hidden="true">${icon("star", 10)}</span>
         <strong>${rating}</strong>
         <span>(${formatNumber(Number.isFinite(reviews) ? reviews : 0)})</span>`
      : `<span>Sin valoraciones</span>`;

    return `
      <section class="section seller-section" aria-labelledby="seller-heading">
        <h2 class="sr-only" id="seller-heading">Vendedor</h2>
        <div class="seller-row">
          <span class="avatar" style="--av-bg:${tone.bg};--av-ink:${tone.ink}" aria-hidden="true">${escapeHtml(initials)}</span>
          <div class="seller-copy">
            <p class="seller-name">${escapeHtml(name)}</p>
            <p class="seller-meta">
              ${ratingMarkup}
              ${city ? `<span class="dot" aria-hidden="true">·</span>
                <span class="seller-city">${icon("pin", 10)} ${escapeHtml(city)}</span>` : ""}
            </p>
          </div>
          <button class="btn btn--outline btn--tiny" type="button" data-action="profile">Ver perfil</button>
        </div>
        ${joined ? `<p class="seller-joined">En Vinted desde ${escapeHtml(joined)}</p>` : ""}
      </section>
    `;
  }

  function descriptionHTML(listing) {
    const description = typeof listing.description === "string" && listing.description.trim()
      ? listing.description.trim()
      : "El vendedor no ha añadido una descripción.";
    return `
      <section class="section" aria-labelledby="description-heading">
        <h2 class="section-title" id="description-heading">Descripción</h2>
        <div class="description"><p>${escapeHtml(description).replace(/\n/g, "<br>")}</p></div>
      </section>
    `;
  }

  function measurementsHTML(listing) {
    const entries = measurementEntries(listing);
    const complete = measurementCompleteness(listing, entries);
    const rows = entries.map((entry) => `
      <tr>
        <th scope="row">${escapeHtml(entry.label)}</th>
        <td>${formatNumber(entry.value)} cm</td>
      </tr>
    `).join("");

    return `
      <section class="section" aria-labelledby="measurements-heading">
        <div class="measure-head">
          <h2 class="section-title" id="measurements-heading">Medidas del anuncio</h2>
          <span class="confidence ${complete ? "confidence--complete" : "confidence--partial"}">
            ${complete ? icon("check", 10) : ""}${complete ? "Completo" : "Parcial"}
          </span>
        </div>
        ${entries.length
          ? `<table class="measure-table"><tbody>${rows}</tbody></table>`
          : `<p class="measure-hint">El vendedor no ha indicado medidas de esta prenda.</p>`}
        <p class="measure-hint">${complete
          ? "Tomadas con la prenda plana. Margen aproximado de ±1 cm."
          : "Faltan medidas: el resultado del probador será orientativo."}</p>
      </section>
    `;
  }

  function assuranceHTML(listing) {
    return `
      <section class="section" aria-labelledby="shipping-heading">
        <h2 class="section-title" id="shipping-heading">Envío y compra</h2>
        <div class="assurance-row">
          <span class="assurance-icon" aria-hidden="true">${icon("truck", 18)}</span>
          <div class="assurance-copy">
            <h3>Envío a domicilio</h3>
            <p>Pago online y seguimiento del pedido.</p>
          </div>
          <span class="assurance-value">${escapeHtml(shippingLabel(listing.shipping))}</span>
        </div>
        <div class="assurance-row">
          <span class="assurance-icon" aria-hidden="true">${icon("shield", 18)}</span>
          <div class="assurance-copy">
            <h3>Compra protegida</h3>
            <p>Reembolso si el artículo no es como se describe.</p>
          </div>
        </div>
      </section>
    `;
  }

  function relatedListings(listing) {
    const others = getListings().filter((item) => String(item.id) !== String(listing.id));
    const sellerName = listing.seller && listing.seller.name;
    const sameSeller = sellerName
      ? others.filter((item) => item.seller && item.seller.name === sellerName)
      : [];
    const rest = others.filter((item) => !sameSeller.includes(item));
    const picks = [...sameSeller, ...rest].slice(0, 4);
    return { picks, sameSellerCount: sameSeller.length };
  }

  function relatedHTML(listing) {
    const { picks, sameSellerCount } = relatedListings(listing);
    if (!picks.length) return "";
    const heading = sameSellerCount >= 2 ? "Más de este vendedor" : "También te puede gustar";
    const cards = picks.map((item) => {
      const price = formatPrice(item.price);
      return `
        <a class="related-card" href="${escapeHtml(currentUrlForDetail(item.id))}"
          data-route-id="${escapeHtml(item.id)}"
          aria-label="${escapeHtml(`${item.title || "Anuncio"}, ${price}`)}">
          <div class="related-photo">${photoHTML(item, { eager: false })}</div>
          <p class="related-price">${price}</p>
          <p class="related-meta">${escapeHtml(listingMeta(item))}</p>
        </a>
      `;
    }).join("");

    return `
      <section class="related-section" aria-labelledby="related-heading">
        <div class="related-head">
          <h2 id="related-heading">${heading}</h2>
        </div>
        <div class="related-row">${cards}</div>
      </section>
    `;
  }

  function galleryHTML(listing) {
    const photos = getPhotos(listing);
    const total = Math.max(1, photos.length);
    const slides = Array.from({ length: total }, (_, index) => `
      <div class="slide" role="group" aria-roledescription="foto" aria-label="${index + 1} de ${total}">
        ${photoHTML(listing, {
          index,
          detail: true,
          eager: true,
          alt: `${listing.title || "Prenda"} — foto ${index + 1} de ${total}`,
        })}
      </div>
    `).join("");

    const dots = total > 1
      ? `<div class="gallery-dots" role="group" aria-label="Elegir foto">
          ${Array.from({ length: total }, (_, index) => `
            <button class="gallery-dot${index === 0 ? " is-active" : ""}" type="button"
              data-slide="${index}" aria-label="Ver foto ${index + 1}"${index === 0 ? ' aria-current="true"' : ""}></button>
          `).join("")}
        </div>`
      : "";
    const counter = total > 1
      ? `<span class="gallery-counter" aria-hidden="true"><span id="gallery-current">1</span>/${total}</span>`
      : "";

    return `
      <div class="gallery">
        <div class="carousel" id="detail-carousel" tabindex="0"
          aria-label="Fotos del anuncio. Usa las flechas izquierda y derecha para navegar.">
          ${slides}
        </div>
        <div class="gallery-overlay">
          ${favoriteButtonHTML(listing, { gallery: true, size: 18 })}
          ${dots}
          ${counter}
        </div>
      </div>
    `;
  }

  function buyBarHTML(listing) {
    return `
      <div class="buybar" role="region" aria-label="Comprar este artículo">
        <div class="buybar-price">
          <span class="buybar-amount">${formatPrice(listing.price)}</span>
          <span class="buybar-size">${escapeHtml(sizeLabel(listing))}</span>
        </div>
        <button class="btn btn--teal js-fit-cta" type="button"
          data-fit-open="${escapeHtml(listing.id)}"
          aria-label="Ver cómo me queda: abrir probador 3D">
          ${icon("scan", 16)} Ver cómo me queda
        </button>
      </div>
    `;
  }

  function detailHTML(listing) {
    const likes = (Number(listing.likes) || 0) + (state.favorites.has(listing.id) ? 1 : 0);
    const condition = listing.condition || "Buen estado";
    const brand = listing.brand || "Sin marca";
    const published = relativeTime(listing.published);

    return `
      <main class="detail">
        <header class="detail-header">
          <button class="icon-btn" type="button" data-action="back" aria-label="Volver a los resultados">
            ${icon("arrow-left", 22)}
          </button>
          <span class="detail-header-title" aria-hidden="true">Anuncio</span>
          <div class="detail-actions">
            <button class="icon-btn" type="button" data-action="share" aria-label="Compartir anuncio">
              ${icon("share", 20)}
            </button>
            ${favoriteButtonHTML(listing, { header: true })}
          </div>
        </header>

        ${galleryHTML(listing)}

        <section class="detail-info" aria-labelledby="detail-title">
          <p class="detail-price">${formatPrice(listing.price)}</p>
          <h1 class="detail-title" id="detail-title" tabindex="-1">${escapeHtml(listing.title || "Anuncio")}</h1>
          <p class="detail-meta">
            ${escapeHtml(sizeLabel(listing))}<span class="sep" aria-hidden="true">·</span>${escapeHtml(condition)}
          </p>
          <p class="detail-brand">${escapeHtml(brand)}</p>
          <div class="detail-stats">
            <span>${escapeHtml(published)}</span>
            <span class="dot" aria-hidden="true">·</span>
            <span class="detail-likes">
              ${icon("heart", 12)}
              <span data-likes-id="${escapeHtml(listing.id)}">${formatNumber(likes)}</span>
              <span>me gusta</span>
            </span>
          </div>
        </section>

        ${fitHeroHTML(listing)}
        ${sellerHTML(listing)}
        ${descriptionHTML(listing)}
        ${measurementsHTML(listing)}
        ${assuranceHTML(listing)}
        ${relatedHTML(listing)}

        <footer class="detail-footer">Mock local para demo · No afiliado a Vinted</footer>
      </main>
    `;
  }

  function renderTabbar() {
    const tabs = [
      { id: "home", label: "Inicio", icon: "home" },
      { id: "search", label: "Buscar", icon: "search" },
      { id: "sell", label: "Vender", icon: "plus", primary: true },
      { id: "messages", label: "Mensajes", icon: "message" },
      { id: "profile", label: "Perfil", icon: "user" },
    ];

    dom.tabbar.innerHTML = tabs.map((tab) => {
      const active = tab.id === "home" && state.route === "home";
      if (tab.primary) {
        return `
          <button class="tab tab--sell" type="button" data-tab="${tab.id}" aria-label="Vender un artículo">
            <span class="sell-bubble">${icon("plus", 22)}</span>
            <span class="tab-label">${tab.label}</span>
          </button>
        `;
      }
      return `
        <button class="tab${active ? " is-active" : ""}" type="button" data-tab="${tab.id}"
          ${active ? 'aria-current="page"' : ""}>
          ${icon(tab.icon, 21)}
          <span class="tab-label">${tab.label}</span>
        </button>
      `;
    }).join("");
    dom.tabbar.hidden = false;
  }

  function beginView() {
    if (viewAbort) viewAbort.abort();
    viewAbort = new AbortController();
    return viewAbort.signal;
  }

  function setupCarousel(signal) {
    const carousel = dom.appScroll.querySelector("#detail-carousel");
    if (!carousel) return;

    const dots = Array.from(dom.appScroll.querySelectorAll(".gallery-dot"));
    const current = dom.appScroll.querySelector("#gallery-current");
    const slideCount = carousel.querySelectorAll(".slide").length;
    if (!slideCount) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const width = carousel.clientWidth || 1;
      const index = Math.min(slideCount - 1, Math.max(0, Math.round(carousel.scrollLeft / width)));
      carousel.dataset.index = String(index);
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle("is-active", active);
        if (active) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
      if (current) current.textContent = String(index + 1);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const goTo = (index) => {
      const next = Math.min(slideCount - 1, Math.max(0, index));
      carousel.scrollTo({
        left: next * carousel.clientWidth,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    };

    carousel.addEventListener("scroll", onScroll, { passive: true, signal });
    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        goTo(Number(dot.dataset.slide) || 0);
      }, { signal });
    });

    carousel.addEventListener("keydown", (event) => {
      const currentIndex = Number(carousel.dataset.index) || 0;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(currentIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(currentIndex - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(slideCount - 1);
      }
    }, { signal });

    window.addEventListener("resize", () => {
      const index = Number(carousel.dataset.index) || 0;
      carousel.scrollTo({ left: index * carousel.clientWidth, behavior: "auto" });
      update();
    }, { signal });

    window.requestAnimationFrame(update);
  }

  function renderHome(options = {}) {
    state.route = "home";
    state.currentId = null;
    currentListing = null;
    beginView();
    hideToast();

    dom.screen.classList.remove("has-buybar");
    dom.buybarSlot.replaceChildren();
    dom.appScroll.innerHTML = homeHTML();
    wirePhotos(dom.appScroll);
    renderTabbar();

    const previousTitle = "Vinted · Moda de segunda mano";
    document.title = previousTitle;

    const targetScroll = options.restoreScroll ? state.homeScroll : 0;
    dom.appScroll.scrollTop = targetScroll;
    window.requestAnimationFrame(() => {
      dom.appScroll.scrollTop = targetScroll;
      if (options.restoreFocus) {
        const link = Array.from(dom.appScroll.querySelectorAll("[data-route-id]"))
          .find((element) => element.getAttribute("data-route-id") === state.lastCardId);
        if (link) link.focus({ preventScroll: true });
      }
    });

    if (options.focusSearch) {
      window.requestAnimationFrame(() => {
        const input = dom.appScroll.querySelector("#search-input");
        if (input) input.focus({ preventScroll: true });
      });
    }

    announce("Inicio. " + countLabel(filteredListings().length));
  }

  function renderDetail(listing, options = {}) {
    state.route = "detail";
    state.currentId = String(listing.id);
    currentListing = listing;
    const signal = beginView();
    hideToast();

    dom.screen.classList.add("has-buybar");
    dom.tabbar.hidden = true;
    dom.buybarSlot.innerHTML = buyBarHTML(listing);
    dom.appScroll.innerHTML = detailHTML(listing);
    wirePhotos(dom.appScroll);
    setupCarousel(signal);

    document.title = `${listing.title || "Anuncio"} · ${formatPrice(listing.price)} · Vinted`;
    dom.appScroll.scrollTop = 0;

    window.requestAnimationFrame(() => {
      dom.appScroll.scrollTop = 0;
      if (options.focusTitle) {
        const title = dom.appScroll.querySelector("#detail-title");
        if (title) title.focus({ preventScroll: true });
      }
    });

    announce(`Anuncio: ${listing.title || "sin título"}. ${formatPrice(listing.price)}.`);
  }

  /* ---------- filtering ---------- */

  function syncChips() {
    dom.appScroll.querySelectorAll("[data-category]").forEach((chip) => {
      const active = normalize(chip.getAttribute("data-category")) === normalize(state.category);
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  function applyFilters() {
    const grid = dom.appScroll.querySelector("#listing-grid");
    if (!grid) return;
    const results = filteredListings();
    grid.innerHTML = gridHTML(results);
    wirePhotos(grid);

    const count = dom.appScroll.querySelector("#results-count");
    if (count) count.textContent = countLabel(results.length);
    syncChips();
  }

  function scrollHomeToTop(behavior) {
    dom.appScroll.scrollTo({
      top: 0,
      behavior: behavior || (prefersReducedMotion() ? "auto" : "smooth"),
    });
  }

  function setCategory(category) {
    if (normalize(category) === normalize(state.category)) return;
    state.category = category;
    syncChips();
    applyFilters();
    scrollHomeToTop();
  }

  function resetFilters() {
    state.query = "";
    state.category = getCategories()[0] || "Todo";
    const input = dom.appScroll.querySelector("#search-input");
    if (input) input.value = "";
    syncChips();
    applyFilters();
    scrollHomeToTop("auto");
  }

  /* ---------- favorites ---------- */

  function updateFavoriteButton(button, listing, active) {
    button.classList.toggle("is-fav", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      `${active ? "Quitar de favoritos" : "Añadir a favoritos"}: ${listing.title || "anuncio"}`
    );
    if (active) {
      button.classList.remove("is-bump");
      void button.offsetWidth;
      button.classList.add("is-bump");
    }
  }

  function refreshFavoriteVisuals(id) {
    const listing = findListing(id);
    if (!listing) return;
    const active = state.favorites.has(id);
    const likes = (Number(listing.likes) || 0) + (active ? 1 : 0);

    document.querySelectorAll(".js-fav").forEach((button) => {
      if (button.getAttribute("data-fav-id") === String(id)) {
        updateFavoriteButton(button, listing, active);
      }
    });
    document.querySelectorAll("[data-likes-id]").forEach((element) => {
      if (element.getAttribute("data-likes-id") === String(id)) {
        element.textContent = formatNumber(likes);
      }
    });
  }

  function toggleFavorite(id) {
    if (!findListing(id)) return;
    const active = !state.favorites.has(id);
    if (active) state.favorites.add(id);
    else state.favorites.delete(id);
    saveFavorites();
    refreshFavoriteVisuals(id);
  }

  /* ---------- navigation ---------- */

  function openListing(id) {
    const listing = findListing(id);
    if (!listing) {
      showToast("Ese anuncio ya no está disponible.");
      return;
    }
    if (state.route === "detail" && state.currentId === String(listing.id)) {
      dom.appScroll.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      return;
    }

    const fromHome = state.route === "home";
    if (fromHome) {
      state.homeScroll = dom.appScroll.scrollTop;
      state.lastCardId = String(listing.id);
    }

    window.history.pushState(
      { sp: true, view: "detail", id: String(listing.id), fromHome },
      "",
      currentUrlForDetail(listing.id)
    );
    renderDetail(listing, { focusTitle: true });
  }

  function goBackToHome() {
    const historyState = window.history.state;
    if (historyState && historyState.sp && historyState.view === "detail" && !historyState.deep) {
      window.history.back();
      return;
    }

    window.history.replaceState({ sp: true, view: "home" }, "", currentUrlForHome());
    renderHome({ restoreScroll: true });
  }

  function goHomeFromLogo() {
    if (state.route === "home") {
      scrollHomeToTop();
      return;
    }
    window.history.pushState({ sp: true, view: "home" }, "", currentUrlForHome());
    renderHome();
  }

  function handlePopState() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      const listing = findListing(id);
      if (listing) {
        renderDetail(listing, { focusTitle: true });
      } else {
        window.history.replaceState({ sp: true, view: "home" }, "", currentUrlForHome());
        renderHome({ restoreScroll: true });
        showToast("Ese anuncio ya no está disponible.");
      }
      return;
    }
    renderHome({ restoreScroll: true, restoreFocus: true });
  }

  /* ---------- viewer hook ---------- */

  function openFitViewer(id) {
    const listing = findListing(id) || currentListing;
    if (!listing) return;

    const viewer = window.FitViewer;
    if (viewer && typeof viewer.open === "function") {
      try {
        const result = viewer.open(listing);
        if (result && typeof result.catch === "function") {
          result.catch(() => showToast("No se pudo abrir el probador 3D."));
        }
        return;
      } catch (error) {
        showToast("No se pudo abrir el probador 3D.");
        return;
      }
    }
    showToast("El probador 3D no está disponible ahora mismo.");
  }

  /* ---------- share ---------- */

  async function shareCurrentListing() {
    if (!currentListing) return;
    const url = `${window.location.origin}${currentUrlForDetail(currentListing.id)}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        showToast("Enlace del anuncio copiado.");
      } else {
        showToast("Compartir estará disponible en la app completa.");
      }
    } catch (error) {
      showToast("No se pudo copiar el enlace.");
    }
  }

  /* ---------- events ---------- */

  function handleScreenClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const favorite = target.closest(".js-fav");
    if (favorite) {
      event.preventDefault();
      toggleFavorite(favorite.getAttribute("data-fav-id"));
      return;
    }

    const route = target.closest("[data-route-id]");
    if (route && plainClick(event)) {
      event.preventDefault();
      openListing(route.getAttribute("data-route-id"));
      return;
    }

    const fit = target.closest("[data-fit-open]");
    if (fit) {
      event.preventDefault();
      openFitViewer(fit.getAttribute("data-fit-open"));
      return;
    }

    const homeLink = target.closest("[data-home-link]");
    if (homeLink) {
      event.preventDefault();
      goHomeFromLogo();
      return;
    }

    const category = target.closest("[data-category]");
    if (category) {
      event.preventDefault();
      setCategory(category.getAttribute("data-category"));
      return;
    }

    const tab = target.closest("[data-tab]");
    if (tab) {
      event.preventDefault();
      const id = tab.getAttribute("data-tab");
      if (id === "home") {
        scrollHomeToTop();
        dom.appScroll.focus({ preventScroll: true });
      } else if (id === "search") {
        scrollHomeToTop();
        window.requestAnimationFrame(() => {
          const input = dom.appScroll.querySelector("#search-input");
          if (input) input.focus({ preventScroll: true });
        });
      } else {
        showToast("Disponible en la app completa.");
      }
      return;
    }

    const action = target.closest("[data-action]");
    if (!action) return;
    const actionName = action.getAttribute("data-action");

    if (actionName === "back") {
      event.preventDefault();
      goBackToHome();
    } else if (actionName === "share") {
      event.preventDefault();
      shareCurrentListing();
    } else if (actionName === "notifications") {
      showToast("No tienes notificaciones nuevas.");
    } else if (actionName === "camera") {
      showToast("La búsqueda por foto estará disponible en la app completa.");
    } else if (actionName === "sort") {
      showToast("Ordenar por precio, talla y cercanía, en la app completa.");
    } else if (actionName === "profile") {
      showToast("Disponible en la app completa.");
    } else if (actionName === "reset-filters") {
      resetFilters();
    }
  }

  function handleScreenInput(event) {
    if (event.target && event.target.id === "search-input") {
      state.query = event.target.value;
      applyFilters();
    }
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (state.route !== "detail") return;
    if (isViewerOpen()) return;
    event.preventDefault();
    goBackToHome();
  }

  function handleStorage(event) {
    if (event.key !== FAVORITES_KEY) return;
    state.favorites = loadFavorites();
    const ids = new Set();
    document.querySelectorAll(".js-fav").forEach((button) => ids.add(button.getAttribute("data-fav-id")));
    ids.forEach((id) => refreshFavoriteVisuals(id));
  }

  /* ---------- boot ---------- */

  function init() {
    dom.screen = document.getElementById("screen");
    dom.appScroll = document.getElementById("app-scroll");
    dom.tabbar = document.getElementById("tabbar");
    dom.buybarSlot = document.getElementById("buybar-slot");
    dom.toast = document.getElementById("toast");
    dom.srLive = document.getElementById("sr-live");

    if (!dom.screen || !dom.appScroll || !dom.tabbar || !dom.buybarSlot) return;

    state.favorites = loadFavorites();
    dom.screen.addEventListener("click", handleScreenClick);
    dom.screen.addEventListener("input", handleScreenInput);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", handleStorage);

    const initialId = new URLSearchParams(window.location.search).get("id");
    if (initialId) {
      const listing = findListing(initialId);
      if (listing) {
        window.history.replaceState(
          { sp: true, view: "detail", id: String(listing.id), deep: true },
          "",
          currentUrlForDetail(listing.id)
        );
        renderDetail(listing, { focusTitle: false });
      } else {
        window.history.replaceState({ sp: true, view: "home" }, "", currentUrlForHome());
        renderHome();
        window.requestAnimationFrame(() => showToast("Ese anuncio ya no está disponible."));
      }
    } else {
      window.history.replaceState({ sp: true, view: "home" }, "", currentUrlForHome());
      renderHome();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
