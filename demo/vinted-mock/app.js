const $ = (sel) => document.querySelector(sel);

const params = new URLSearchParams(location.search);
const VIEWER_URL = params.get('viewer') || 'http://localhost:5173';
const REQUESTED_ID = params.get('id');

const LABELS = {
  pit_to_pit_cm: 'Axila–axila (plano)',
  length_cm: 'Largo total',
  shoulder_cm: 'Hombro–hombro',
  sleeve_cm: 'Largo de manga',
  waist_cm: 'Cintura (plano)',
  hips_cm: 'Cadera (plano)',
  inseam_cm: 'Entrepierna',
  rise_cm: 'Tiro',
  thigh_cm: 'Muslo (plano)',
  hem_cm: 'Bajo (plano)',
};

const CATEGORY = {
  tshirt: 'Camisetas',
  hoodie: 'Sudaderas',
  dress: 'Vestidos',
  jeans: 'Vaqueros',
  jacket: 'Chaquetas',
  skirt: 'Faldas',
};

const FALLBACK_LABEL = {
  tshirt: 'camiseta',
  hoodie: 'sudadera',
  dress: 'vestido',
  jeans: 'vaqueros',
  jacket: 'chaqueta',
  skirt: 'falda',
};

const euro = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

/** Crea el bloque de imagen con fallback si el archivo no existe. */
function photoBlock(src, alt, label) {
  const wrap = document.createElement('div');
  wrap.className = 'photo-fallback';
  wrap.style.display = 'none';
  wrap.innerHTML = `<span>${label}</span>`;

  const img = document.createElement('img');
  img.alt = alt;
  img.src = src;
  img.addEventListener('error', () => {
    img.remove();
    wrap.style.display = 'flex';
  });

  const box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.inset = '0';
  box.append(wrap, img);
  return box;
}

function renderGallery(listing) {
  const main = $('#main-photo');
  main.innerHTML = '';
  const photos = listing.photos.length ? listing.photos : [''];
  main.append(photoBlock(photos[0], listing.title, FALLBACK_LABEL[listing.garment.type] || 'prenda'));

  const thumbs = $('#thumbs');
  thumbs.innerHTML = '';
  photos.forEach((src, i) => {
    const b = document.createElement('button');
    b.className = 'thumb' + (i === 0 ? ' is-active' : '');
    b.setAttribute('aria-label', `Foto ${i + 1}`);
    b.append(photoBlock(src, '', FALLBACK_LABEL[listing.garment.type] || 'prenda'));
    b.addEventListener('click', () => {
      main.innerHTML = '';
      main.append(photoBlock(src, listing.title, FALLBACK_LABEL[listing.garment.type] || 'prenda'));
      thumbs.querySelectorAll('.thumb').forEach((t) => t.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    if (photos.length > 1) thumbs.append(b);
  });
}

function renderMeasurements(listing) {
  const table = $('#measurements');
  table.innerHTML = '';
  const m = listing.garment.measurements;
  const keys = Object.keys(m);

  keys.forEach((k) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${LABELS[k] || k}</td><td>${m[k]} cm</td>`;
    table.append(tr);
  });

  const expected = listing.garment.type === 'jeans' ? 5 : 4;
  const ratio = keys.length / expected;
  $('#confidence-tag').textContent = ratio >= 1 ? 'Completas' : 'Parciales';
  $('#hint').textContent =
    ratio >= 1
      ? 'Con estas medidas el cálculo de ajuste es fiable.'
      : 'Faltan medidas: el veredicto será orientativo.';
}

function renderGrid(listings, current) {
  const grid = $('#grid');
  grid.innerHTML = '';
  const others = listings.filter((l) => l.id !== current.id).slice(0, 5);
  $('#more-count').textContent = `${others.length} anuncios`;

  others.forEach((l) => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `?id=${encodeURIComponent(l.id)}`;
    const pic = document.createElement('div');
    pic.className = 'main-photo';
    pic.append(photoBlock(l.photos[0] || '', l.title, FALLBACK_LABEL[l.garment.type] || 'prenda'));
    a.append(pic);
    a.insertAdjacentHTML(
      'beforeend',
      `<p class="card-title">${l.title}</p><span class="card-price">${euro(l.price)}</span>`
    );
    grid.append(a);
  });
}

function openDrawer(listing) {
  const iframe = $('#viewer');
  const url = new URL(VIEWER_URL);
  url.searchParams.set('listing', listing.id);
  url.searchParams.set('embed', '1');
  iframe.src = url.toString();

  $('#drawer-title').textContent = `${listing.title} · ${listing.size_label}`;
  $('#drawer').classList.add('is-open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('is-open');
}

function closeDrawer() {
  $('#drawer').classList.remove('is-open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('is-open');
}

async function main() {
  const res = await fetch('listings.json');
  const listings = await res.json();
  const listing = listings.find((l) => l.id === REQUESTED_ID) || listings[0];

  document.title = `${listing.title} — segunda`;
  $('#title').textContent = listing.title;
  $('#price').textContent = euro(listing.price);
  $('#size').textContent = `Talla ${listing.size_label}`;
  $('#brand').textContent = listing.brand || '—';
  $('#condition').textContent = listing.condition || '—';
  $('#crumb-title').textContent = listing.title;
  $('#crumb-cat').textContent = CATEGORY[listing.garment.type] || 'Prendas';

  renderGallery(listing);
  renderMeasurements(listing);
  renderGrid(listings, listing);

  $('#fit-btn').addEventListener('click', () => openDrawer(listing));
  $('#close').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'f' && !$('#drawer').classList.contains('is-open')) openDrawer(listing);
  });
}

main().catch((err) => {
  console.error(err);
  $('#title').textContent = 'No se pudo cargar el anuncio';
  $('#hint').textContent = 'Abre esta página con un servidor local (ver README).';
});
