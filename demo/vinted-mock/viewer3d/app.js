/**
 * Probador 3D — outfit check.
 *
 * Carga una base mesh CC0 (Innerscene / MakeHuman), la deforma con las 6
 * medidas del anuncio usando los anillos del motor paramétrico y calcula un
 * veredicto de fit con las medidas planas de la prenda.
 *
 * La prenda todavía no se renderiza: esta iteración enseña cuerpo + veredicto.
 * El cálculo de fit de esta carpeta es una vista previa local; el motor
 * definitivo vivirá en packages/fit-engine/src/fit.ts.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildBody } from './body-engine.js';
import { buildGarment, loadFabricTextures } from './garment-builder.js';

const $ = (id) => document.getElementById(id);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

const SKIN_COLOR = new THREE.Color(0xe1d0bb).convertSRGBToLinear();

const PERSONAL_KEY = 'segunda-piel:personal-mannequin:v1';
const PERSONAL_NUMBER_FIELDS = {
  'personal-height': 'height_cm',
  'personal-bust': 'bust_cm',
  'personal-waist': 'waist_cm',
  'personal-hips': 'hips_cm',
  'personal-shoulder': 'shoulder_cm',
  'personal-inseam': 'inseam_cm',
};
const PERSONAL_SHAPE_FIELDS = {
  'personal-bust-projection': 'bust_projection',
  'personal-seat': 'seat',
  'personal-belly': 'belly',
  'personal-shoulder-slope': 'shoulder_slope',
};

const BODY_PRESETS = {
  female: {
    xs: { height_cm: 155, bust_cm: 76, waist_cm: 58, hips_cm: 84, shoulder_cm: 35, inseam_cm: 72, muscle: 0.2 },
    s: { height_cm: 160, bust_cm: 80, waist_cm: 62, hips_cm: 88, shoulder_cm: 36, inseam_cm: 74, muscle: 0.2 },
    m: { height_cm: 165, bust_cm: 86, waist_cm: 68, hips_cm: 94, shoulder_cm: 38, inseam_cm: 76 },
    l: { height_cm: 170, bust_cm: 94, waist_cm: 76, hips_cm: 102, shoulder_cm: 40, inseam_cm: 79 },
    xl: { height_cm: 175, bust_cm: 104, waist_cm: 86, hips_cm: 112, shoulder_cm: 42, inseam_cm: 81 },
    plus: {
      height_cm: 168,
      bust_cm: 120,
      waist_cm: 104,
      hips_cm: 132,
      shoulder_cm: 44,
      inseam_cm: 79,
      belly: 0.45,
      seat: 0.35,
      bust_projection: 0.7,
    },
  },
  male: {
    xs: { height_cm: 162, bust_cm: 84, waist_cm: 68, hips_cm: 86, shoulder_cm: 40, inseam_cm: 75 },
    s: { height_cm: 168, bust_cm: 90, waist_cm: 74, hips_cm: 92, shoulder_cm: 43, inseam_cm: 78 },
    m: { height_cm: 175, bust_cm: 98, waist_cm: 82, hips_cm: 98, shoulder_cm: 45, inseam_cm: 80 },
    l: { height_cm: 182, bust_cm: 108, waist_cm: 92, hips_cm: 106, shoulder_cm: 48, inseam_cm: 83, muscle: 0.5, belly: 0.1 },
    xl: {
      height_cm: 188,
      bust_cm: 120,
      waist_cm: 102,
      hips_cm: 116,
      shoulder_cm: 50,
      inseam_cm: 86,
      muscle: 0.55,
      belly: 0.1,
    },
    plus: {
      height_cm: 180,
      bust_cm: 132,
      waist_cm: 116,
      hips_cm: 126,
      shoulder_cm: 52,
      inseam_cm: 82,
      belly: 0.5,
      seat: 0.25,
    },
  },
  neutral: {
    xs: { height_cm: 158, bust_cm: 80, waist_cm: 62, hips_cm: 88, shoulder_cm: 37, inseam_cm: 74 },
    s: { height_cm: 164, bust_cm: 86, waist_cm: 70, hips_cm: 94, shoulder_cm: 40, inseam_cm: 77 },
    m: { height_cm: 170, bust_cm: 92, waist_cm: 76, hips_cm: 100, shoulder_cm: 42, inseam_cm: 79 },
    l: { height_cm: 176, bust_cm: 100, waist_cm: 84, hips_cm: 108, shoulder_cm: 45, inseam_cm: 82 },
    xl: { height_cm: 182, bust_cm: 110, waist_cm: 94, hips_cm: 116, shoulder_cm: 47, inseam_cm: 85 },
    plus: { height_cm: 174, bust_cm: 118, waist_cm: 104, hips_cm: 126, shoulder_cm: 46, inseam_cm: 81, belly: 0.45 },
  },
};

const PRESET_ORDER = [
  ['xs', 'XS'],
  ['s', 'S'],
  ['m', 'M'],
  ['l', 'L'],
  ['xl', 'XL'],
  ['plus', 'Plus'],
];

const FALLBACK_LISTING = {
  id: 'demo',
  title: 'Prenda de segunda mano',
  size_label: 'M',
  category: 'mujer',
  garment: {
    type: 'tshirt',
    fabric: 'cotton_jersey',
    measurements: { pit_to_pit_cm: 52, length_cm: 68, shoulder_cm: 44, sleeve_cm: 20 },
  },
  body: { height_cm: 175, bust_cm: 92, waist_cm: 78, hips_cm: 96, shoulder_cm: 44, inseam_cm: 80 },
};

const state = {
  listing: null,
  sex: 'female',
  profile: null,
  baseProfile: null,
  baselineProfile: null,
  body: null,
  fit: null,
  model: null,
  mesh: null,
  meshMirror: null,
  cameraGoal: null,
  lastHeight: null,
  deformFrame: 0,
  readySent: false,
  garment: null,
  garmentKey: '',
  garmentTimer: 0,
  garmentTextures: null,
  garmentTexturesPromise: null,
  heatmap: false,
};

let renderer;
let scene;
let camera;
let controls;
let pmrem;
let stageWrap;
let personalToastTimer = 0;

/* ------------------------------------------------------------------ */
/* Datos del anuncio                                                   */
/* ------------------------------------------------------------------ */

function readListing() {
  let id = null;
  try {
    id = new URLSearchParams(window.location.search).get('listing');
  } catch (error) {
    id = null;
  }

  const listings = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
  const listing = listings.find((item) => item && item.id === id) || listings[0] || FALLBACK_LISTING;

  state.listing = listing;

  const saved = loadSavedPersonalProfile();
  if (saved) {
    state.sex = saved.sex;
    state.profile = { ...saved };
  } else {
    state.sex = listing.category === 'hombre' ? 'male' : listing.category === 'mujer' ? 'female' : 'neutral';
    state.profile = { ...listing.body, sex: state.sex };
  }
  state.baselineProfile = { ...listing.body, sex: state.sex };
  state.baseProfile = { ...state.profile };

  $('garment-name').textContent = listing.title || 'Prenda de segunda mano';
  $('size-badge').textContent = listing.size_label || '—';

  syncSliders();
  renderPresets();
  renderPersonalPresets();
  syncPersonalForm();
  updateSexButtons();
}

function renderPresets() {
  const container = $('presets');
  if (!container) return;
  const presets = BODY_PRESETS[state.sex] || BODY_PRESETS.neutral;
  container.replaceChildren();

  for (const [key, label] of PRESET_ORDER) {
    if (!presets[key]) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.preset = key;
    button.addEventListener('click', () => applyPreset(key));
    container.append(button);
  }

  const body = document.createElement('button');
  body.type = 'button';
  body.textContent = 'Mi cuerpo';
  body.dataset.preset = 'body';
  body.className = 'is-body';
  body.addEventListener('click', () => applyPreset('body'));
  container.append(body);

  markPresetActive('body');
}

function applyPreset(key) {
  if (key === 'body') {
    state.profile = { ...state.baseProfile };
  } else {
    const presets = BODY_PRESETS[state.sex] || BODY_PRESETS.neutral;
    const preset = presets[key];
    if (!preset) return;
    state.profile = { ...preset, sex: state.sex };
  }
  syncSliders();
  syncPersonalForm();
  markPresetActive(key);
  markPersonalPresetActive(null);
  scheduleDeform(true);
}

function markPresetActive(key) {
  for (const button of document.querySelectorAll('#presets button')) {
    button.classList.toggle('is-active', button.dataset.preset === key);
  }
}

function syncSliders() {
  const keys = ['height', 'bust', 'waist', 'hips', 'shoulder'];
  for (const key of keys) {
    const input = $(key);
    const output = $(`${key}-value`);
    if (!input || !output) continue;
    input.value = String(state.profile[`${key}_cm`] ?? input.value);
    output.textContent = input.value;
  }
}

function bindMeasureInputs() {
  const map = {
    height: 'height_cm',
    bust: 'bust_cm',
    waist: 'waist_cm',
    hips: 'hips_cm',
    shoulder: 'shoulder_cm',
  };

  for (const [id, field] of Object.entries(map)) {
    const input = $(id);
    const output = $(`${id}-value`);
    if (!input || !output) continue;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      state.profile[field] = value;
      output.textContent = String(value);
      syncPersonalForm();
      markPresetActive(null);
      markPersonalPresetActive(null);
      scheduleDeform();
    });
  }

  $('reset-measures').addEventListener('click', () => {
    state.profile = { ...state.baseProfile };
    syncSliders();
    syncPersonalForm();
    markPresetActive('body');
    markPersonalPresetActive('body');
    scheduleDeform(true);
  });
}

