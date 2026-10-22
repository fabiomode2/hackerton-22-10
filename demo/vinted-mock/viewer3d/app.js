/**
 * Probador 3D — Segunda Piel.
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
import { buildBody, superellipsePoint } from './body-engine.js';

const $ = (id) => document.getElementById(id);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

const SKIN_COLOR = new THREE.Color(0xe1d0bb).convertSRGBToLinear();
const FABRIC_COLOR = new THREE.Color(0x2f3e3e).convertSRGBToLinear();
const BAND_COLOR = new THREE.Color(0x3a4a47).convertSRGBToLinear();

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
  body: null,
  fit: null,
  model: null,
  mesh: null,
  cameraGoal: null,
  lastHeight: null,
  deformFrame: 0,
  readySent: false,
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
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
  scene.environmentIntensity = 0.45;

  const hemi = new THREE.HemisphereLight(0xfff7ea, 0x8b8074, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff2de, 2.0);
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
  key.shadow.normalBias = 0.02;
  key.target.position.set(0, 0.9, 0);
  scene.add(key);
  scene.add(key.target);

  const fill = new THREE.DirectionalLight(0xbfd8d8, 0.6);
  fill.position.set(-3.2, 2.4, 1.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe4c4, 1.0);
  rim.position.set(-1.8, 3.4, -3.6);
  scene.add(rim);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.58, 0.035, 72),
    new THREE.MeshStandardMaterial({ color: 0xdcd7cf, roughness: 0.93, metalness: 0 }),
  );
  platform.position.y = -0.018;
  platform.receiveShadow = true;
  scene.add(platform);

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({ color: 0x241f18, opacity: 0.16 }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.001;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  state.underwearGroup = new THREE.Group();
  state.underwearMaterial = new THREE.MeshStandardMaterial({
    color: BAND_COLOR,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  scene.add(state.underwearGroup);

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
  return Math.max(distanceV, distanceH) * 1.28;
}

function viewAngles(name) {
  if (name === 'front') return { azimuth: 0, elevation: 0.06 };
  if (name === 'side') return { azimuth: Math.PI * 0.47, elevation: 0.04 };
  return { azimuth: 0.34, elevation: 0.07 };
}

function setView(name, immediate = false) {
  if (!camera || !controls || !state.profile) return;
  const target = new THREE.Vector3(0, (state.profile.height_cm / 100) * 0.53, 0);
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
  const target = new THREE.Vector3(0, (state.profile.height_cm / 100) * 0.53, 0);
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

function updateBodyShader(material, body) {
  const shader = material?.userData?.shader;
  if (!shader || !body) return;
  const uniforms = shader.uniforms;
  uniforms.uHeight.value = body.profile.height_cm / 100;
  uniforms.uHipY.value = body.landmarks.hip_y_cm / 100;
  uniforms.uWaistbandY.value = (body.landmarks.hip_y_cm + 0.055 * body.profile.height_cm) / 100;
  uniforms.uCrotchY.value = body.landmarks.crotch_y_cm / 100;
  uniforms.uHipHalf.value = Math.max(body.landmarks.hip_width_cm / 200, 0.05);
  uniforms.uUnderbustY.value = body.landmarks.underbust_y_cm / 100;
  uniforms.uChestY.value = body.landmarks.chest_y_cm / 100;
  uniforms.uShoulderHalf.value = body.landmarks.shoulder_width_cm / 200;
  uniforms.uFemale.value = body.profile.sex === 'female' ? 1 : 0;
}

async function loadModel(sex) {
  showLoading(true);
  $('error').hidden = true;

  try {
    const loader = new GLTFLoader();
    const file = sex === 'male' ? './assets/male-base.glb' : './assets/female-base.glb';
    const gltf = await loader.loadAsync(file);
    gltf.scene.updateMatrixWorld(true);

    let source = null;
    gltf.scene.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      if (!source || object.geometry.attributes.position.count > source.geometry.attributes.position.count) {
        source = object;
      }
    });

    if (!source) throw new Error('La base mesh no contiene geometría.');
    const model = prepareModel(source);

    if (state.mesh) {
      scene.remove(state.mesh);
      state.mesh.geometry.dispose();
      state.mesh.material.dispose();
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.0,
      envMapIntensity: 0.45,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uSkin: { value: SKIN_COLOR.clone() },
        uFabric: { value: FABRIC_COLOR.clone() },
        uHeight: { value: 1.75 },
        uHipY: { value: 0.96 },
        uWaistbandY: { value: 1.06 },
        uCrotchY: { value: 0.8 },
        uHipHalf: { value: 0.18 },
        uUnderbustY: { value: 1.1 },
        uChestY: { value: 1.25 },
        uShoulderHalf: { value: 0.22 },
        uFemale: { value: 0 },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vBodyPosition;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvBodyPosition = position;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vBodyPosition;
           uniform vec3 uSkin;
           uniform vec3 uFabric;
           uniform float uHeight;
           uniform float uHipY;
           uniform float uWaistbandY;
           uniform float uCrotchY;
           uniform float uHipHalf;
           uniform float uUnderbustY;
           uniform float uChestY;
           uniform float uShoulderHalf;
           uniform float uFemale;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float side = clamp(abs(vBodyPosition.x) / max(uHipHalf, 0.05), 0.0, 1.0);
           float lower = uCrotchY - mix(0.055, 0.005 + side * 0.055, uFemale) * uHeight;
           float brief = step(lower, vBodyPosition.y) *
             (1.0 - step(uWaistbandY, vBodyPosition.y)) *
             (1.0 - step(uHipHalf * 1.45, abs(vBodyPosition.x)));
           float fabric = brief;
           if (uFemale > 0.5) {
             float band = (1.0 - step(0.018 * uHeight, abs(vBodyPosition.y - uUnderbustY))) *
               (1.0 - step(uShoulderHalf * 1.1, abs(vBodyPosition.x)));
             float cup = step(uUnderbustY, vBodyPosition.y) *
               (1.0 - step(uChestY + 0.01 * uHeight, vBodyPosition.y)) *
               step(0.01, vBodyPosition.z) *
               (1.0 - step(uShoulderHalf * 0.85, abs(vBodyPosition.x)));
             fabric = max(fabric, max(band, cup));
           }
           diffuseColor.rgb = mix(uSkin, uFabric, fabric);`,
        );
      material.userData.shader = shader;
      if (state.body) updateBodyShader(material, state.body);
    };

    const mesh = new THREE.Mesh(model.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);

    state.model = model;
    state.mesh = mesh;
    state.lastHeight = null;

    deform();
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
  const byName = new Map(skeleton.bones.map((bone) => [bone.name, bone]));
  const position = (name) => {
    const bone = byName.get(name);
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

  const baseHeight = geometry.boundingBox.max.y;
  const positions = geometry.attributes.position;
  const basePositions = new Float32Array(positions.array);
  const baseNormals = new Float32Array(geometry.attributes.normal.array);
  weldGeometryIndex(geometry);
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

function deform() {
  if (!state.model || !state.mesh) return;

  const body = buildBody(state.profile);
  state.body = body;
  if (new URLSearchParams(window.location.search).has('raw')) {
    updateFit();
    return;
  }
  const targets = buildTargets(body);
  const model = state.model;
  const positions = model.geometry.attributes.position;
  const base = model.basePositions;
  const weights = model.groupWeights;
  const baseHeight = model.baseHeight;
  const heightScale = (state.profile.height_cm / 100) / baseHeight;
  const shoulderDelta = clamp(state.profile.shoulder_cm / 200 - model.shoulderHalf, -0.045, 0.045);
  const normalScale = new Float32Array(positions.count * 3);
  const profile = state.profile;
  const frame =
    ((profile.bust_cm + profile.waist_cm + profile.hips_cm) / (92 + 78 + 96)) /
    (profile.height_cm / 175);
  const armScale = clamp(0.55 + 0.45 * frame, 0.85, 1.2);
  const legBoost = clamp(1 + (frame - 1) * 0.35, 0.92, 1.25);
  const makeArmAxis = (joint) => {
    if (!joint) return null;
    const axis = new THREE.Vector3().subVectors(joint.wrist, joint.shoulder);
    return { shoulder: joint.shoulder, axis, denominator: axis.lengthSq() };
  };
  const hipY = body.landmarks.hip_y_cm / 100;
  const legFade = 0.09 * (body.profile.height_cm / 100);
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
    if (torsoWeight > 0) {
      const b = model.torso.sample(normalizedY);
      const t = targets.torso.sample(normalizedY);
      const sx = clamp(t.rx / Math.max(b.rx, 0.015), 0.6, 1.7);
      const sz = clamp(t.rz / Math.max(b.rz, 0.015), 0.6, 1.7);
      const zBias = (t.cz - targets.torsoHipCz) * 0.35;
      dx += torsoWeight * (bx * sx - bx);
      dz += torsoWeight * (b.cz + (bz - b.cz) * sz + zBias - bz);
      invX += torsoWeight * (1 / sx - 1);
      invZ += torsoWeight * (1 / sz - 1);
    }

    const legWeight = weights[i * 6 + 3] + weights[i * 6 + 4];
    if (legWeight > 0 && by > baseHeight * 0.045) {
      // Cerca de la cadera manda el torso; la pierna entra con un fade para
      // que no haya un escalón entre el glúteo y el muslo.
      const fade = clamp((hipY - by * heightScale) / legFade, 0, 1);
      if (fade > 0) {
        const negative = bx < 0;
        const b = model.legs[negative ? 0 : 1].sample(normalizedY);
        const t = (negative ? targets.legLeft : targets.legRight).sample(normalizedY);
        if (b && t) {
          const sx = clamp(clamp(t.rx / Math.max(b.rx, 0.012), 0.6, 1.7) * legBoost, 0.6, 1.8);
          const sz = clamp(clamp(t.rz / Math.max(b.rz, 0.012), 0.6, 1.7) * legBoost, 0.6, 1.8);
          const weight = legWeight * fade;
          dx += weight * (b.cx + (bx - b.cx) * sx + (t.cx - b.cx) * 0.4 - bx);
          dz += weight * (b.cz + (bz - b.cz) * sz - bz);
          invX += weight * (1 / sx - 1);
          invZ += weight * (1 / sz - 1);
        }
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
    if (armWeight > 0) {
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

    normalScale[i * 3] = invX;
    normalScale[i * 3 + 1] = invY;
    normalScale[i * 3 + 2] = invZ;
    positions.setXYZ(i, bx + dx, (by + dy) * heightScale, bz + dz);
  }

  // Suavizado laplaciano suave: quita los picos de hombro/cintura que deja
  // la mezcla de escalas torso-pierna-brazo. La cabeza se salta: ya está
  // proyectada a un elipsoide liso.
  if (model.neighbors) {
    const current = new Float32Array(positions.array);
    const temp = new Float32Array(current.length);
    const heightM = body.profile.height_cm / 100;
    const hipY = body.landmarks.hip_y_cm / 100;
    const waistY = body.landmarks.waist_y_cm / 100;
    const shoulderY = body.landmarks.shoulder_y_cm / 100;
    for (let iteration = 0; iteration < 4; iteration += 1) {
      temp.set(current);
      for (let i = 0; i < positions.count; i += 1) {
        if (weights[i * 6 + 5] > 0.5) continue;
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
    positions.array.set(current);
    positions.needsUpdate = true;
  }

  updateBodyShader(state.mesh.material, body);
  updateUnderwear(body);

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
  normals.needsUpdate = true;
  model.geometry.computeBoundingSphere();

  if (state.lastHeight !== state.profile.height_cm) {
    state.lastHeight = state.profile.height_cm;
    if (camera && controls) reframePreservingView();
  }

  updateFit();
}


function sampleRingAtY(rings, y) {
  if (!rings.length) return null;
  if (y <= rings[0].y) return rings[0];
  if (y >= rings[rings.length - 1].y) return rings[rings.length - 1];

  let index = 0;
  while (index < rings.length - 1 && rings[index + 1].y < y) index += 1;
  const a = rings[index];
  const b = rings[index + 1];
  const t = (y - a.y) / (b.y - a.y || 1);
  return {
    y,
    rx: lerp(a.rx, b.rx, t),
    rz: lerp(a.rz, b.rz, t),
    cz: lerp(a.cz, b.cz, t),
    n: lerp(a.n, b.n, t),
  };
}

function createBand(ring, y, heightM, offsetM, thicknessM, centerX = 0, centerZ = ring.cz / 100) {
  const segments = 72;
  const positions = [];
  const indices = [];
  const y0 = y / 100 - heightM / 2;
  const y1 = y / 100 + heightM / 2;
  const rxIn = ring.rx / 100 + offsetM;
  const rzIn = ring.rz / 100 + offsetM;
  const rxOut = rxIn + thicknessM;
  const rzOut = rzIn + thicknessM;
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const inner = superellipsePoint(angle, rxIn, rzIn, ring.n);
    const outer = superellipsePoint(angle, rxOut, rzOut, ring.n);
    // 0 inner-top, 1 outer-top, 2 outer-bottom, 3 inner-bottom
    positions.push(
      inner.x + centerX, y1, inner.z + centerZ,
      outer.x + centerX, y1, outer.z + centerZ,
      outer.x + centerX, y0, outer.z + centerZ,
      inner.x + centerX, y0, inner.z + centerZ,
    );
  }

  const pushQuad = (a, b, c, d) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const a = i * 4;
    const b = next * 4;
    pushQuad(a + 0, b + 0, b + 1, a + 1); // top
    pushQuad(a + 3, b + 3, b + 2, a + 2); // bottom
    pushQuad(a + 0, a + 3, b + 3, b + 0); // inner
    pushQuad(a + 1, b + 1, b + 2, a + 2); // outer
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, state.underwearMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createStrap(points) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 20, 0.006, 6, false);
  const mesh = new THREE.Mesh(geometry, state.underwearMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function updateUnderwear(body) {
  const group = state.underwearGroup;
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.geometry.dispose();
  }

  const landmarks = body.landmarks;
  const heightCm = body.profile.height_cm;
  const waistbandY = landmarks.hip_y_cm + 0.055 * heightCm;
  const waistRing = sampleRingAtY(body.torso, waistbandY);
  if (waistRing) {
    group.add(createBand(waistRing, waistbandY, 0.02, 0.012, 0.004));
  }


  if (body.profile.sex !== 'female') return;
  const braRing = sampleRingAtY(body.torso, landmarks.underbust_y_cm);
  if (braRing) {
    group.add(createBand(braRing, landmarks.underbust_y_cm, 0.012, 0.009, 0.003));
  }
  const braTopRing = sampleRingAtY(body.torso, landmarks.chest_y_cm);
  if (braTopRing) {
    group.add(createBand(braTopRing, landmarks.chest_y_cm, 0.008, 0.009, 0.002));
  }

  const underbustY = landmarks.underbust_y_cm / 100;
  const shoulderY = landmarks.shoulder_y_cm / 100 + 0.005;
  const shoulderHalf = landmarks.shoulder_width_cm / 200;
  const frontZ = (braRing?.rz || 10) / 100 + 0.025;
  const backZ = -((braRing?.rz || 10) / 100) * 0.55;
  const x = shoulderHalf * 0.42;

  for (const side of [-1, 1]) {
    group.add(
      createStrap([
        new THREE.Vector3(side * x, underbustY + 0.012, frontZ),
        new THREE.Vector3(side * x * 1.08, shoulderY, 0),
        new THREE.Vector3(side * x * 0.85, underbustY + 0.018, backZ),
      ]),
    );
  }
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

const VERDICT_PILLS = {
  too_small: 'Talla pequeña',
  tight: 'Justo',
  regular: 'Bien',
  loose: 'Holgado',
  too_big: 'Grande',
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
  const pill = $('verdict-pill');
  pill.textContent = VERDICT_PILLS[fit.verdict] || '—';
  pill.dataset.verdict = fit.verdict;

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

  const profile = state.body.profile;
  $('body-line').textContent =
    `${Math.round(profile.height_cm)} cm · ` +
    `${Math.round(profile.bust_cm)}-${Math.round(profile.waist_cm)}-${Math.round(profile.hips_cm)} cm · ` +
    `hombro ${Math.round(profile.shoulder_cm)} cm · entrepierna ${Math.round(profile.inseam_cm)} cm`;
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
  if (window.history.length > 1) window.history.back();
  else window.close();
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
}

init();
