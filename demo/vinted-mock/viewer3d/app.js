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
import { buildBody } from './body-engine.js';

const $ = (id) => document.getElementById(id);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

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
  state.sex = listing.category === 'hombre' ? 'male' : listing.category === 'mujer' ? 'female' : 'neutral';
  state.profile = { ...listing.body, sex: state.sex };
  state.baseProfile = { ...state.profile };

  $('garment-name').textContent = listing.title || 'Prenda de segunda mano';
  $('size-badge').textContent = listing.size_label || '—';

  syncSliders();
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
      scheduleDeform();
    });
  }

  $('reset-measures').addEventListener('click', () => {
    state.profile = { ...state.baseProfile };
    syncSliders();
    scheduleDeform(true);
  });
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
      color: 0xbfae99,
      roughness: 0.72,
      metalness: 0.0,
      envMapIntensity: 0.45,
    });

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
  };
}

/**
 * Agrupa cada vértice por hueso dominante. Los pesos son continuos: un vértice
 * del hombro puede ser 60% torso y 40% brazo, y se deforma mezclando ambos.
 * 0 = torso, 1 = brazo izq., 2 = brazo der., 3 = pierna izq., 4 = pierna der.
 */
function boneGroup(name) {
  if (!name) return -1;
  const left = /(?:^|\.)L$/.test(name);
  const right = /(?:^|\.)R$/.test(name);
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
  const weights = new Float32Array(count * 5);
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
    }

    const offset = i * 5;
    weights[offset] = torso;
    weights[offset + 1] = armL;
    weights[offset + 2] = armR;
    weights[offset + 3] = legL;
    weights[offset + 4] = legR;
  }

  return weights;
}

function buildTorsoTable(geometry, groupWeights, baseHeight) {
  const bins = 96;
  const table = Array.from({ length: bins }, () => ({ count: 0, maxAbsX: 0, zMin: Infinity, zMax: -Infinity }));
  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i += 1) {
    const torsoWeight = groupWeights[i * 5];
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
  const weightIndex = side < 0 ? 3 : 4;

  for (let i = 0; i < positions.count; i += 1) {
    const legWeight = groupWeights[i * 5 + weightIndex];
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
  const makeArmAxis = (joint) => {
    if (!joint) return null;
    const axis = new THREE.Vector3().subVectors(joint.wrist, joint.shoulder);
    return { shoulder: joint.shoulder, axis, denominator: axis.lengthSq() };
  };
  const armAxes = model.armJoints
    ? { left: makeArmAxis(model.armJoints.left), right: makeArmAxis(model.armJoints.right) }
    : { left: null, right: null };

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

    const torsoWeight = weights[i * 5];
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

    const legLeftWeight = weights[i * 5 + 3];
    if (legLeftWeight > 0 && by > baseHeight * 0.045) {
      const b = model.legs[0].sample(normalizedY);
      const t = targets.legLeft.sample(normalizedY);
      const sx = clamp(t.rx / Math.max(b.rx, 0.012), 0.6, 1.7);
      const sz = clamp(t.rz / Math.max(b.rz, 0.012), 0.6, 1.7);
      dx += legLeftWeight * (b.cx + (bx - b.cx) * sx + (t.cx - b.cx) * 0.4 - bx);
      dz += legLeftWeight * (b.cz + (bz - b.cz) * sz - bz);
      invX += legLeftWeight * (1 / sx - 1);
      invZ += legLeftWeight * (1 / sz - 1);
    }

    const legRightWeight = weights[i * 5 + 4];
    if (legRightWeight > 0 && by > baseHeight * 0.045) {
      const b = model.legs[1].sample(normalizedY);
      const t = targets.legRight.sample(normalizedY);
      const sx = clamp(t.rx / Math.max(b.rx, 0.012), 0.6, 1.7);
      const sz = clamp(t.rz / Math.max(b.rz, 0.012), 0.6, 1.7);
      dx += legRightWeight * (b.cx + (bx - b.cx) * sx + (t.cx - b.cx) * 0.4 - bx);
      dz += legRightWeight * (b.cz + (bz - b.cz) * sz - bz);
      invX += legRightWeight * (1 / sx - 1);
      invZ += legRightWeight * (1 / sz - 1);
    }

    const armLeftWeight = weights[i * 5 + 1];
    const armRightWeight = weights[i * 5 + 2];
    const armWeight = armLeftWeight + armRightWeight;
    if (armWeight > 0) {
      const arm = armLeftWeight >= armRightWeight ? armAxes.left : armAxes.right;
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

  positions.needsUpdate = true;

  const normals = model.geometry.attributes.normal;
  const baseNormals = model.baseNormals;
  for (let i = 0; i < positions.count; i += 1) {
    const nx = baseNormals[i * 3] * normalScale[i * 3];
    const ny = baseNormals[i * 3 + 1] * normalScale[i * 3 + 1];
    const nz = baseNormals[i * 3 + 2] * normalScale[i * 3 + 2];
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.setXYZ(i, nx / length, ny / length, nz / length);
  }
  normals.needsUpdate = true;
  model.geometry.computeBoundingSphere();

  if (state.lastHeight !== state.profile.height_cm) {
    state.lastHeight = state.profile.height_cm;
    if (camera && controls) reframePreservingView();
  }

  updateFit();
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
  loadModel(state.sex);
}

init();