/* ------------------------------------------------------------------ */
/* Mi maniquí personal                                                 */
/* ------------------------------------------------------------------ */

function loadSavedPersonalProfile() {
  try {
    const raw = window.localStorage.getItem(PERSONAL_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return null;

    const profile = { ...saved };
    for (const key of ['height_cm', 'bust_cm', 'waist_cm', 'hips_cm', 'shoulder_cm', 'inseam_cm']) {
      const value = Number(saved[key]);
      if (!Number.isFinite(value)) return null;
      profile[key] = value;
    }

    profile.sex =
      saved.sex === 'male' || saved.sex === 'female' || saved.sex === 'neutral'
        ? saved.sex
        : 'neutral';
    return profile;
  } catch (error) {
    return null;
  }
}

function savePersonalProfile() {
  if (!state.profile) return;
  state.baseProfile = { ...state.profile };

  try {
    window.localStorage.setItem(PERSONAL_KEY, JSON.stringify(state.profile));
  } catch (error) {
    // Sin storage (modo privado): la sesión actual sigue funcionando.
  }

  markPresetActive('body');
  markPersonalPresetActive('body');
  updatePersonalSummary();
  showPersonalToast('Maniquí guardado en este dispositivo.');
}

function resetPersonalProfile() {
  if (!state.baseProfile) return;
  state.profile = { ...state.baseProfile };
  syncSliders();
  syncPersonalForm();
  markPresetActive('body');
  markPersonalPresetActive('body');
  scheduleDeform(true);
  showPersonalToast('Medidas restablecidas.');
}

function setPersonalSex(sex) {
  if (sex !== 'female' && sex !== 'male' && sex !== 'neutral') return;
  const changedModel = state.sex !== sex;
  state.sex = sex;
  if (state.profile) state.profile = { ...state.profile, sex };
  if (state.baseProfile) state.baseProfile = { ...state.baseProfile, sex };

  updateSexButtons();
  renderPresets();
  renderPersonalPresets();
  syncPersonalForm();

  if (changedModel) loadModel(sex);
  else scheduleDeform(true);
}

function renderPersonalPresets() {
  const container = $('personal-presets');
  if (!container) return;
  const presets = BODY_PRESETS[state.sex] || BODY_PRESETS.neutral;
  container.replaceChildren();

  for (const [key, label] of PRESET_ORDER) {
    if (!presets[key]) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.preset = key;
    button.addEventListener('click', () => applyPersonalPreset(key));
    container.append(button);
  }

  const body = document.createElement('button');
  body.type = 'button';
  body.textContent = 'Mi cuerpo';
  body.dataset.preset = 'body';
  body.className = 'is-body';
  body.addEventListener('click', () => applyPersonalPreset('body'));
  container.append(body);

  markPersonalPresetActive('body');
}

function applyPersonalPreset(key) {
  if (key === 'body') {
    state.profile = { ...state.baseProfile };
  } else {
    const presets = BODY_PRESETS[state.sex] || BODY_PRESETS.neutral;
    const preset = presets[key];
    if (!preset) return;
    state.profile = { ...preset, sex: state.sex };
  }

  syncSliders();
  syncPersonalForm();
  markPresetActive(null);
  markPersonalPresetActive(key);
  scheduleDeform(true);
}

function markPersonalPresetActive(key) {
  for (const button of document.querySelectorAll('#personal-presets button')) {
    button.classList.toggle('is-active', button.dataset.preset === key);
  }
}

function personalShapeValue(field) {
  const explicit = Number(state.profile?.[field]);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 1);

  const defaults = {
    bust_projection: state.sex === 'female' ? 0.55 : state.sex === 'male' ? 0.25 : 0.4,
    seat: state.sex === 'female' ? 0.6 : state.sex === 'male' ? 0.35 : 0.48,
    belly: 0.25,
    shoulder_slope: 0.45,
  };
  return defaults[field] ?? 0;
}

function syncPersonalForm() {
  if (!state.profile) return;

  for (const [id, field] of Object.entries(PERSONAL_NUMBER_FIELDS)) {
    const input = $(id);
    const value = Number(state.profile[field]);
    if (input && Number.isFinite(value)) input.value = String(Math.round(value));
  }

  for (const [id, field] of Object.entries(PERSONAL_SHAPE_FIELDS)) {
    const input = $(id);
    const output = $(`${id}-value`);
    const value = personalShapeValue(field);
    if (input) input.value = String(Math.round(value * 100));
    if (output) output.textContent = `${Math.round(value * 100)}%`;
  }

  updateSexButtons();
  updatePersonalSummary();
}

function updateSexButtons() {
  for (const button of document.querySelectorAll('[data-sex]')) {
    const active = button.dataset.sex === state.sex;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function updatePersonalSummary() {
  const profile = state.profile;
  if (!profile) return;

  const summary = $('personal-summary-value');
  if (summary) {
    summary.textContent =
      `${Math.round(profile.height_cm)} cm · ` +
      `${Math.round(profile.bust_cm)}-${Math.round(profile.waist_cm)}-${Math.round(profile.hips_cm)} cm · ` +
      `hombro ${Math.round(profile.shoulder_cm)} cm · entrepierna ${Math.round(profile.inseam_cm)} cm`;
  }

  const listing = $('personal-listing-value');
  if (listing) {
    listing.textContent = state.listing
      ? `${state.listing.title || 'Prenda'} · talla ${state.listing.size_label || '—'}`
      : '—';
  }
}

function showPersonalToast(message) {
  const toast = $('personal-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(personalToastTimer);
  personalToastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function setTab(name) {
  const tab = name === 'mannequin' ? 'mannequin' : 'fit';

  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = button.dataset.tab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }

  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.hidden = panel.dataset.panel !== tab;
  }

  const sheet = document.querySelector('.sheet');
  if (sheet) {
    sheet.classList.toggle('is-personal', tab === 'mannequin');
    sheet.scrollTop = 0;
  }

  if (tab === 'mannequin') syncPersonalForm();
}

function bindPersonalInputs() {
  for (const [id, field] of Object.entries(PERSONAL_NUMBER_FIELDS)) {
    const input = $(id);
    if (!input) continue;

    input.addEventListener('input', () => {
      if (input.value === '') return;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      const min = Number(input.min);
      const max = Number(input.max);
      const next = clamp(value, Number.isFinite(min) ? min : value, Number.isFinite(max) ? max : value);
      state.profile[field] = next;
      syncSliders();
      updatePersonalSummary();
      markPresetActive(null);
      markPersonalPresetActive(null);
      scheduleDeform();
    });

    input.addEventListener('blur', () => {
      const value = Number(state.profile[field]);
      if (input.value === '' || !Number.isFinite(value)) syncPersonalForm();
      else input.value = String(Math.round(value));
    });
  }

  for (const [id, field] of Object.entries(PERSONAL_SHAPE_FIELDS)) {
    const input = $(id);
    const output = $(`${id}-value`);
    if (!input) continue;

    input.addEventListener('input', () => {
      const value = clamp(Number(input.value), 0, 100) / 100;
      state.profile[field] = value;
      if (output) output.textContent = `${Math.round(value * 100)}%`;
      updatePersonalSummary();
      markPresetActive(null);
      markPersonalPresetActive(null);
      scheduleDeform();
    });
  }

  $('save-personal')?.addEventListener('click', savePersonalProfile);
  $('reset-personal')?.addEventListener('click', resetPersonalProfile);
  $('go-fit')?.addEventListener('click', () => setTab('fit'));
  $('personal-form')?.addEventListener('submit', (event) => event.preventDefault());

  for (const button of document.querySelectorAll('[data-sex]')) {
    button.addEventListener('click', () => setPersonalSex(button.dataset.sex));
  }
}

function bindTabs() {
  const tabs = [...document.querySelectorAll('[data-tab]')];
  for (const button of tabs) {
    button.addEventListener('click', () => setTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = tabs.indexOf(button);
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      setTab(next.dataset.tab);
      next.focus();
    });
  }
  setTab('fit');
}

/* ------------------------------------------------------------------ */
/* Escena                                                              */
/* ------------------------------------------------------------------ */

function initThree() {
  const canvas = $('stage');
  stageWrap = canvas.parentElement;

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping || THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  camera.position.set(0.85, 1.2, 3.5);

  controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 8;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.68;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.8;
  controls.addEventListener('start', () => {
    $('hint').classList.add('is-hidden');
  });

  pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.78;
  scene.environmentRotation = new THREE.Euler(0, -0.18, 0);

  RectAreaLightUniformsLib.init();

  // Estudio: softbox cálido + strip frío + rim. El HDRI real sustituye al
  // RoomEnvironment en cuanto termina de cargar.
  const softbox = new THREE.RectAreaLight(0xfff1df, 4.2, 2.2, 3.0);
  softbox.position.set(-2.2, 3.1, 2.7);
  softbox.lookAt(0, 1.05, 0);
  scene.add(softbox);

  const strip = new THREE.RectAreaLight(0xffffff, 3.8, 0.55, 3.8);
  strip.position.set(2.7, 2.5, 1.5);
  strip.lookAt(0, 1.12, 0);
  scene.add(strip);

  const fillArea = new THREE.RectAreaLight(0xdfeaff, 0.8, 2.0, 2.6);
  fillArea.position.set(2.6, 1.8, 2.4);
  fillArea.lookAt(0, 0.95, 0);
  scene.add(fillArea);

  const hemi = new THREE.HemisphereLight(0xfff7ea, 0x8b8074, 0.22);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff2de, 1.3);
  key.position.set(2.4, 4.2, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -2.5;
  key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -1.2;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 4;
  key.shadow.intensity = 0.62;
  key.target.position.set(0, 0.9, 0);
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0xbfd8d8, 0.25);
  fill.position.set(-3.2, 2.4, 1.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe4c4, 1.05);
  rim.position.set(-1.8, 3.4, -3.6);
  scene.add(rim);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.67, 0.035, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xcdc6bb,
      roughness: 0.72,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
    }),
  );
  platform.position.y = -0.018;
  platform.receiveShadow = true;
  scene.add(platform);

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ color: 0x241f18, opacity: 0.18 }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.001;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshBasicMaterial({
      map: makeContactShadow(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.002;
  contactShadow.renderOrder = 1;
  scene.add(contactShadow);

  // HDRI local CC0: el 80% del look de estudio.
  new RGBELoader()
    .loadAsync('./assets/hdri/studio_small_09_1k.hdr')
    .then((hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const environment = pmrem.fromEquirectangular(hdr).texture;
      scene.environment = environment;
      scene.environmentIntensity = 0.82;
      hdr.dispose();
    })
    .catch((error) => console.warn('[probador] HDRI no disponible; uso RoomEnvironment', error));

  // El visor respira con un autogiro muy lento; se pausa al interactuar.
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;
  let resumeTimer = 0;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    clearTimeout(resumeTimer);
  });
  controls.addEventListener('end', () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      controls.autoRotate = true;
    }, 4200);
  });

  state.garmentTexturesPromise = loadFabricTextures(renderer)
    .then((textures) => {
      state.garmentTextures = textures;
      return textures;
    })
    .catch((error) => {
      console.warn('[probador] Texturas de tejido no disponibles', error);
      return null;
    });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stageWrap);
  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    advanceCameraGoal();
    renderer.render(scene, camera);
  });
}

function makeContactShadow() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size * 0.48);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function resize() {
  if (!renderer || !camera || !stageWrap) return;
  const width = Math.max(1, stageWrap.clientWidth);
  const height = Math.max(1, stageWrap.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (state.model) reframePreservingView();
}

function cameraDistanceFor(heightCm) {
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const bodyHeight = (heightCm / 100) * 1.02;
  const bodyWidth = 0.98 * (heightCm / 175);
  const distanceV = bodyHeight * 0.5 / Math.tan(fov * 0.5);
  const distanceH = (bodyWidth * 0.5) / Math.tan(fov * 0.5) / Math.max(camera.aspect, 0.35);
  return Math.max(distanceV, distanceH) * 1.36;
}

function viewAngles(name) {
  if (name === 'front') return { azimuth: 0, elevation: 0.06 };
  if (name === 'side') return { azimuth: Math.PI * 0.47, elevation: 0.04 };
  return { azimuth: 0.34, elevation: 0.07 };
}

function setView(name, immediate = false) {
  if (!camera || !controls || !state.profile) return;
  const target = new THREE.Vector3(0, (state.profile.height_cm / 100) * 0.5, 0);
  const distance = cameraDistanceFor(state.profile.height_cm);
  const { azimuth, elevation } = viewAngles(name);
  const horizontal = Math.cos(elevation) * distance;
  const position = new THREE.Vector3(
    Math.sin(azimuth) * horizontal,
    target.y + Math.sin(elevation) * distance,
    Math.cos(azimuth) * horizontal,
  );

  for (const button of document.querySelectorAll('[data-view]')) {
    button.classList.toggle('is-active', button.dataset.view === name);
  }

  if (immediate) {
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    return;
  }

  state.cameraGoal = { position, target };
}

function reframePreservingView() {
  if (!camera || !controls || !state.profile) return;
  const target = new THREE.Vector3(0, (state.profile.height_cm / 100) * 0.5, 0);
  const offset = camera.position.clone().sub(controls.target);
  if (offset.lengthSq() < 1e-6) offset.set(0.7, 0.4, 3.5);
  offset.normalize().multiplyScalar(cameraDistanceFor(state.profile.height_cm));
  camera.position.copy(target).add(offset);
  controls.target.copy(target);
  controls.update();
}

function advanceCameraGoal() {
  if (!state.cameraGoal) return;
  camera.position.lerp(state.cameraGoal.position, 0.14);
  controls.target.lerp(state.cameraGoal.target, 0.14);
  if (camera.position.distanceTo(state.cameraGoal.position) < 0.006) {
    camera.position.copy(state.cameraGoal.position);
    controls.target.copy(state.cameraGoal.target);
    state.cameraGoal = null;
    controls.update();
  }
}

/* ------------------------------------------------------------------ */
/* Carga y preparación de la base mesh                                 */
/* ------------------------------------------------------------------ */

/**
 * La base mesh viene partida en primitivas: el cuerpo, las areolas, las uñas
 * de manos y pies, los ojos, los dientes y una cabeza de alta densidad.
 * Fusionamos solo cuerpo + manos/pies con el mismo material arcilla. Las
 * areolas se descartan para que el pecho quede liso; ojos, boca y cabeza
 * también, porque el visor proyecta la cabeza a un elipsoide sin cara.
 */
function collectBodyParts(scene) {
  let body = null;
  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    if (!body || object.geometry.attributes.position.count > body.geometry.attributes.position.count) {
      body = object;
    }
  });
  if (!body) return null;

  const bodyBox = new THREE.Box3().setFromBufferAttribute(body.geometry.attributes.position);
  bodyBox.applyMatrix4(body.matrixWorld);
  const height = bodyBox.max.y - bodyBox.min.y;

  const details = [];
  scene.traverse((object) => {
    if (object === body || !object.isMesh || !object.geometry?.attributes?.position) return;
    const box = new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position);
    box.applyMatrix4(object.matrixWorld);
    // Manos (~55%) y pies (~1%). Las areolas (~72%) se dejan fuera para que
    // el pecho quede liso; ojos, boca y cabeza de alta densidad quedan por
    // encima del 82% y tampoco se fusionan.
    if (box.max.y < bodyBox.min.y + height * 0.65) details.push(object);
  });

  return { body, details };
}

function mergeBodyGeometry(body, details) {
  if (!details.length) return { geometry: body.geometry, matrixWorld: body.matrixWorld, skeleton: body.skeleton };

  const geometries = [body, ...details].map((object) => {
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    return geometry;
  });

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('No se pudieron fusionar las piezas de la base mesh.');

  return { geometry: merged, matrixWorld: new THREE.Matrix4(), skeleton: body.skeleton };
}

async function loadModel(sex) {
  showLoading(true);
  $('error').hidden = true;

  try {
    const loader = new GLTFLoader();
    const file = sex === 'male' ? './assets/male-base.glb' : './assets/female-base.glb';
    const gltf = await loader.loadAsync(file);
    gltf.scene.updateMatrixWorld(true);

    const parts = collectBodyParts(gltf.scene);
    if (!parts) throw new Error('La base mesh no contiene geometría.');
    const merged = mergeBodyGeometry(parts.body, parts.details);
    const model = prepareModel(merged);

    if (state.mesh) {
      scene.remove(state.mesh);
      if (state.meshMirror) scene.remove(state.meshMirror);
      state.mesh.geometry.dispose();
      state.mesh.material.dispose();
      state.meshMirror = null;
    }

    const material = new THREE.MeshPhysicalMaterial({
      color: SKIN_COLOR,
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.55,
      sheen: 0.14,
      sheenColor: new THREE.Color(0xfff0e0),
      sheenRoughness: 0.8,
      envMapIntensity: 0.75,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(model.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);

    // La base mesh ya incluye ambos lados; no duplicar con espejo.
    state.meshMirror = null;

    state.model = model;
    state.mesh = mesh;
    state.lastHeight = null;

    deform();
    await rebuildGarment(true);
    setView('three-quarter', true);
    showLoading(false);
    postReady();
  } catch (error) {
    console.error('[probador] No se pudo cargar la base mesh', error);
    showLoading(false);
    $('error').hidden = false;
    postReady();
  }
}

/**
 * La base mesh trae costuras de UV con vértices duplicados. Si recalculamos
 * normales sin soldarlas, aparece una línea dura en el pecho. Remapeamos los
 * índices a un vértice representativo por posición (0,1 mm) para que las dos
 * caras de la costura compartan normales. No borramos los vértices sobrantes:
 * quedan sin usar y no se renderizan.
 */
function weldGeometryIndex(geometry) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  if (!positions || !index) return;

  const tolerance = 1e-4;
  const seen = new Map();
  const remap = new Uint32Array(positions.count);

  for (let i = 0; i < positions.count; i += 1) {
    const key =
      `${Math.round(positions.getX(i) / tolerance)}:` +
      `${Math.round(positions.getY(i) / tolerance)}:` +
      `${Math.round(positions.getZ(i) / tolerance)}`;
    let representative = seen.get(key);
    if (representative === undefined) {
      representative = i;
      seen.set(key, representative);
    }
    remap[i] = representative;
  }

  const array = index.array;
  for (let i = 0; i < array.length; i += 1) {
    array[i] = remap[array[i]];
  }
  index.needsUpdate = true;
}

function readArmJoints(skeleton) {
  if (!skeleton) return null;
  // GLTFLoader sanea los nombres de los huesos: "upperarm01.L" llega como
  // "upperarm01L". Normalizamos para no depender del separador.
  const byName = new Map(
    skeleton.bones.map((bone) => [String(bone.name).replace(/[^a-z0-9]/gi, '').toLowerCase(), bone]),
  );
  const position = (name) => {
    const bone = byName.get(name.replace(/[^a-z0-9]/gi, '').toLowerCase());
    if (!bone) return null;
    const point = new THREE.Vector3();
    bone.getWorldPosition(point);
    return point;
  };
  const left = { shoulder: position('upperarm01.L'), wrist: position('wrist.L') };
  const right = { shoulder: position('upperarm01.R'), wrist: position('wrist.R') };
  if (!left.shoulder || !left.wrist || !right.shoulder || !right.wrist) return null;
  return { left, right };
}

function buildHeadModel(geometry, groupWeights, baseHeight) {
  const positions = geometry.attributes.position;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let count = 0;

  for (let i = 0; i < positions.count; i += 1) {
    if (groupWeights[i * 6 + 5] < 0.5) continue;
    const y = positions.getY(i);
    if (y < baseHeight * 0.84) continue;
    const x = positions.getX(i);
    const z = positions.getZ(i);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
    count += 1;
  }

  if (!count) return null;

  // Un pelín más estrecho que la caja (las orejas sobresalen) para que la
  // cabeza quede como un huevo de maniquí, no como un globo.
  return {
    center: new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    rx: Math.max((maxX - minX) / 2, 0.04) * 0.96,
    ry: Math.max((maxY - minY) / 2, 0.06),
    rz: Math.max((maxZ - minZ) / 2, 0.05) * 0.98,
  };
}

function buildNeighbors(geometry) {
  const count = geometry.attributes.position.count;
  const neighbors = Array.from({ length: count }, () => []);
  const index = geometry.index;
  if (!index) return neighbors;

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    neighbors[a].push(b, c);
    neighbors[b].push(a, c);
    neighbors[c].push(a, b);
  }
  return neighbors;
}

/**
 * La malla base trae recortes para las areolas y la boca. Al descartar esas
 * primitivas se ven huecos claros. Tapamos cada borde cerrado con un abanico
 * de triángulos; al recalcular normales y suavizar, la zona queda lisa.
 */
function fillBoundaryHoles(geometry) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  if (!index || !position || index.count < 3) return;

  const edgeCounts = new Map();
  const addEdge = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  const boundary = [];
  for (const [key, count] of edgeCounts) {
    if (count !== 1) continue;
    const [a, b] = key.split(':').map(Number);
    boundary.push([a, b]);
  }
  if (!boundary.length) return;

  const adjacency = new Map();
  const connect = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push(b);
  };
  for (const [a, b] of boundary) {
    connect(a, b);
    connect(b, a);
  }

  const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const used = new Set();
  const loops = [];
  for (const [startA, startB] of boundary) {
    if (used.has(edgeKey(startA, startB))) continue;
    const loop = [];
    let previous = -1;
    let current = startA;
    let guard = 0;
    while (guard < 4096) {
      guard += 1;
      loop.push(current);
      const candidates = (adjacency.get(current) || []).filter((vertex) => vertex !== previous);
      if (!candidates.length) break;
      let next = candidates.find((vertex) => !used.has(edgeKey(current, vertex)));
      if (next === undefined) next = candidates[0];
      used.add(edgeKey(current, next));
      if (next === startA) break;
      previous = current;
      current = next;
    }
    if (loop.length >= 3 && loop.length <= 256) loops.push(loop);
  }
  if (!loops.length) return;

  const normal = geometry.getAttribute('normal');
  const extra = loops.map((loop) => {
    const center = new THREE.Vector3();
    const reference = new THREE.Vector3();
    for (const vertex of loop) {
      center.x += position.getX(vertex);
      center.y += position.getY(vertex);
      center.z += position.getZ(vertex);
      if (normal) {
        reference.x += normal.getX(vertex);
        reference.y += normal.getY(vertex);
        reference.z += normal.getZ(vertex);
      }
    }
    center.multiplyScalar(1 / loop.length);
    if (reference.lengthSq() < 1e-8) reference.set(0, 0, 1);
    else reference.normalize();
    return { loop, center, reference, first: loop[0] };
  });

  const attributes = new Map();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const itemSize = attribute.itemSize;
    const ArrayType = attribute.array.constructor;
    const array = new ArrayType((attribute.count + extra.length) * itemSize);
    array.set(attribute.array);
    for (let i = 0; i < extra.length; i += 1) {
      const source = extra[i].first * itemSize;
      const target = (attribute.count + i) * itemSize;
      if (name === 'position') {
        array[target] = extra[i].center.x;
        array[target + 1] = extra[i].center.y;
        array[target + 2] = extra[i].center.z;
      } else {
        for (let component = 0; component < itemSize; component += 1) {
          array[target + component] = attribute.array[source + component];
        }
      }
    }
    attributes.set(name, new THREE.BufferAttribute(array, itemSize, attribute.normalized));
  }
  for (const [name, attribute] of attributes) geometry.setAttribute(name, attribute);

  const oldIndex = index.array;
  const extraIndexCount = extra.reduce((sum, entry) => sum + entry.loop.length * 3, 0);
  const newIndex = new Uint32Array(oldIndex.length + extraIndexCount);
  newIndex.set(oldIndex);
  let cursor = oldIndex.length;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const face = new THREE.Vector3();
  extra.forEach((entry, entryIndex) => {
    const centerIndex = position.count + entryIndex;
    for (let i = 0; i < entry.loop.length; i += 1) {
      let first = entry.loop[i];
      let second = entry.loop[(i + 1) % entry.loop.length];
      va.fromBufferAttribute(position, first);
      vb.fromBufferAttribute(position, second);
      vc.copy(entry.center);
      face.copy(vb).sub(va).cross(vc.sub(va));
      if (face.dot(entry.reference) < 0) {
        const swap = first;
        first = second;
        second = swap;
      }
      newIndex[cursor] = first;
      newIndex[cursor + 1] = second;
      newIndex[cursor + 2] = centerIndex;
      cursor += 3;
    }
  });

  geometry.setIndex(new THREE.BufferAttribute(newIndex, 1));
  geometry.clearGroups();
  geometry.addGroup(0, newIndex.length, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/**
 * La malla base tiene el pezón modelado. Aunque descartemos la primitiva de la
 * areola, queda un relieve y una sombra muy marcados. Aplanamos solo la
 * profundidad de dos discos pequeños alrededor de los pezones, en coordenadas
 * de la malla base, antes de deformar. Así el escote queda liso sin perder la
 * forma general del pecho.
 */
function smoothChestBase(geometry, baseHeight) {
  const positions = geometry.attributes.position;
  const count = positions.count;
  const neighbors = buildNeighbors(geometry);
  const current = new Float32Array(positions.array);
  const temp = new Float32Array(current);
  const scale = baseHeight / 1.6;
  const centerY = baseHeight * 0.726;
  const radius = 0.068 * scale;
  const radiusSq = radius * radius;
  const centers = [-0.055 * scale, 0.055 * scale];
  const mask = new Uint8Array(count);

  for (let i = 0; i < count; i += 1) {
    const x = current[i * 3];
    const y = current[i * 3 + 1];
    const z = current[i * 3 + 2];
    if (z < 0.02) continue;
    const dy = y - centerY;
    if (Math.abs(dy) > radius) continue;
    for (const cx of centers) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= radiusSq) {
        mask[i] = 1;
        break;
      }
    }
  }

  for (let iteration = 0; iteration < 36; iteration += 1) {
    temp.set(current);
    for (let i = 0; i < count; i += 1) {
      if (!mask[i]) continue;
      const adjacent = neighbors[i];
      if (!adjacent.length) continue;
      let sum = 0;
      for (const neighbor of adjacent) sum += current[neighbor * 3 + 2];
      temp[i * 3 + 2] = current[i * 3 + 2] + 0.38 * (sum / adjacent.length - current[i * 3 + 2]);
    }
    current.set(temp);
  }

  positions.array.set(current);
  positions.needsUpdate = true;
}

function prepareModel(source) {
  const geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  const translation = new THREE.Vector3(-centerX, -box.min.y, -centerZ);
  const armJoints = readArmJoints(source.skeleton);
  if (armJoints) {
    armJoints.left.shoulder.add(translation);
    armJoints.left.wrist.add(translation);
    armJoints.right.shoulder.add(translation);
    armJoints.right.wrist.add(translation);
  }

  geometry.translate(translation.x, translation.y, translation.z);
  geometry.computeBoundingBox();

  weldGeometryIndex(geometry);
  fillBoundaryHoles(geometry);
  geometry.computeBoundingBox();
  const baseHeight = geometry.boundingBox.max.y;
  smoothChestBase(geometry, baseHeight);
  geometry.computeVertexNormals();
  const positions = geometry.attributes.position;
  const basePositions = new Float32Array(positions.array);
  const baseNormals = new Float32Array(geometry.attributes.normal.array);
  const groupWeights = buildGroupWeights(geometry, source.skeleton);
  const torso = buildTorsoTable(geometry, groupWeights, baseHeight);
  const legs = [buildLegTable(geometry, groupWeights, baseHeight, -1), buildLegTable(geometry, groupWeights, baseHeight, 1)];
  const shoulderHalf = measureShoulderHalf(geometry, baseHeight);
  const head = buildHeadModel(geometry, groupWeights, baseHeight);
  const neighbors = buildNeighbors(geometry);

  geometry.deleteAttribute('skinIndex');
  geometry.deleteAttribute('skinWeight');
  geometry.deleteAttribute('uv');
  positions.setUsage(THREE.DynamicDrawUsage);
  geometry.computeBoundingSphere();

  return {
    geometry,
    basePositions,
    baseNormals,
    groupWeights,
    baseHeight,
    torso,
    legs,
    shoulderHalf,
    armJoints,
    head,
    neighbors,
  };
}

/**
 * Agrupa cada vértice por hueso dominante. Los pesos son continuos: un vértice
 * del hombro puede ser 60% torso y 40% brazo, y se deforma mezclando ambos.
 * 0 = torso, 1 = brazo izq., 2 = brazo der., 3 = pierna izq., 4 = pierna der.
 */
function boneGroup(name) {
  if (!name) return -1;
  if (/^(head|jaw|eye|oris|tongue|levator|oculi|temporalis|risorius|special|orbicularis)/.test(name)) {
    return 5;
  }
  const left = /L$/.test(name);
  const right = /R$/.test(name);
  const arm = /^(shoulder01|upperarm|lowerarm|wrist|finger|metacarpal)/.test(name);
  const leg = /^(upperleg|lowerleg|foot|toe)/.test(name);
  const torso = /^(spine|pelvis|clavicle|neck|breast|root)/.test(name);

  if (left) {
    if (arm) return 1;
    if (leg) return 3;
    if (torso) return 0;
    return -1;
  }
  if (right) {
    if (arm) return 2;
    if (leg) return 4;
    if (torso) return 0;
    return -1;
  }
  if (torso) return 0;
  return -1;
}

function buildGroupWeights(geometry, skeleton) {
  const count = geometry.attributes.position.count;
  const weights = new Float32Array(count * 6);
  const skinIndex = geometry.attributes.skinIndex;
  const skinWeight = geometry.attributes.skinWeight;
  if (!skinIndex || !skinWeight || !skeleton) return weights;

  const bones = skeleton.bones;
  for (let i = 0; i < count; i += 1) {
    let torso = 0;
    let armL = 0;
    let armR = 0;
    let legL = 0;
    let legR = 0;
    let head = 0;

    for (let k = 0; k < 4; k += 1) {
      const weight = skinWeight.getComponent(i, k);
      if (weight <= 0) continue;
      const bone = bones[skinIndex.getComponent(i, k)];
      const group = boneGroup(bone?.name);
      if (group === 0) torso += weight;
      else if (group === 1) armL += weight;
      else if (group === 2) armR += weight;
      else if (group === 3) legL += weight;
      else if (group === 4) legR += weight;
      else if (group === 5) head += weight;
    }

    const offset = i * 6;
    weights[offset] = torso;
    weights[offset + 1] = armL;
    weights[offset + 2] = armR;
    weights[offset + 3] = legL;
    weights[offset + 4] = legR;
    weights[offset + 5] = head;
  }

  return weights;
}

function buildTorsoTable(geometry, groupWeights, baseHeight) {
  const bins = 96;
  const table = Array.from({ length: bins }, () => ({ count: 0, maxAbsX: 0, zMin: Infinity, zMax: -Infinity }));
  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i += 1) {
    const torsoWeight = groupWeights[i * 6];
    if (torsoWeight < 0.45) continue;

    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    if (y <= 0.02 || y >= baseHeight * 0.995) continue;
    if (Math.abs(x) > baseHeight * 0.38) continue;

    const index = clamp(Math.floor((y / baseHeight) * bins), 0, bins - 1);
    const bin = table[index];
    bin.count += 1;
    bin.maxAbsX = Math.max(bin.maxAbsX, Math.abs(x));
    bin.zMin = Math.min(bin.zMin, z);
    bin.zMax = Math.max(bin.zMax, z);
  }

  const values = table.map((bin) =>
    bin.count > 0
      ? {
          rx: Math.max(bin.maxAbsX, 0.02),
          rz: Math.max((bin.zMax - bin.zMin) / 2, 0.02),
          cz: (bin.zMin + bin.zMax) / 2,
        }
      : null,
  );

  fillTable(values);
  return makeSampler(values);
}

function buildLegTable(geometry, groupWeights, baseHeight, side) {
  const bins = 72;
  const table = Array.from({ length: bins }, () => ({
    count: 0,
    minX: Infinity,
    maxX: -Infinity,
    zMin: Infinity,
    zMax: -Infinity,
  }));
  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i += 1) {
    const legWeight = groupWeights[i * 6 + 3] + groupWeights[i * 6 + 4];
    if (legWeight < 0.5) continue;

    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    if (y <= baseHeight * 0.028 || y >= baseHeight * 0.63) continue;
    if (side < 0 && x > 0) continue;
    if (side > 0 && x < 0) continue;

    const index = clamp(Math.floor((y / baseHeight) * bins), 0, bins - 1);
    const bin = table[index];
    bin.count += 1;
    bin.minX = Math.min(bin.minX, x);
    bin.maxX = Math.max(bin.maxX, x);
    bin.zMin = Math.min(bin.zMin, z);
    bin.zMax = Math.max(bin.zMax, z);
  }

  const values = table.map((bin) =>
    bin.count > 0
      ? {
          rx: Math.max((bin.maxX - bin.minX) / 2, 0.018),
          cx: (bin.maxX + bin.minX) / 2,
          rz: Math.max((bin.zMax - bin.zMin) / 2, 0.018),
          cz: (bin.zMin + bin.zMax) / 2,
        }
      : null,
  );

  fillTable(values);
  return makeSampler(values);
}

function fillTable(table) {
  let first = -1;
  for (let i = 0; i < table.length; i += 1) {
    if (table[i]) {
      first = i;
      break;
    }
  }
  if (first < 0) return;

  for (let i = 0; i < first; i += 1) table[i] = { ...table[first] };

  let last = first;
  for (let i = first + 1; i < table.length; i += 1) {
    if (!table[i]) continue;
    const gap = i - last;
    const a = table[last];
    const b = table[i];
    for (let j = 1; j < gap; j += 1) {
      const t = j / gap;
      table[last + j] = {
        rx: lerp(a.rx, b.rx, t),
        rz: lerp(a.rz, b.rz, t),
        cz: lerp(a.cz, b.cz, t),
        cx: a.cx === undefined ? undefined : lerp(a.cx, b.cx, t),
      };
    }
    last = i;
  }
  for (let i = last + 1; i < table.length; i += 1) table[i] = { ...table[last] };
}

function makeSampler(values) {
  return {
    values,
    sample(normalizedY) {
      const t = clamp(normalizedY, 0, 1) * (values.length - 1);
      const index = Math.floor(t);
      const next = Math.min(values.length - 1, index + 1);
      const amount = t - index;
      const a = values[index];
      const b = values[next];
      return {
        rx: lerp(a.rx, b.rx, amount),
        rz: lerp(a.rz, b.rz, amount),
        cz: lerp(a.cz, b.cz, amount),
        cx: a.cx === undefined ? 0 : lerp(a.cx, b.cx, amount),
      };
    },
  };
}

function measureShoulderHalf(geometry, baseHeight) {
  const positions = geometry.attributes.position;
  let max = 0;
  for (let i = 0; i < positions.count; i += 1) {
    const x = Math.abs(positions.getX(i));
    const y = positions.getY(i);
    if (y > baseHeight * 0.78 && y < baseHeight * 0.86 && x < baseHeight * 0.38) {
      max = Math.max(max, x);
    }
  }
  return max || baseHeight * 0.13;
}

/* ------------------------------------------------------------------ */
/* Deformación                                                         */
/* ------------------------------------------------------------------ */

function makeRingSampler(rings) {
  const sorted = rings.slice().sort((a, b) => a.y - b.y);
  return {
    sample(normalizedY) {
      if (!sorted.length) return { rx: 0.1, rz: 0.1, cx: 0, cz: 0 };
      if (normalizedY <= sorted[0].y) return sorted[0];
      if (normalizedY >= sorted[sorted.length - 1].y) return sorted[sorted.length - 1];

      let index = 0;
      while (index < sorted.length - 1 && sorted[index + 1].y < normalizedY) index += 1;
      const a = sorted[index];
      const b = sorted[index + 1];
      const t = (normalizedY - a.y) / (b.y - a.y || 1);
      return {
        rx: lerp(a.rx, b.rx, t),
        rz: lerp(a.rz, b.rz, t),
        cx: lerp(a.cx || 0, b.cx || 0, t),
        cz: lerp(a.cz || 0, b.cz || 0, t),
      };
    },
  };
}

function buildTargets(body) {
  const height = body.profile.height_cm;
  const torso = body.torso.map((ring) => ({
    y: ring.y / height,
    rx: ring.rx / 100,
    rz: ring.rz / 100,
    cz: ring.cz / 100,
  }));
  const legLeft = body.legs.find((limb) => limb.side < 0);
  const legRight = body.legs.find((limb) => limb.side > 0);
  const toLegRings = (limb) =>
    (limb?.rings || []).map((ring) => ({
      y: ring.center.y / height,
      rx: ring.rx / 100,
      rz: ring.rz / 100,
      cx: ring.center.x / 100,
      cz: ring.center.z / 100,
    }));

  return {
    torso: makeRingSampler(torso),
    legLeft: makeRingSampler(toLegRings(legLeft)),
    legRight: makeRingSampler(toLegRings(legRight)),
    torsoHipCz: (() => {
      const hip = body.landmarks.hip_y_cm / height;
      return torso.length ? makeRingSampler(torso).sample(hip).cz : 0;
    })(),
  };
}

function sameProfile(a, b) {
  if (!a || !b) return false;
  const numberKeys = ['height_cm', 'bust_cm', 'waist_cm', 'hips_cm', 'shoulder_cm', 'inseam_cm'];
  for (const key of numberKeys) {
    if (Math.abs((a[key] ?? 0) - (b[key] ?? 0)) > 0.5) return false;
  }
  const traitKeys = ['weight_kg', 'body_fat_pct', 'bust_projection', 'seat', 'belly', 'shoulder_slope', 'muscle', 'posture'];
  for (const key of traitKeys) {
    if (Math.abs((a[key] ?? 0) - (b[key] ?? 0)) > 0.02) return false;
  }
  return a.sex === b.sex;
}

function deform() {
  if (!state.model || !state.mesh) return;

  const body = buildBody(state.profile);
  state.body = body;
  const targets = buildTargets(body);
  const model = state.model;
  const positions = model.geometry.attributes.position;
  const base = model.basePositions;
  const weights = model.groupWeights;
  const baseHeight = model.baseHeight;
  const heightM = body.profile.height_cm / 100;
  const heightScale = (state.profile.height_cm / 100) / baseHeight;
  // Para el cuerpo del anuncio, la malla original ya es la mejor referencia:
  // solo se escala la altura y se sustituye la cabeza por el óvalo liso. En
  // cuanto el usuario cambia una medida, un preset o un trait, se aplica la
  // deformación completa.
  const shapeStrength = sameProfile(state.profile, state.baselineProfile) ? 0 : 1;
  const baseScale = shapeStrength === 0 ? heightScale : 1;
  const normalScale = new Float32Array(positions.count * 3);
  const profile = state.profile;
  const frame =
    ((profile.bust_cm + profile.waist_cm + profile.hips_cm) / (92 + 78 + 96)) /
    (profile.height_cm / 175);
  const armScale = frame > 1 ? 1 + (frame - 1) * 0.45 : 1;
  const legBoost = clamp(1 + (frame - 1) * 0.35, 1, 1.25);
  // La base ya está proporcionada. Si aplicamos el 100% de la diferencia
  // entre sus tablas y las medidas del anuncio, el torso se estrecha y las
  // piernas/brazos pierden volumen. Dejamos que la malla crezca cuando el
  // perfil es más grande, pero que se estreche poco cuando es más pequeño:
  // así el maniquí responde a las medidas sin romper la anatomía original.
  const softScale = (ratio, expand = 0.8, shrink = 0.35) =>
    1 + (ratio - 1) * (ratio > 1 ? expand : shrink);
  const rawShoulder = state.profile.shoulder_cm / 200;
  const shoulderDelta = shapeStrength === 0
    ? 0
    : clamp(
        (rawShoulder - model.shoulderHalf) * (rawShoulder > model.shoulderHalf ? 0.8 : 0.35),
        -0.03,
        0.045,
      );
  const makeArmAxis = (joint) => {
    if (!joint) return null;
    const axis = new THREE.Vector3().subVectors(joint.wrist, joint.shoulder);
    return { shoulder: joint.shoulder, axis, denominator: axis.lengthSq() };
  };
  const hipY = body.landmarks.hip_y_cm / 100;
  const legFade = 0.09 * (body.profile.height_cm / 100);
  const ankleNorm = body.landmarks.ankle_y_cm / body.profile.height_cm;
  const armAxes = { negative: null, positive: null };
  if (model.armJoints) {
    const leftAxis = makeArmAxis(model.armJoints.left);
    const rightAxis = makeArmAxis(model.armJoints.right);
    for (const axis of [leftAxis, rightAxis]) {
      if (!axis) continue;
      if (axis.shoulder.x < 0) armAxes.negative = axis;
      else armAxes.positive = axis;
    }
  }

  for (let i = 0; i < positions.count; i += 1) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const bz = base[i * 3 + 2];
    const normalizedY = clamp(by / baseHeight, 0, 1);

    let dx = 0;
    let dy = 0;
    let dz = 0;
    let invX = 1;
    let invY = 1 / heightScale;
    let invZ = 1;

    const torsoWeight = weights[i * 6];
    if (torsoWeight > 0 && shapeStrength > 0) {
      const b = model.torso.sample(normalizedY);
      const t = targets.torso.sample(normalizedY);
      const sx = softScale(clamp(t.rx / Math.max(b.rx, 0.015), 0.6, 1.7));
      const sz = softScale(clamp(t.rz / Math.max(b.rz, 0.015), 0.6, 1.7));
      const zBias = (t.cz - targets.torsoHipCz) * 0.35;
      dx += torsoWeight * (bx * sx - bx);
      dz += torsoWeight * (b.cz + (bz - b.cz) * sz + zBias - bz);
      invX += torsoWeight * (1 / sx - 1);
      invZ += torsoWeight * (1 / sz - 1);
    }

    const legWeight = weights[i * 6 + 3] + weights[i * 6 + 4];
    if (legWeight > 0 && by > baseHeight * 0.045 && shapeStrength > 0) {
      // Cerca de la cadera manda el torso; la pierna entra con un fade para
      // que no haya un escalón entre el glúteo y el muslo.
      const fade = clamp((hipY - by * heightScale) / legFade, 0, 1);
      if (fade > 0) {
        const negative = bx < 0;
        const b = model.legs[negative ? 0 : 1].sample(normalizedY);
        const t = (negative ? targets.legLeft : targets.legRight).sample(normalizedY);
        if (b && t) {
          const sx = softScale(clamp(clamp(t.rx / Math.max(b.rx, 0.012), 0.6, 1.7) * legBoost, 0.6, 1.8), 0.8, 0.3);
          const sz = softScale(clamp(clamp(t.rz / Math.max(b.rz, 0.012), 0.6, 1.7) * legBoost, 0.6, 1.8), 0.8, 0.3);
          const weight = legWeight * fade;
          dx += weight * (b.cx + (bx - b.cx) * sx + (t.cx - b.cx) * 0.4 - bx);
          dz += weight * (b.cz + (bz - b.cz) * sz - bz);
          invX += weight * (1 / sx - 1);
          invZ += weight * (1 / sz - 1);
        }
      }
    }

    // Los pies quedan por debajo de la tabla de pierna. Les pasamos el
    // desplazamiento del tobillo para que no se queden atrás cuando la
    // pierna se mueve hacia dentro; el pie conserva su forma.
    const footBlend = legWeight * shapeStrength * clamp((0.045 - normalizedY) / 0.012, 0, 1);
    if (footBlend > 0) {
      const negative = bx < 0;
      const baseAnkle = model.legs[negative ? 0 : 1].sample(ankleNorm);
      const targetAnkle = (negative ? targets.legLeft : targets.legRight).sample(ankleNorm);
      if (baseAnkle && targetAnkle) {
        dx += footBlend * (targetAnkle.cx - baseAnkle.cx) * 0.9;
      }
    }

    const headWeight = weights[i * 6 + 5];
    if (model.head && headWeight > 0) {
      const hx = (bx - model.head.center.x) / model.head.rx;
      const hy = (by - model.head.center.y) / model.head.ry;
      const hz = (bz - model.head.center.z) / model.head.rz;
      const length = Math.hypot(hx, hy, hz) || 1;
      const tx = model.head.center.x + (hx / length) * model.head.rx;
      const ty = model.head.center.y + (hy / length) * model.head.ry;
      const tz = model.head.center.z + (hz / length) * model.head.rz;
      dx += headWeight * (tx - bx);
      dy += headWeight * (ty - by);
      dz += headWeight * (tz - bz);
    }

    const armWeight = weights[i * 6 + 1] + weights[i * 6 + 2];
    if (armWeight > 0 && shapeStrength > 0) {
      const arm = bx < 0 ? armAxes.negative : armAxes.positive;
      if (arm && arm.denominator > 1e-8) {
        const px = bx - arm.shoulder.x;
        const py = by - arm.shoulder.y;
        const pz = bz - arm.shoulder.z;
        const t = clamp(
          (px * arm.axis.x + py * arm.axis.y + pz * arm.axis.z) / arm.denominator,
          0,
          1,
        );
        const cx = arm.shoulder.x + arm.axis.x * t;
        const cy = arm.shoulder.y + arm.axis.y * t;
        const cz = arm.shoulder.z + arm.axis.z * t;
        dx += armWeight * (cx + (bx - cx) * armScale - bx);
        dy += armWeight * (cy + (by - cy) * armScale - by);
        dz += armWeight * (cz + (bz - cz) * armScale - bz);
        invX += armWeight * (1 / armScale - 1);
        invY += armWeight * (1 / armScale - 1);
        invZ += armWeight * (1 / armScale - 1);
      }
      dx += armWeight * (bx < 0 ? -1 : 1) * shoulderDelta;
    }

    normalScale[i * 3] = invX / baseScale;
    normalScale[i * 3 + 1] = invY;
    normalScale[i * 3 + 2] = invZ / baseScale;
    positions.setXYZ(i, (bx + dx) * baseScale, (by + dy) * heightScale, (bz + dz) * baseScale);
  }

  // Suavizado laplaciano suave: quita los picos de hombro/cintura que deja
  // la mezcla de escalas torso-pierna-brazo. La cabeza se salta: ya está
  // proyectada a un elipsoide liso.
  if (model.neighbors) {
    const current = new Float32Array(positions.array);
    const temp = new Float32Array(current.length);
    const hipY = body.landmarks.hip_y_cm / 100;
    const waistY = body.landmarks.waist_y_cm / 100;
    const shoulderY = body.landmarks.shoulder_y_cm / 100;
    for (let iteration = 0; iteration < 4; iteration += 1) {
      temp.set(current);
      for (let i = 0; i < positions.count; i += 1) {
        if (weights[i * 6 + 5] > 0.5) continue;
        // El suavizado global encoge los tubos de brazos y piernas. La malla
        // original ya es suave ahí; solo suavizamos las uniones del torso.
        const armWeight = weights[i * 6 + 1] + weights[i * 6 + 2];
        if (armWeight > 0.25) continue;
        const legWeight = weights[i * 6 + 3] + weights[i * 6 + 4];
        if (legWeight > 0.5) continue;
        const y = current[i * 3 + 1];
        const inHip = Math.abs(y - hipY) < 0.11 * heightM;
        const inWaist = Math.abs(y - waistY) < 0.08 * heightM;
        const inShoulder = Math.abs(y - shoulderY) < 0.07 * heightM;
        const extraPass =
          (iteration === 2 && !(inHip || inWaist || inShoulder)) ||
          (iteration === 3 && !inHip);
        if (extraPass) continue;
        const neighbors = model.neighbors[i];
        if (!neighbors.length) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (const neighbor of neighbors) {
          sx += current[neighbor * 3];
          sy += current[neighbor * 3 + 1];
          sz += current[neighbor * 3 + 2];
        }
        const inverse = 1 / neighbors.length;
        const lambda = iteration >= 2 ? 0.22 : 0.18;
        temp[i * 3] = current[i * 3] + lambda * (sx * inverse - current[i * 3]);
        temp[i * 3 + 1] = current[i * 3 + 1] + lambda * (sy * inverse - current[i * 3 + 1]);
        temp[i * 3 + 2] = current[i * 3 + 2] + lambda * (sz * inverse - current[i * 3 + 2]);
      }
      current.set(temp);
    }

    // El pecho base conserva el relieve del pezón aunque quitemos la
    // primitiva de la areola. Suavizamos la profundidad de esa zona para que
    // el maniquí quede liso también en tallas grandes, sin tocar los brazos.
    const chestY = (body.landmarks.bust_y_cm ?? body.landmarks.chest_y_cm) / 100;
    const chestTop = chestY + 0.06 * heightM;
    const chestBottom = chestY - 0.06 * heightM;
    const chestHalfWidth = 0.13 * (heightM / 1.75);
    for (let iteration = 0; iteration < 14; iteration += 1) {
      temp.set(current);
      for (let i = 0; i < positions.count; i += 1) {
        const x = current[i * 3];
        const y = current[i * 3 + 1];
        const z = current[i * 3 + 2];
        if (z < 0.012 || y < chestBottom || y > chestTop) continue;
        if (Math.abs(x) > chestHalfWidth) continue;
        if (weights[i * 6 + 1] + weights[i * 6 + 2] > 0.15) continue;
        const neighbors = model.neighbors[i];
        if (!neighbors.length) continue;
        let sum = 0;
        for (const neighbor of neighbors) sum += current[neighbor * 3 + 2];
        temp[i * 3 + 2] = z + 0.34 * (sum / neighbors.length - z);
      }
      current.set(temp);
    }

    // La malla base trae un relieve genital muy marcado. En un maniquí debe
    // quedar liso: suavizamos solo la profundidad (Z) del centro del pubis,
    // sin tocar caderas ni piernas, hasta difuminar el relieve.
    const crotchY = body.landmarks.crotch_y_cm / 100;
    const crotchTop = crotchY + 0.05 * heightM;
    const crotchBottom = crotchY - 0.045 * heightM;
    const crotchHalfWidth = 0.095 * (heightM / 1.75);
    for (let iteration = 0; iteration < 8; iteration += 1) {
      temp.set(current);
      for (let i = 0; i < positions.count; i += 1) {
        const x = current[i * 3];
        const y = current[i * 3 + 1];
        const z = current[i * 3 + 2];
        if (z < 0.015 || y < crotchBottom || y > crotchTop) continue;
        if (Math.abs(x) > crotchHalfWidth) continue;
        const neighbors = model.neighbors[i];
        if (!neighbors.length) continue;
        let sum = 0;
        for (const neighbor of neighbors) sum += current[neighbor * 3 + 2];
        temp[i * 3 + 2] = z + 0.42 * (sum / neighbors.length - z);
      }
      current.set(temp);
    }

    positions.array.set(current);
    positions.needsUpdate = true;
  }


  const normals = model.geometry.attributes.normal;
  const baseNormals = model.baseNormals;
  for (let i = 0; i < positions.count; i += 1) {
    let nx = baseNormals[i * 3] * normalScale[i * 3];
    let ny = baseNormals[i * 3 + 1] * normalScale[i * 3 + 1];
    let nz = baseNormals[i * 3 + 2] * normalScale[i * 3 + 2];
    let length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;

    const headWeight = weights[i * 6 + 5];
    if (model.head && headWeight > 0.4) {
      const px = positions.getX(i) - model.head.center.x;
      const py = positions.getY(i) - model.head.center.y;
      const pz = positions.getZ(i) - model.head.center.z;
      const ex = px / (model.head.rx * model.head.rx);
      const ey = py / (model.head.ry * model.head.ry);
      const ez = pz / (model.head.rz * model.head.rz);
      const ellipsoidLength = Math.hypot(ex, ey, ez) || 1;
      const blend = clamp((headWeight - 0.4) / 0.6, 0, 1) * 0.95;
      nx = lerp(nx, ex / ellipsoidLength, blend);
      ny = lerp(ny, ey / ellipsoidLength, blend);
      nz = lerp(nz, ez / ellipsoidLength, blend);
      length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
    }

    normals.setXYZ(i, nx, ny, nz);
  }
  // Las normales base de la areola siguen marcando un aro oscuro al
  // deformar la talla Plus. Suavizamos solo las normales del pecho para que
  // el maniquí se lea liso sin borrar la forma de la mama.
  const chestNormalY = (body.landmarks.bust_y_cm ?? body.landmarks.chest_y_cm) / 100;
  const chestNormalTop = chestNormalY + 0.1 * heightM;
  const chestNormalBottom = chestNormalY - 0.1 * heightM;
  const chestNormalHalfWidth = 0.18 * (heightM / 1.75);
  for (let pass = 0; pass < 80; pass += 1) {
    const snapshot = normals.array.slice();
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      if (z < 0.012 || y < chestNormalBottom || y > chestNormalTop) continue;
      if (Math.abs(x) > chestNormalHalfWidth) continue;
      if (weights[i * 6 + 1] + weights[i * 6 + 2] > 0.15) continue;
      const neighbors = model.neighbors[i];
      if (!neighbors.length) continue;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (const neighbor of neighbors) {
        nx += snapshot[neighbor * 3];
        ny += snapshot[neighbor * 3 + 1];
        nz += snapshot[neighbor * 3 + 2];
      }
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.setXYZ(i, nx / length, ny / length, nz / length);
    }
  }
  normals.needsUpdate = true;
  model.geometry.computeBoundingSphere();

  if (state.lastHeight !== state.profile.height_cm) {
    state.lastHeight = state.profile.height_cm;
    if (camera && controls) reframePreservingView();
  }

  updateFit();
  scheduleGarment();
}


function scheduleDeform(immediate = false) {
  if (immediate) {
    cancelAnimationFrame(state.deformFrame);
    state.deformFrame = 0;
    deform();
    return;
  }
  if (state.deformFrame) return;
  state.deformFrame = requestAnimationFrame(() => {
    state.deformFrame = 0;
    deform();
  });
}

/* ------------------------------------------------------------------ */
/* Prenda 3D                                                           */
/* ------------------------------------------------------------------ */

const GARMENT_TYPE_LABEL = {
  tshirt: 'Camiseta',
  hoodie: 'Sudadera',
  dress: 'Vestido',
  jeans: 'Vaquero',
  jacket: 'Chaqueta',
  skirt: 'Falda',
};

const FABRIC_LABEL = {
  cotton_jersey: 'punto de algodón',
  fleece: 'felpa',
  denim: 'denim',
  knit: 'punto',
  linen: 'lino',
  leather: 'piel',
};

function garmentKey() {
  if (!state.listing || !state.profile) return '';
  const p = state.profile;
  return [
    state.listing.id,
    state.sex,
    p.height_cm, p.bust_cm, p.waist_cm, p.hips_cm, p.shoulder_cm, p.inseam_cm,
    p.bust_projection, p.seat, p.belly, p.shoulder_slope,
  ].join(':');
}

function disposeGarment() {
  if (!state.garment) return;
  state.garment.dispose();
  state.garment = null;
  state.garmentKey = '';
}

function updateGarmentStatus() {
  const status = $('garment-status');
  const text = $('garment-status-text');
  const sim = $('sim-note');
  if (!state.garment) {
    if (status) status.hidden = true;
    if (sim) sim.textContent = 'Sin prenda 3D';
    return;
  }
  if (status) status.hidden = false;
  if (text) {
    const meta = state.garment.meta;
    text.textContent = `${GARMENT_TYPE_LABEL[meta.type] || 'Prenda'} · ${FABRIC_LABEL[meta.fabric] || meta.fabric}`;
  }
  if (sim) {
    sim.textContent = `Caída simulada · ${Math.round(state.garment.meta.vertices / 100) / 10}k vértices`;
  }
}

async function rebuildGarment(force = false) {
  if (!state.model || !state.body || !state.listing || !state.fit) return;
  const key = garmentKey();
  if (!force && key === state.garmentKey && state.garment) return;

  clearTimeout(state.garmentTimer);
  state.garmentTimer = 0;

  const textures = state.garmentTextures || (await state.garmentTexturesPromise);
  if (!state.model || !state.body || !state.listing) return;

  if (state.garment) {
    state.garment.dispose();
    state.garment = null;
  }

  try {
    const garment = buildGarment({
      listing: state.listing,
      body: state.body,
      model: state.model,
      fit: state.fit,
      textures,
    });
    if (!garment) {
      console.warn('[probador] No se pudo construir la prenda', state.listing.id);
      state.garmentKey = key;
      updateGarmentStatus();
      return;
    }
    garment.group.visible = true;
    garment.setHeatmap(state.heatmap);
    scene.add(garment.group);
    state.garment = garment;
    state.garmentKey = key;
    updateGarmentStatus();
    console.info(
      `[probador] prenda ${garment.meta.type}/${garment.meta.fabric} · ` +
      `${garment.meta.vertices} vértices · ${Math.round(garment.meta.triangles)} triángulos`,
    );
  } catch (error) {
    console.error('[probador] Error construyendo la prenda', error);
    state.garmentKey = '';
    updateGarmentStatus();
  }
}

function scheduleGarment() {
  clearTimeout(state.garmentTimer);
  state.garmentTimer = setTimeout(() => {
    state.garmentTimer = 0;
    rebuildGarment();
  }, 150);
}

/* ------------------------------------------------------------------ */
/* Fit                                                                 */
/* ------------------------------------------------------------------ */

const FIT_BANDS = {
  tshirt: { tooSmall: -2, tight: 3, regular: 10, loose: 20 },
  hoodie: { tooSmall: 2, tight: 8, regular: 16, loose: 28 },
  dress: { tooSmall: 0, tight: 4, regular: 10, loose: 20 },
  jacket: { tooSmall: 4, tight: 10, regular: 20, loose: 32 },
  jeans: { tooSmall: -1, tight: 2, regular: 6, loose: 12 },
  skirt: { tooSmall: 0, tight: 4, regular: 10, loose: 18 },
};

const FABRIC_THICKNESS_CM = {
  cotton_jersey: 0.15,
  fleece: 0.35,
  denim: 0.35,
  knit: 0.25,
  linen: 0.18,
  leather: 0.4,
};

function classifyEase(ease, band) {
  if (ease < band.tooSmall) return 'too_small';
  if (ease < band.tight) return 'tight';
  if (ease <= band.regular) return 'regular';
  if (ease <= band.loose) return 'loose';
  return 'too_big';
}

function computeFit(listing, body) {
  const garment = listing.garment || {};
  const measurements = garment.measurements || {};
  const type = garment.type || 'tshirt';
  const band = FIT_BANDS[type] || FIT_BANDS.tshirt;
  const thickness = FABRIC_THICKNESS_CM[garment.fabric] ?? 0.2;
  const overhead = 2 * Math.PI * thickness;
  const profile = body.profile;
  const zones = [];

  const addZone = (name, garmentCm, bodyCm) => {
    if (!Number.isFinite(garmentCm) || !Number.isFinite(bodyCm)) return;
    const ease = garmentCm - bodyCm - overhead;
    zones.push({
      name,
      ease_cm: ease,
      garment_cm: garmentCm,
      body_cm: bodyCm,
      verdict: classifyEase(ease, band),
    });
  };

  if (type === 'tshirt' || type === 'hoodie' || type === 'jacket') {
    addZone('Pecho', (measurements.pit_to_pit_cm ?? NaN) * 2, profile.bust_cm);
  } else if (type === 'dress') {
    addZone('Pecho', (measurements.pit_to_pit_cm ?? NaN) * 2, profile.bust_cm);
    addZone('Cintura', (measurements.waist_cm ?? NaN) * 2, profile.waist_cm);
    addZone('Cadera', (measurements.hips_cm ?? NaN) * 2, profile.hips_cm);
  } else if (type === 'jeans') {
    addZone('Cintura', (measurements.waist_cm ?? NaN) * 2, profile.waist_cm);
    addZone('Muslo', (measurements.thigh_cm ?? NaN) * 2, profile.thigh_cm);
    addZone('Cadera', (measurements.hips_cm ?? NaN) * 2, profile.hips_cm);
  } else if (type === 'skirt') {
    addZone('Cintura', (measurements.waist_cm ?? NaN) * 2, profile.waist_cm);
    addZone('Cadera', (measurements.hips_cm ?? NaN) * 2, profile.hips_cm);
  }

  const critical = zones.reduce(
    (best, zone) => (zone.ease_cm < best.ease_cm ? zone : best),
    zones[0] || null,
  );

  const required = type === 'dress' ? 2 : type === 'jeans' || type === 'skirt' ? 1 : 1;
  const coverage = clamp(zones.length / required, 0, 1);
  const confidence = clamp(
    0.42 + 0.3 * coverage + 0.18 * body.confidence + 0.1 * Math.min(zones.length / 3, 1),
    0,
    1,
  );
  const verdict = critical ? classifyEase(critical.ease_cm, band) : 'regular';

  const missing = [];
  if ((type === 'tshirt' || type === 'hoodie' || type === 'jacket') && !Number.isFinite(measurements.pit_to_pit_cm)) {
    missing.push('axila a axila');
  }
  if ((type === 'dress' || type === 'jeans' || type === 'skirt') && !Number.isFinite(measurements.waist_cm)) {
    missing.push('cintura');
  }
  if (type === 'dress' && !Number.isFinite(measurements.pit_to_pit_cm)) {
    missing.push('pecho');
  }

  return {
    verdict,
    ease_cm: critical ? critical.ease_cm : 0,
    critical,
    zones,
    confidence,
    missing,
    band,
    thickness,
  };
}

const VERDICT_TITLES = {
  too_small: 'Te queda pequeño',
  tight: 'Te queda justo',
  regular: 'Te queda bien',
  loose: 'Te queda holgado',
  too_big: 'Te queda grande',
};

const VERDICT_COLORS = {
  too_small: '#b3261e',
  tight: '#a15c00',
  regular: '#007782',
  loose: '#2f5d8a',
  too_big: '#5b5b57',
};

function formatSigned(value) {
  const amount = Math.abs(value).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${value < 0 ? '−' : '+'}${amount} cm`;
}

function updateFit() {
  if (!state.listing || !state.body) return;
  const fit = computeFit(state.listing, state.body);
  state.fit = fit;

  $('verdict-title').textContent = VERDICT_TITLES[fit.verdict] || 'Calculado';

  if (fit.critical) {
    $('verdict-detail').textContent =
      `${fit.critical.name}: ${formatSigned(fit.critical.ease_cm)} de holgura · ` +
      `${fit.zones.length} ${fit.zones.length === 1 ? 'zona medida' : 'zonas medidas'}`;
  } else {
    $('verdict-detail').textContent = 'Faltan medidas de la prenda para calcular la holgura.';
  }

  const zones = $('zones');
  zones.replaceChildren();
  for (const zone of fit.zones) {
    const row = document.createElement('div');
    row.className = 'zone';

    const name = document.createElement('span');
    name.className = 'zone-name';
    name.textContent = zone.name;

    const track = document.createElement('span');
    track.className = 'zone-track';
    const fill = document.createElement('span');
    const width = clamp((zone.ease_cm + 10) / 40, 0, 1) * 100;
    fill.style.width = `${width}%`;
    fill.style.setProperty('--zone-color', VERDICT_COLORS[zone.verdict] || VERDICT_COLORS.regular);
    track.append(fill);

    const value = document.createElement('span');
    value.className = 'zone-value';
    value.textContent = formatSigned(zone.ease_cm);

    row.append(name, track, value);
    zones.append(row);
  }

  $('confidence-fill').style.width = `${Math.round(fit.confidence * 100)}%`;
  $('confidence-value').textContent = `${Math.round(fit.confidence * 100)}%`;

  const missing = $('missing');
  if (fit.missing.length) {
    missing.textContent = `Falta en el anuncio: ${fit.missing.join(', ')}. El veredicto usa solo las zonas medidas.`;
    missing.hidden = false;
  } else {
    missing.hidden = true;
  }

  const bodyLine = $('body-line');
  if (bodyLine) {
    const profile = state.body.profile;
    bodyLine.textContent =
      `${Math.round(profile.height_cm)} cm · ` +
      `${Math.round(profile.bust_cm)}-${Math.round(profile.waist_cm)}-${Math.round(profile.hips_cm)} cm · ` +
      `hombro ${Math.round(profile.shoulder_cm)} cm · entrepierna ${Math.round(profile.inseam_cm)} cm`;
  }
}

/* ------------------------------------------------------------------ */
/* Handshake, UI y ciclo de vida                                       */
/* ------------------------------------------------------------------ */

function postReady() {
  if (state.readySent) return;
  state.readySent = true;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'segunda:ready' }, '*');
  }
}

function closeViewer() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'segunda:close' }, '*');
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  // window.close() is blocked for tabs opened with rel="noopener".
  window.location.assign('../');
}

function showLoading(show) {
  $('loading').classList.toggle('is-hidden', !show);
}

function bindUi() {
  $('close').addEventListener('click', closeViewer);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeViewer();
  });

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => setView(button.dataset.view));
  }

  $('retry').addEventListener('click', () => {
    $('error').hidden = true;
    loadModel(state.sex);
  });

  $('heatmap-toggle')?.addEventListener('click', () => {
    state.heatmap = !state.heatmap;
    const button = $('heatmap-toggle');
    button.setAttribute('aria-pressed', String(state.heatmap));
    button.textContent = state.heatmap ? 'Ocultar mapa de tensión' : 'Ver mapa de tensión';
    state.garment?.setHeatmap(state.heatmap);
  });
}

function init() {
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
  document.body.classList.toggle('is-embed', embedded);
  readListing();
  initThree();
  bindUi();
  bindMeasureInputs();
  bindPersonalInputs();
  bindTabs();
  loadModel(state.sex);
  window.__spDebug = {
    state,
    get scene() { return scene; },
    get camera() { return camera; },
    get controls() { return controls; },
  };
  // El padre no debe esperar a que termine la descarga del GLB: el visor ya
  // tiene su propio loader a pantalla completa mientras carga la base mesh.
  postReady();
}

init();
