/**
 * Prendas 3D paramÃ©tricas construidas SOBRE la malla real del maniquÃ­.
 *
 * No hay Blender ni bake externo: recortamos la superficie del cuerpo, la
 * separamos con la holgura del listing, la relajamos con un solver de tela
 * (gravedad + distancias + colisiÃ³n contra el cuerpo) y aÃ±adimos remates
 * (cuello, puÃ±os, bajo, cinturilla, cremallera, capucha, bolsillos...).
 *
 * La geometrÃ­a final se queda en metros, Y-arriba, en el mismo espacio que
 * `state.model.geometry` del viewer.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const CM = 0.01;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / Math.max(edge1 - edge0, 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
};

const ZONE_COLORS = {
  too_small: new THREE.Color('#b3261e'),
  tight: new THREE.Color('#a15c00'),
  regular: new THREE.Color('#007782'),
  loose: new THREE.Color('#2f5d8a'),
  too_big: new THREE.Color('#5b5b57'),
};

const FABRIC_TEXTURE = {
  cotton_jersey: 'cotton_jersey',
  fleece: 'knitted_fleece',
  denim: 'denim_fabric_03',
  linen: 'rough_linen',
  knit: 'jersey_melange',
  leather: 'brown_leather',
  satin: 'crepe_satin',
};

const FABRIC_RECIPE = {
  cotton_jersey: {
    roughness: 0.9, sheen: 0.34, sheenColor: 0xfff8ee, sheenRoughness: 0.82,
    normalScale: 0.55, repeat: [5, 7], anisotropy: 0.06, thickness: 0.0015,
  },
  fleece: {
    roughness: 0.97, sheen: 0.9, sheenColor: 0xf4efe6, sheenRoughness: 0.9,
    normalScale: 0.85, repeat: [4, 6], anisotropy: 0, thickness: 0.0035,
  },
  denim: {
    roughness: 0.86, sheen: 0.16, sheenColor: 0x9fb6d1, sheenRoughness: 0.65,
    normalScale: 0.8, repeat: [4, 6], anisotropy: 0.35, anisotropyRotation: Math.PI / 4, thickness: 0.0035,
  },
  linen: {
    roughness: 0.92, sheen: 0.3, sheenColor: 0xfff1dc, sheenRoughness: 0.8,
    normalScale: 0.55, repeat: [5, 6], anisotropy: 0.12, thickness: 0.0018,
  },
  knit: {
    roughness: 0.9, sheen: 0.56, sheenColor: 0xffe9d2, sheenRoughness: 0.65,
    normalScale: 0.9, repeat: [4, 5], anisotropy: 0.1, thickness: 0.0025,
  },
  leather: {
    roughness: 0.52, sheen: 0.1, sheenColor: 0x6b5a4e, sheenRoughness: 0.8,
    normalScale: 0.75, repeat: [3, 4], anisotropy: 0, thickness: 0.004,
    clearcoat: 0.35, clearcoatRoughness: 0.42,
  },
  satin: {
    roughness: 0.28, sheen: 0.68, sheenColor: 0xffd6c4, sheenRoughness: 0.3,
    normalScale: 0.2, repeat: [3, 4], anisotropy: 0.62, anisotropyRotation: Math.PI / 2, thickness: 0.0015,
  },
};

const LISTING_STYLE = {
  'carhartt-hoodie-m': { color: 0xb98d8c, label: 'rosa empolvado' },
  'nike-club-hoodie-l': { color: 0x8f9290, label: 'gris jaspeado' },
  'uniqlo-tee-m': { color: 0xffffff, white: true, label: 'blanco' },
  'acne-studios-tee-s': { color: 0x171716, label: 'negro' },
  'levis-501-w32': { color: 0xffffff, label: 'azul medio' },
  'weekday-mom-jeans-38': { color: 0xd8e1e8, label: 'azul claro' },
  'zara-slip-dress-s': { color: 0x171716, label: 'negro' },
  'mango-linen-dress-m': { color: 0x9aa294, label: 'gris verdoso' },
  'vintage-leather-jacket': { color: 0xffffff, label: 'marrÃ³n' },
  'levis-trucker-jacket-m': { color: 0xffffff, label: 'denim' },
  'cos-midi-skirt-38': { color: 0xb08a5f, label: 'camel' },
  'zara-satin-skirt-s': { color: 0xa9c7bd, label: 'verde agua' },
};

const DEFAULT_LENGTH = { tshirt: 68, hoodie: 68, dress: 95, jacket: 62, jeans: 80, skirt: 65 };
const DEFAULT_SLEEVE = { tshirt: 20, hoodie: 62, dress: 0, jacket: 60, jeans: 0, skirt: 0 };

/* ------------------------------------------------------------------ */
/* Texturas                                                            */
/* ------------------------------------------------------------------ */

export async function loadFabricTextures(renderer, base = './assets/tex/') {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  const ids = [...new Set(Object.values(FABRIC_TEXTURE))];
  const load = (url, srgb) =>
    loader.loadAsync(url).then((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = anisotropy;
      return texture;
    });

  const entries = await Promise.all(
    ids.map(async (id) => {
      const folder = `${base}${id}/`;
      const prefix = id === 'brown_leather' ? 'brown_leather_albedo' : `${id}_diff`;
      const [diff, nor, arm] = await Promise.all([
        load(`${folder}${prefix}_1k.jpg`, true),
        load(`${folder}${id}_nor_gl_1k.jpg`, false),
        load(`${folder}${id}_arm_1k.jpg`, false),
      ]);
      return [id, { diff, nor, arm }];
    }),
  );
  return Object.fromEntries(entries);
}

export function createFabricMaterial(fabric, textures, overrideColor = null, repeat = null) {
  const key = FABRIC_TEXTURE[fabric] ? fabric : 'cotton_jersey';
  const recipe = FABRIC_RECIPE[key];
  const set = textures?.[FABRIC_TEXTURE[key]];
  const material = new THREE.MeshPhysicalMaterial({
    color: overrideColor === null ? 0xffffff : overrideColor,
    roughness: set ? 1.0 : recipe.roughness,
    metalness: 0,
    ior: 1.45,
    specularIntensity: 0.5,
    sheen: recipe.sheen,
    sheenColor: new THREE.Color(recipe.sheenColor),
    sheenRoughness: recipe.sheenRoughness,
    anisotropy: recipe.anisotropy || 0,
    anisotropyRotation: recipe.anisotropyRotation || 0,
    clearcoat: recipe.clearcoat || 0,
    clearcoatRoughness: recipe.clearcoatRoughness || 0,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
  });
  if (set) {
    const clone = (texture, srgb) => {
      const copy = texture.clone();
      copy.needsUpdate = true;
      copy.wrapS = copy.wrapT = THREE.RepeatWrapping;
      copy.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      const [u, v] = repeat || recipe.repeat;
      copy.repeat.set(u, v);
      return copy;
    };
    material.map = clone(set.diff, true);
    material.normalMap = clone(set.nor, false);
    material.roughnessMap = clone(set.arm, false);
    material.normalScale = new THREE.Vector2(recipe.normalScale, recipe.normalScale);
  }
  material.envMapIntensity = 0.85;
  return material;
}

/* ------------------------------------------------------------------ */
/* Helpers geomÃ©tricos                                                 */
/* ------------------------------------------------------------------ */

function bboxOfArray(array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < array.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], array[i + k]);
      max[k] = Math.max(max[k], array[i + k]);
    }
  }
  return { min: min.map((v) => +v.toFixed(3)), max: max.map((v) => +v.toFixed(3)) };
}

function sampleRingAt(rings, y) {
  if (!rings?.length) return null;
  if (y <= rings[0].y) return rings[0];
  if (y >= rings[rings.length - 1].y) return rings[rings.length - 1];
  let i = 0;
  while (i < rings.length - 1 && rings[i + 1].y < y) i += 1;
  const a = rings[i];
  const b = rings[i + 1];
  const t = (y - a.y) / (b.y - a.y || 1);
  return {
    y,
    rx: lerp(a.rx, b.rx, t),
    rz: lerp(a.rz, b.rz, t),
    cz: lerp(a.cz || 0, b.cz || 0, t),
    n: lerp(a.n || 2.3, b.n || 2.3, t),
  };
}

function superellipse(angle, rx, rz, n) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const e = 2 / clamp(n || 2.2, 1.2, 6);
  return {
    x: rx * Math.sign(c) * Math.pow(Math.abs(c), e),
    z: rz * Math.sign(s) * Math.pow(Math.abs(s), e),
  };
}

function boundaryLoops(indices) {
  const count = indices.length / 3;
  const edgeMap = new Map();
  const add = (a, b) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const hit = edgeMap.get(key);
    if (hit) hit.count += 1;
    else edgeMap.set(key, { a, b, count: 1 });
  };
  for (let i = 0; i < count; i += 1) {
    const a = indices[i * 3];
    const b = indices[i * 3 + 1];
    const c = indices[i * 3 + 2];
    add(a, b); add(b, c); add(c, a);
  }

  const adjacency = new Map();
  for (const edge of edgeMap.values()) {
    if (edge.count !== 1) continue;
    if (!adjacency.has(edge.a)) adjacency.set(edge.a, []);
    if (!adjacency.has(edge.b)) adjacency.set(edge.b, []);
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
  }

  const loops = [];
  const visited = new Set();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const loop = [];
    let prev = -1;
    let current = start;
    for (let guard = 0; guard < 20000; guard += 1) {
      if (visited.has(current) && current === start) break;
      visited.add(current);
      loop.push(current);
      const neighbours = adjacency.get(current) || [];
      const next = neighbours.find((n) => n !== prev && (n === start || !visited.has(n))) ?? neighbours.find((n) => n !== prev);
      if (next === undefined) break;
      prev = current;
      current = next;
      if (current === start) break;
    }
    if (loop.length >= 8) loops.push(loop);
  }
  return loops;
}

function loopPoints(loop, positions, normals, offset = 0.001) {
  const points = [];
  for (const index of loop) {
    const p = new THREE.Vector3(
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    );
    if (normals) {
      p.x += normals[index * 3] * offset;
      p.y += normals[index * 3 + 1] * offset;
      p.z += normals[index * 3 + 2] * offset;
    }
    points.push(p);
  }
  // Quitar duplicados muy cercanos y suavizar el borde para que el ribete no
  // herede el zigzag de los triÃ¡ngulos del recorte.
  const filtered = [];
  for (const point of points) {
    if (!filtered.length || filtered[filtered.length - 1].distanceTo(point) > 0.002) filtered.push(point);
  }
  if (filtered.length > 3 && filtered[0].distanceTo(filtered[filtered.length - 1]) < 0.002) filtered.pop();
  for (let pass = 0; pass < 3; pass += 1) {
    const copy = filtered.map((p) => p.clone());
    for (let i = 0; i < filtered.length; i += 1) {
      const a = copy[(i - 1 + copy.length) % copy.length];
      const b = copy[(i + 1) % copy.length];
      filtered[i].lerp(a.add(b).multiplyScalar(0.5), 0.45);
    }
  }
  return filtered;
}

function buildRib(material) {
  const mat = material.clone();
  mat.side = THREE.DoubleSide;
  mat.map = material.map;
  mat.normalMap = material.normalMap;
  mat.normalScale = new THREE.Vector2(1.5, 1.5);
  mat.roughness = 0.94;
  mat.color = material.color.clone().multiplyScalar(0.92);
  return mat;
}

function addLoopRib(group, loop, positions, normals, material, radius, radialSegments = 8) {
  const points = loopPoints(loop, positions, normals, radius * 0.35);
  if (points.length < 8) return null;
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.35);
  const segments = Math.min(320, Math.max(48, points.length));
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Recorte de la superficie del cuerpo                                 */
/* ------------------------------------------------------------------ */

function extractPatch(geometry, groups, keep) {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const index = geometry.index;
  const count = positions.count;
  const keepVertex = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) keepVertex[i] = keep(i, positions, groups) ? 1 : 0;

  const remap = new Int32Array(count).fill(-1);
  const source = [];
  const outPositions = [];
  const outNormals = [];
  const outIndices = [];

  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    if (!keepVertex[a] || !keepVertex[b] || !keepVertex[c]) continue;
    for (const v of [a, b, c]) {
      if (remap[v] < 0) {
        remap[v] = source.length;
        source.push(v);
        outPositions.push(positions.getX(v), positions.getY(v), positions.getZ(v));
        outNormals.push(normals.getX(v), normals.getY(v), normals.getZ(v));
      }
      outIndices.push(remap[v]);
    }
  }

  if (!outIndices.length) return null;
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(outNormals, 3));
  result.setIndex(outIndices);
  return { geometry: result, source };
}

/* ------------------------------------------------------------------ */
/* Holgura                                                             */
/* ------------------------------------------------------------------ */

function buildClearance(fit, body, fabric, type) {
  const recipe = FABRIC_RECIPE[fabric] || FABRIC_RECIPE.cotton_jersey;
  const zones = Object.fromEntries((fit?.zones || []).map((z) => [z.name, z.ease_cm]));
  const fallback = { tshirt: 6.5, hoodie: 12, jacket: 15, dress: 7, jeans: 4, skirt: 7 }[type] ?? 7;
  const ease = (name, alt = fallback) => {
    const value = zones[name];
    return Number.isFinite(value) ? value : alt;
  };
  // `cm` es holgura de contorno (cm) â†’ radio en metros.
  const visual = type === 'tshirt' ? 1.9 : type === 'hoodie' ? 1.5 : type === 'jacket' ? 1.35 : 1;
  const radial = (cm) => Math.max(0.0025, ((cm * CM) / TAU) * visual) + recipe.thickness + 0.0015;

  const landmarks = body.landmarks;
  const H = body.profile.height_cm;
  const chestY = landmarks.chest_y_cm / 100;
  const waistY = landmarks.waist_y_cm / 100;
  const hipY = landmarks.hip_y_cm / 100;
  const crotchY = landmarks.crotch_y_cm / 100;
  const ankleY = landmarks.ankle_y_cm / 100;
  const shoulderY = landmarks.shoulder_y_cm / 100;

  const bust = radial(ease('Pecho', fallback));
  const waist = radial(ease('Cintura', fallback * 0.86));
  const hips = radial(ease('Cadera', fallback * 0.95));
  const thigh = radial(ease('Muslo', fallback * 0.72));

  const controls = [
    { y: ankleY, c: thigh * 0.9 },
    { y: crotchY, c: thigh },
    { y: hipY, c: hips },
    { y: waistY, c: waist },
    { y: chestY, c: bust },
    { y: shoulderY + 0.06, c: bust * 0.9 },
    { y: H, c: bust * 0.8 },
  ].sort((a, b) => a.y - b.y);

  return {
    at(y) {
      if (y <= controls[0].y) return controls[0].c;
      if (y >= controls[controls.length - 1].y) return controls[controls.length - 1].c;
      for (let i = 1; i < controls.length; i += 1) {
        if (y <= controls[i].y) {
          const a = controls[i - 1];
          const b = controls[i];
          return lerp(a.c, b.c, (y - a.y) / Math.max(b.y - a.y, 1e-6));
        }
      }
      return bust;
    },
    bust,
    waist,
    hips,
    thigh,
    chestY,
    waistY,
    hipY,
    crotchY,
    ankleY,
    shoulderY,
  };
}

/* ------------------------------------------------------------------ */
/* Solver de caÃ­da                                                     */
/* ------------------------------------------------------------------ */

function relax(positions, rest, pins, edges, sourcePos, sourceNormals, clearance, options = {}) {
  const vertexCount = positions.length / 3;
  const gravity = options.gravity ?? 0.00065;
  const stiffness = options.stiffness ?? 0.82;
  const iterations = options.iterations ?? 18;
  const edgeRest = new Float32Array(edges.length / 2);
  for (let i = 0; i < edges.length / 2; i += 1) {
    const a = edges[i * 2];
    const b = edges[i * 2 + 1];
    edgeRest[i] = Math.hypot(
      rest[a * 3] - rest[b * 3],
      rest[a * 3 + 1] - rest[b * 3 + 1],
      rest[a * 3 + 2] - rest[b * 3 + 2],
    );
  }

  for (let pass = 0; pass < iterations; pass += 1) {
    // Gravedad + una pizca de anclaje al cuerpo.
    for (let i = 0; i < vertexCount; i += 1) {
      const pin = pins[i];
      if (pin > 0.99) continue;
      const free = 1 - pin;
      positions[i * 3 + 1] -= gravity * free;
      positions[i * 3] = lerp(positions[i * 3], rest[i * 3], 0.012 * free);
      positions[i * 3 + 2] = lerp(positions[i * 3 + 2], rest[i * 3 + 2], 0.012 * free);
    }

    // Restricciones de distancia (Gauss-Seidel).
    for (let e = 0; e < edgeRest.length; e += 1) {
      const a = edges[e * 2];
      const b = edges[e * 2 + 1];
      const pa = a * 3;
      const pb = b * 3;
      const dx = positions[pb] - positions[pa];
      const dy = positions[pb + 1] - positions[pa + 1];
      const dz = positions[pb + 2] - positions[pa + 2];
      const length = Math.hypot(dx, dy, dz) || 1e-9;
      const error = (length - edgeRest[e]) / length;
      const wa = (1 - pins[a]) * 0.5 * stiffness;
      const wb = (1 - pins[b]) * 0.5 * stiffness;
      positions[pa] += dx * error * wa;
      positions[pa + 1] += dy * error * wa;
      positions[pa + 2] += dz * error * wa;
      positions[pb] -= dx * error * wb;
      positions[pb + 1] -= dy * error * wb;
      positions[pb + 2] -= dz * error * wb;
    }

    // ColisiÃ³n con el cuerpo: el vÃ©rtice no puede entrar por debajo de su
    // punto de origen + la holgura. Es la "tela sobre el maniquÃ­".
    for (let i = 0; i < vertexCount; i += 1) {
      if (pins[i] > 0.99) continue;
      const p = i * 3;
      const s = i * 3;
      const dx = positions[p] - sourcePos[s];
      const dy = positions[p + 1] - sourcePos[s + 1];
      const dz = positions[p + 2] - sourcePos[s + 2];
      const d = dx * sourceNormals[s] + dy * sourceNormals[s + 1] + dz * sourceNormals[s + 2];
      const minDistance = clearance[i] * 0.82;
      if (d < minDistance) {
        const push = minDistance - d;
        positions[p] += sourceNormals[s] * push;
        positions[p + 1] += sourceNormals[s + 1] * push;
        positions[p + 2] += sourceNormals[s + 2] * push;
      }
      // Pin: vuelve a su posiciÃ³n de apoyo.
      if (pins[i] > 0) {
        const pin = pins[i];
        positions[p] = lerp(positions[p], rest[p], pin);
        positions[p + 1] = lerp(positions[p + 1], rest[p + 1], pin);
        positions[p + 2] = lerp(positions[p + 2], rest[p + 2], pin);
      }
    }
  }
}

function addFabricFolds(positions, normals, pins, options) {
  const { type, fabric, topY, bottomY, amplitude, seed = 1 } = options;
  const vertexCount = positions.length / 3;
  const amp = amplitude ?? (fabric === 'fleece' ? 0.007 : fabric === 'denim' ? 0.0045 : 0.004);
  for (let i = 0; i < vertexCount; i += 1) {
    const p = i * 3;
    const x = positions[p];
    const y = positions[p + 1];
    const z = positions[p + 2];
    const theta = Math.atan2(x, z);
    const vertical = clamp((topY - y) / Math.max(topY - bottomY, 1e-6), 0, 1);
    const envelope = smoothstep(0, 0.22, vertical) * (1 - pins[i]);
    if (envelope <= 0) continue;
    let wave;
    if (type === 'jeans') {
      wave =
        Math.sin(theta * 9 + y * 18 + seed) * 0.42 +
        Math.sin(theta * 15 - y * 24 + 1.7) * 0.28 +
        Math.sin(y * 46 + theta * 3) * 0.18;
    } else if (fabric === 'satin') {
      wave =
        Math.sin(theta * 7 + y * 4.5 + seed) * 0.6 +
        Math.sin(theta * 13 - y * 6 + 1.3) * 0.28 +
        Math.cos(theta * 3 + y * 9) * 0.18;
    } else {
      wave =
        Math.sin(theta * 8 + y * 16 + seed) * 0.45 +
        Math.sin(theta * 14 - y * 11 + 1.9) * 0.3 +
        Math.sin(y * 38 + theta * 3) * 0.2;
    }
    const amount = wave * amp * envelope;
    positions[p] += normals[p] * amount;
    positions[p + 1] += normals[p + 1] * amount;
    positions[p + 2] += normals[p + 2] * amount;
  }
}

/* ------------------------------------------------------------------ */
/* Detalles                                                            */
/* ------------------------------------------------------------------ */

function createBand(ring, yCm, heightM, offsetM, thicknessM, material, centerX = 0) {
  const segments = 96;
  const positions = [];
  const indices = [];
  const y0 = yCm / 100 - heightM / 2;
  const y1 = yCm / 100 + heightM / 2;
  const rxIn = ring.rx / 100 + offsetM;
  const rzIn = ring.rz / 100 + offsetM;
  const rxOut = rxIn + thicknessM;
  const rzOut = rzIn + thicknessM;
  const cz = (ring.cz || 0) / 100;
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * TAU;
    const inner = superellipse(angle, rxIn, rzIn, ring.n);
    const outer = superellipse(angle, rxOut, rzOut, ring.n);
    positions.push(
      inner.x + centerX, y1, inner.z + cz,
      outer.x + centerX, y1, outer.z + cz,
      outer.x + centerX, y0, outer.z + cz,
      inner.x + centerX, y0, inner.z + cz,
    );
  }
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  for (let i = 0; i < segments; i += 1) {
    const a = i * 4;
    const b = ((i + 1) % segments) * 4;
    quad(a, b, b + 1, a + 1);
    quad(a + 3, b + 3, b + 2, a + 2);
    quad(a, a + 3, b + 3, b);
    quad(a + 1, b + 1, b + 2, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildWaistband(group, body, yCm, height, clearance, material, detailMaterial) {
  const ring = sampleRingAt(body.torso, yCm);
  if (!ring) return;
  const offset = Math.max(0.006, clearance * 0.75);
  group.add(createBand(ring, yCm, height, offset, 0.006, material));
  if (detailMaterial) {
    const top = yCm + (height / 2) * 100;
    const bottom = yCm - (height / 2) * 100;
    group.add(createBand(ring, top, 0.004, offset + 0.0062, 0.0015, detailMaterial));
    group.add(createBand(ring, bottom, 0.004, offset + 0.0062, 0.0015, detailMaterial));
  }
}

function buildBeltLoops(group, body, yCm, material) {
  const ring = sampleRingAt(body.torso, yCm);
  if (!ring) return;
  const height = 0.052;
  const rx = ring.rx / 100 + 0.012;
  const rz = ring.rz / 100 + 0.012;
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * TAU + 0.3;
    const p = superellipse(angle, rx, rz, ring.n);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.012, height, 0.005), material);
    box.position.set(p.x, yCm / 100, p.z + (ring.cz || 0) / 100);
    box.rotation.y = -angle;
    box.castShadow = true;
    group.add(box);
  }
}

function buildZipper(group, body, yBottom, yTop, material, teethMaterial) {
  const rings = body.torso;
  const zAt = (y) => {
    const ring = sampleRingAt(rings, y * 100);
    return ((ring?.cz || 0) + (ring?.rz || 8)) / 100 + 0.012;
  };
  const steps = 48;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = lerp(yBottom, yTop, t);
    const z = zAt(y);
    positions.push(-0.012, y, z, 0.012, y, z);
  }
  for (let i = 0; i < steps; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const tape = new THREE.Mesh(geometry, material);
  tape.castShadow = true;
  group.add(tape);

  const toothGeometry = new THREE.BoxGeometry(0.008, 0.005, 0.005);
  for (let i = 0; i < 34; i += 1) {
    const t = (i + 0.5) / 34;
    const y = lerp(yBottom, yTop, t);
    const tooth = new THREE.Mesh(toothGeometry, teethMaterial);
    tooth.position.set(i % 2 === 0 ? -0.0045 : 0.0045, y, zAt(y) + 0.003);
    tooth.castShadow = true;
    group.add(tooth);
  }
  const slider = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.03, 0.01), teethMaterial);
  slider.position.set(0, lerp(yBottom, yTop, 0.72), zAt(lerp(yBottom, yTop, 0.72)) + 0.006);
  slider.castShadow = true;
  group.add(slider);
}

function buildButtons(group, body, yTop, yBottom, material) {
  const ring = sampleRingAt(body.torso, yTop * 100);
  const z = ((ring?.cz || 0) + (ring?.rz || 8)) / 100 + 0.014;
  for (let i = 0; i < 5; i += 1) {
    const y = lerp(yTop, yBottom, (i + 0.5) / 5);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.003, 20), material);
    button.rotation.x = Math.PI / 2;
    button.position.set(0, y, z);
    button.castShadow = true;
    group.add(button);
  }
}

function buildHood(group, body, material, detailMaterial) {
  const landmarks = body.landmarks;
  const neckY = landmarks.neck_base_y_cm / 100;
  const shoulderY = landmarks.shoulder_y_cm / 100;
  const radius = (landmarks.shoulder_width_cm / 200) * 0.62;
  const hood = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.042, 16, 48, Math.PI * 1.18),
    material,
  );
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = Math.PI / 2;
  hood.position.set(0, shoulderY + 0.02, -0.045);
  hood.scale.set(1.15, 1, 0.75);
  hood.castShadow = true;
  group.add(hood);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, 0.012, 10, 48, Math.PI * 1.16),
    detailMaterial || material,
  );
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = Math.PI / 2;
  rim.position.set(0, shoulderY + 0.035, -0.04);
  rim.scale.set(1.15, 1, 0.75);
  rim.castShadow = true;
  group.add(rim);

  // Cordones
  const frontZ = ((sampleRingAt(body.torso, landmarks.chest_y_cm)?.rz || 10) / 100) + 0.02;
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.045, shoulderY + 0.01, frontZ),
      new THREE.Vector3(side * 0.05, landmarks.chest_y_cm / 100, frontZ + 0.012),
      new THREE.Vector3(side * 0.055, landmarks.underbust_y_cm / 100 - 0.06, frontZ + 0.005),
    ]);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0035, 6, false), detailMaterial || material);
    cord.castShadow = true;
    group.add(cord);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 10), detailMaterial || material);
    tip.position.set(side * 0.055, landmarks.underbust_y_cm / 100 - 0.067, frontZ + 0.005);
    group.add(tip);
  }
}

function buildPocketPatch(group, body, model, material, options) {
  const { yMin, yMax, xMin, xMax, zMin, zMax, side = 0, offset = 0.012, topBand = true } = options;
  const groups = model.groupWeights;
  const patch = extractPatch(model.geometry, groups, (i, positions) => {
    const y = positions.getY(i);
    const x = positions.getX(i);
    const z = positions.getZ(i);
    if (y < yMin || y > yMax) return false;
    if (z < zMin || z > zMax) return false;
    if (side < 0 && x > -0.01) return false;
    if (side > 0 && x < 0.01) return false;
    if (x < xMin || x > xMax) return false;
    return groups[i * 6] > 0.25;
  });
  if (!patch) return;
  const positions = patch.geometry.attributes.position;
  const normals = patch.geometry.attributes.normal;
  for (let i = 0; i < positions.count; i += 1) {
    positions.setXYZ(
      i,
      positions.getX(i) + normals.getX(i) * offset,
      positions.getY(i) + normals.getY(i) * offset,
      positions.getZ(i) + normals.getZ(i) * offset,
    );
  }
  patch.geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(patch.geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (topBand) {
    const loops = boundaryLoops(patch.geometry.index.array);
    const loop = loops.sort((a, b) => {
      const ya = a.reduce((s, i) => s + positions.getY(i), 0) / a.length;
      const yb = b.reduce((s, i) => s + positions.getY(i), 0) / b.length;
      return yb - ya;
    })[0];
    if (loop) addLoopRib(group, loop, positions.array, normals.array, material, 0.004, 6);
  }
}

/* ------------------------------------------------------------------ */
/* ConstrucciÃ³n de la prenda                                           */
/* ------------------------------------------------------------------ */

function extendHem(geometry, waistY, targetHemY) {
  const positions = geometry.attributes.position;
  const loops = boundaryLoops(geometry.index.array);
  const candidates = loops
    .map((loop) => {
      let sy = 0;
      for (const i of loop) sy += positions.getY(i);
      return { loop, y: sy / loop.length };
    })
    .filter((item) => item.loop.length > 20 && Math.abs(item.y - waistY) < 0.08)
    .sort((a, b) => Math.abs(a.y - waistY) - Math.abs(b.y - waistY));
  if (!candidates.length) return geometry;
  const loop = candidates[0].loop;
  let cx = 0;
  let cz = 0;
  for (const i of loop) { cx += positions.getX(i); cz += positions.getZ(i); }
  cx /= loop.length;
  cz /= loop.length;

  const rings = 5;
  const n = loop.length;
  const tubePositions = [];
  const tubeUvs = [];
  const tubeIndices = [];
  for (let r = 0; r < rings; r += 1) {
    const t = r / (rings - 1);
    const y = lerp(waistY, targetHemY, t);
    const scale = 1 + 0.028 * Math.pow(t, 1.2);
    for (let j = 0; j < n; j += 1) {
      const vi = loop[j];
      const x = cx + (positions.getX(vi) - cx) * scale;
      const z = cz + (positions.getZ(vi) - cz) * scale;
      tubePositions.push(x, y, z);
      tubeUvs.push(j / n, t);
    }
  }
  // La costura del tubo coincide con el borde del parche; el material es
  // DoubleSide, así que el sentido de las caras no importa visualmente.
  for (let r = 0; r < rings - 1; r += 1) {
    for (let j = 0; j < n; j += 1) {
      const j2 = (j + 1) % n;
      const a = r * n + j;
      const b = r * n + j2;
      const c = (r + 1) * n + j2;
      const d = (r + 1) * n + j;
      tubeIndices.push(a, b, c, a, c, d);
    }
  }
  const tube = new THREE.BufferGeometry();
  tube.setAttribute('position', new THREE.Float32BufferAttribute(tubePositions, 3));
  tube.setAttribute('uv', new THREE.Float32BufferAttribute(tubeUvs, 2));
  tube.setIndex(tubeIndices);
  tube.computeVertexNormals();
  const merged = mergeGeometries([geometry, tube], false);
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

function buildTopPatch(listing, body, model, clearance, options) {  const { type, fabric, measurements } = listing.garment;
  const style = LISTING_STYLE[listing.id] || {};
  const height = body.profile.height_cm / 100;
  const shoulderY = body.landmarks.shoulder_y_cm / 100;
  const neckBaseY = body.landmarks.neck_base_y_cm / 100;
  const chestY = body.landmarks.chest_y_cm / 100;
  const waistY = body.landmarks.waist_y_cm / 100;
  const lengthCm = measurements.length_cm ?? DEFAULT_LENGTH[type] ?? 68;
  const visualLength = type === 'hoodie' ? Math.min(lengthCm, 62) : lengthCm;
  const targetHemY = clamp(shoulderY - visualLength * CM, 0.3 * height, shoulderY - 0.08);
  const waistY = body.landmarks.waist_y_cm / 100;
  // El parche del cuerpo solo llega a la cintura. El bajo se extiende con un
  // tubo de tela (más abajo), para que la camiseta no acabe en bodi.
  const hemY = Math.max(waistY + 0.015, targetHemY);
  const sleeveCm = measurements.sleeve_cm ?? DEFAULT_SLEEVE[type] ?? 20;
  const sleeveLength = Math.max(0.05, sleeveCm * CM);
  const armLeft = model.armJoints?.left;
  const armRight = model.armJoints?.right;
  const armLength = armLeft ? armLeft.shoulder.distanceTo(armLeft.wrist) : 0.6;
  const sleeveFraction = clamp(sleeveLength / Math.max(armLength, 0.2), 0.12, 1.02);
  const neckCutY = neckBaseY - 0.012;
  const neckClear = Math.max(0.065, (body.landmarks.shoulder_width_cm / 200) * 0.26);
  const openFront = type === 'jacket';
  const groups = model.groupWeights;
  const positions = model.geometry.attributes.position;

  const armT = (i, joint) => {
    if (!joint) return 0;
    const p = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
    const axis = new THREE.Vector3().subVectors(joint.wrist, joint.shoulder);
    const denom = axis.lengthSq();
    if (denom < 1e-8) return 0;
    return clamp(p.clone().sub(joint.shoulder).dot(axis) / denom, 0, 1.2);
  };

  const keep = (i) => {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    if (y < hemY || y > neckCutY + 0.02) return false;
    const torso = groups[i * 6] > 0.28;
    const armL = groups[i * 6 + 1] > 0.28;
    const armR = groups[i * 6 + 2] > 0.28;
    const arm = armL || armR;
    if (!torso && !arm) return false;
    if (arm) {
      const joint = armL ? armLeft : armRight;
      if (!joint || armT(i, joint) > sleeveFraction) return false;
    }
    if (y > neckCutY - 0.035) {
      const radius = Math.hypot(x, z);
      const frontDip = z > 0 ? 0.018 : 0;
      if (radius < neckClear && y > neckCutY - frontDip) return false;
      if (radius < 0.036 && y > neckCutY - 0.02) return false;
    }
    if (openFront && z > 0.015 && Math.abs(x) < 0.018) return false;
    return true;
  };

  const patch = extractPatch(model.geometry, groups, keep);
  if (!patch) return null;

  const positionsOut = patch.geometry.attributes.position;
  const normalsOut = patch.geometry.attributes.normal;
  const sourcePos = new Float32Array(positionsOut.count * 3);
  const sourceNormals = new Float32Array(positionsOut.count * 3);
  const rest = new Float32Array(positionsOut.count * 3);
  const pins = new Float32Array(positionsOut.count);
  const clearances = new Float32Array(positionsOut.count);
  const source = patch.source;

  for (let i = 0; i < positionsOut.count; i += 1) {
    const s = source[i];
    const gx = positions.getX(s);
    const gy = positions.getY(s);
    const gz = positions.getZ(s);
    const nx = normalsOut.getX(i);
    const ny = normalsOut.getY(i);
    const nz = normalsOut.getZ(i);
    const armRegion = groups[s * 6 + 1] > 0.28 || groups[s * 6 + 2] > 0.28;
    const clearanceValue = clearance.at(gy) * (armRegion ? 0.72 : 1.0);
    sourcePos[i * 3] = gx;
    sourcePos[i * 3 + 1] = gy;
    sourcePos[i * 3 + 2] = gz;
    sourceNormals[i * 3] = nx;
    sourceNormals[i * 3 + 1] = ny;
    sourceNormals[i * 3 + 2] = nz;
    clearances[i] = clearanceValue;
    rest[i * 3] = gx + nx * clearanceValue;
    rest[i * 3 + 1] = gy + ny * clearanceValue;
    rest[i * 3 + 2] = gz + nz * clearanceValue;
    const shoulderPin = smoothstep(shoulderY - 0.045, shoulderY - 0.008, gy);
    const hemPin = 0;
    pins[i] = clamp(Math.max(shoulderPin * (armRegion ? 1 : 0.7), hemPin), 0, 1);
  }

  positionsOut.array.set(rest);
  positionsOut.needsUpdate = true;
  if (typeof window !== 'undefined' && window.__spGarmentDebug) {
    console.info('[garment] rest', JSON.stringify(bboxOfArray(rest)), 'count', positionsOut.count);
  }

  const edges = [];
  const seen = new Set();
  const index = patch.geometry.index.array;
  for (let i = 0; i < index.length; i += 3) {
    const tri = [index[i], index[i + 1], index[i + 2]];
    for (let k = 0; k < 3; k += 1) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(a, b);
    }
  }

  const looseness = clamp((clearance.bust / 0.02 + 0.4), 0.2, 1.8);
  relax(positionsOut.array, rest, pins, Uint32Array.from(edges), sourcePos, sourceNormals, clearances, {
    gravity: type === 'jacket' || type === 'hoodie' ? 0.0009 : 0.0007,
    stiffness: fabric === 'leather' ? 0.92 : 0.78,
    iterations: 8,
    looseness,
  });

  addFabricFolds(positionsOut.array, patch.geometry.attributes.normal.array, pins, {
    type,
    fabric,
    topY: neckCutY,
    bottomY: hemY,
    amplitude: fabric === 'fleece' ? 0.002 : fabric === 'leather' ? 0.0008 : 0.0012,
    seed: (listing.id?.length || 3) * 0.37,
  });

  patch.geometry.computeVertexNormals();
  if (typeof window !== 'undefined' && window.__spGarmentDebug) {
    console.info('[garment] settled', JSON.stringify(bboxOfArray(positionsOut.array)), 'pins', pins.reduce((s, p) => s + (p > 0.5 ? 1 : 0), 0));
  }
  patch.geometry.computeBoundingSphere();

  // UVs cilÃ­ndricas para los mapas de tejido
  const uv = new Float32Array(positionsOut.count * 2);
  for (let i = 0; i < positionsOut.count; i += 1) {
    const x = positionsOut.getX(i);
    const z = positionsOut.getZ(i);
    const y = positionsOut.getY(i);
    uv[i * 2] = (Math.atan2(x, z) + Math.PI) / TAU;
    uv[i * 2 + 1] = clamp((y - hemY) / Math.max(neckCutY - hemY, 1e-6), 0, 1);
  }
  patch.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (type !== 'jacket') {
    patch.geometry = extendHem(patch.geometry, hemY, targetHemY);
  }

  return {
    patch,
    hemY: type === 'jacket' ? hemY : targetHemY,
    topY: neckCutY,
    clearance,
    bounds: { shoulderY, neckBaseY, chestY, hemY: type === 'jacket' ? hemY : targetHemY },
    openFront,
    type,
    fabric,
    style,
    sleeveFraction,
  };
}

function buildPleatedPanel(listing, body, clearance, options = {}) {
  const { type, fabric, measurements } = listing.garment;
  const style = LISTING_STYLE[listing.id] || {};
  const landmarks = body.landmarks;
  const H = body.profile.height_cm / 100;
  const waistY = landmarks.waist_y_cm / 100;
  const hipY = landmarks.hip_y_cm / 100;
  const lengthCm = measurements.length_cm ?? DEFAULT_LENGTH[type] ?? 65;
  const hemY = clamp((type === 'dress' ? landmarks.shoulder_y_cm / 100 : waistY) - lengthCm * CM, 0.18 * H, waistY - 0.06);
  const topY = type === 'dress'
    ? clamp(landmarks.armpit_y_cm / 100 - 0.005, waistY + 0.12, waistY + 0.25)
    : waistY + 0.012;
  const segments = 128;
  const ringCount = 44;
  const positions = [];
  const indices = [];
  const uvs = [];
  const pins = [];
  const pleats = type === 'skirt' ? 22 : 0;
  const flare = type === 'skirt' ? (fabric === 'satin' ? 1.18 : 1.38) : 1.32;

  for (let r = 0; r < ringCount; r += 1) {
    const t = r / (ringCount - 1);
    const y = lerp(topY, hemY, t);
    const bodyRing = sampleRingAt(body.torso, y < hipY ? landmarks.hip_y_cm : y * 100);
    const hipRing = sampleRingAt(body.torso, landmarks.hip_y_cm);
    const waistRing = sampleRingAt(body.torso, landmarks.waist_y_cm);
    const chestRing = sampleRingAt(body.torso, landmarks.chest_y_cm);
    let rx;
    let rz;
    let cz = (bodyRing?.cz || 0) / 100;
    if (type === 'dress' && y > waistY) {
      const base = sampleRingAt(body.torso, y * 100) || chestRing;
      rx = (base.rx / 100) + clearance.at(y);
      rz = (base.rz / 100) + clearance.at(y);
    } else if (y >= hipY) {
      const base = sampleRingAt(body.torso, y * 100) || waistRing;
      rx = (base.rx / 100) + clearance.at(y);
      rz = (base.rz / 100) + clearance.at(y);
    } else {
      const source = hipRing || waistRing;
      const drop = clamp((hipY - y) / Math.max(hipY - hemY, 1e-6), 0, 1);
      const flareAmount = 1 + (flare - 1) * Math.pow(drop, 1.35);
      rx = (source.rx / 100 + clearance.hips) * flareAmount;
      rz = (source.rz / 100 + clearance.hips) * flareAmount;
      cz = (source.cz || 0) / 100;
    }
    for (let j = 0; j < segments; j += 1) {
      const angle = (j / segments) * TAU;
      let point = superellipse(angle, rx, rz, type === 'dress' ? 2.25 : 2.4);
      if (pleats > 0 && y < waistY) {
        const grow = clamp((waistY - y) / Math.max(waistY - hemY, 1e-6), 0, 1);
        const amp = 0.004 + 0.008 * grow;
        const wave = Math.cos(angle * pleats);
        point = { x: point.x * (1 + wave * amp * 0.5), z: point.z * (1 + wave * amp * 0.5) };
      }
      // Escote del vestido: bajada suave en el centro delantero.
      let yy = y;
      if (type === 'dress' && r === 0) {
        yy -= Math.max(0, Math.cos(angle)) * 0.022;
      }
      positions.push(point.x, yy, point.z + cz);
      uvs.push(j / segments, t);
      pins.push(r === 0 ? 1 : 0);
    }
  }

  for (let r = 0; r < ringCount - 1; r += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j2 = (j + 1) % segments;
      const a = r * segments + j;
      const b = r * segments + j2;
      const c = (r + 1) * segments + j2;
      const d = (r + 1) * segments + j;
      indices.push(a, c, b, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return {
    geometry,
    pins: Float32Array.from(pins),
    topY,
    hemY,
    clearance,
    bounds: { waistY, hipY, hemY, chestY: landmarks.chest_y_cm / 100 },
    type,
    fabric,
    style,
    segments,
    ringCount,
  };
}

function buildDressStraps(group, body, material) {
  const landmarks = body.landmarks;
  const chestY = landmarks.chest_y_cm / 100;
  const shoulderY = landmarks.shoulder_y_cm / 100;
  const ring = sampleRingAt(body.torso, landmarks.chest_y_cm);
  const rz = ((ring?.rz || 9) / 100) + 0.02;
  const x = Math.max(0.045, (landmarks.shoulder_width_cm / 200) * 0.34);
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * x, chestY + 0.03, rz * 0.85),
      new THREE.Vector3(side * x * 1.05, shoulderY + 0.015, 0.01),
      new THREE.Vector3(side * x * 0.9, chestY + 0.04, -rz * 0.8),
    ]);
    const strap = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0055, 6, false), material);
    strap.castShadow = true;
    group.add(strap);
  }
}

/* ------------------------------------------------------------------ */
/* API principal                                                       */
/* ------------------------------------------------------------------ */

export function buildGarment({ listing, body, model, fit, textures }) {
  const type = listing.garment?.type || 'tshirt';
  const fabric = listing.garment?.fabric || 'cotton_jersey';
  const style = LISTING_STYLE[listing.id] || {};
  const clearance = buildClearance(fit, body, fabric, type);
  const group = new THREE.Group();
  group.name = `Garment:${listing.id}`;

  const material = createFabricMaterial(fabric, textures, style.color ?? null);
  if (style.white) {
    // La camiseta blanca debe leerse blanca, no beige: conservamos normal y
    // roughness del tejido, pero quitamos la difusa de algodón crudo.
    if (material.map) material.map.dispose();
    material.map = null;
    material.color.set(0xffffff);
  }
  const detailMaterial = buildRib(material);

  let base = null;
  let mesh = null;
  let isTop = false;

  if (type === 'tshirt' || type === 'hoodie' || type === 'jacket') {
    base = buildTopPatch(listing, body, model, clearance, {});
    isTop = true;
    if (!base) return null;
    mesh = new THREE.Mesh(base.patch.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const positions = base.patch.geometry.attributes.position.array;
    const normals = base.patch.geometry.attributes.normal.array;
    const loops = boundaryLoops(base.patch.geometry.index.array);
    const bounds = base.bounds;
    const sorted = loops
      .map((loop) => {
        let sumY = 0;
        let sumX = 0;
        let sumZ = 0;
        for (const i of loop) {
          sumY += positions[i * 3 + 1];
          sumX += Math.abs(positions[i * 3]);
          sumZ += positions[i * 3 + 2];
        }
        return { loop, y: sumY / loop.length, x: sumX / loop.length, z: sumZ / loop.length };
      })
      .sort((a, b) => b.y - a.y);

    for (const item of sorted) {
      if (item.loop.length < 10) continue;
      const isNeck = item.y > bounds.shoulderY + 0.015;
      const isHem = item.y < bounds.hemY + 0.035;
      const isCuff = item.x > (body.landmarks.shoulder_width_cm / 200) * 0.55 && item.y < bounds.shoulderY - 0.03;
      if (isNeck) {
        addLoopRib(group, item.loop, positions, normals, detailMaterial, 0.0085, 10);
      } else if (isHem) {
        addLoopRib(group, item.loop, positions, normals, material, 0.0042, 8);
      } else if (isCuff) {
        addLoopRib(group, item.loop, positions, normals, detailMaterial, 0.0075, 8);
      } else {
        addLoopRib(group, item.loop, positions, normals, material, 0.0035, 6);
      }
    }

    if (type === 'hoodie') {
      buildHood(group, body, material, detailMaterial);
      const hipY = body.landmarks.hip_y_cm / 100;
      const waistY = body.landmarks.waist_y_cm / 100;
      buildPocketPatch(group, body, model, material, {
        yMin: hipY + 0.03,
        yMax: waistY - 0.04,
        xMin: -0.17,
        xMax: 0.17,
        zMin: 0.02,
        zMax: 1,
        offset: clearance.bust * 0.6,
        topBand: true,
      });
    }

    if (type === 'jacket') {
      const yTop = base.topY - 0.02;
      const yBottom = base.hemY + 0.02;
      if (fabric === 'leather') {
        buildZipper(group, body, yBottom, yTop, detailMaterial, new THREE.MeshStandardMaterial({
          color: 0x9b9388, roughness: 0.35, metalness: 0.85,
        }));
      } else {
        buildButtons(group, body, yTop, yBottom, new THREE.MeshStandardMaterial({
          color: 0xb08d57, roughness: 0.35, metalness: 0.75,
        }));
      }
      // Solapa: dos bandas gruesas en el borde delantero.
      const frontLoops = sorted.filter((item) => item.z > 0.02 && item.y < base.topY - 0.02 && item.y > base.hemY + 0.02);
      for (const item of frontLoops.slice(0, 2)) {
        addLoopRib(group, item.loop, positions, normals, material, 0.012, 8);
      }
    }
  } else if (type === 'dress' || type === 'skirt') {
    base = buildPleatedPanel(listing, body, clearance, {});
    mesh = new THREE.Mesh(base.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const ring = sampleRingAt(body.torso, base.topY * 100);
    if (ring) {
      buildWaistband(group, body, base.topY * 100, type === 'skirt' ? 0.032 : 0.018, clearance.waist, material, detailMaterial);
    }
    if (type === 'dress') {
      buildDressStraps(group, body, material);
      // Manga corta abullonada para el vestido de lino.
      if ((listing.garment.measurements.sleeve_cm ?? 0) > 5) {
        // Se resuelve con un pequeÃ±o volumen sobre el hombro; el recorte
        // principal del vestido no incluye brazos.
        for (const side of [-1, 1]) {
          const arm = side < 0 ? model.armJoints?.left : model.armJoints?.right;
          if (!arm) continue;
          const center = arm.shoulder.clone().add(arm.wrist.clone().sub(arm.shoulder).multiplyScalar(0.16));
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16), material);
          puff.position.copy(center);
          puff.scale.set(1, 0.8, 1);
          puff.castShadow = true;
          group.add(puff);
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.007, 8, 24), detailMaterial);
          cuff.position.copy(center);
          cuff.rotation.x = Math.PI / 2;
          group.add(cuff);
        }
      }
    }
  } else if (type === 'jeans') {
    // Los vaqueros se recortan del cuerpo completo (pelvis + dos piernas):
    // la malla es continua en la entrepierna, asÃ­ que no hay "dos tubos".
    const waistY = body.landmarks.waist_y_cm / 100;
    const crotchY = body.landmarks.crotch_y_cm / 100;
    const ankleY = body.landmarks.ankle_y_cm / 100;
    const inseam = (listing.garment.measurements.inseam_cm ?? body.landmarks.leg_length_cm) * CM;
    // El cinturón debe caer en la cintura real del maniquí, no en el tiro
    // declarado por el vendedor (que puede ser high-rise y quedar más alto).
    const waistbandY = waistY + 0.005;
    const hemY = Math.max(ankleY + 0.012, crotchY - inseam * 0.92);
    const groups = model.groupWeights;
    const positionsBody = model.geometry.attributes.position;
    const keep = (i) => {
      const y = positionsBody.getY(i);
      if (y < hemY || y > waistbandY) return false;
      const torso = groups[i * 6] > 0.3;
      const leg = groups[i * 6 + 3] + groups[i * 6 + 4] > 0.35;
      return torso || leg;
    };
    const patch = extractPatch(model.geometry, groups, keep);
    if (!patch) return null;
    base = { patch, hemY, topY: waistbandY, clearance, type, fabric, style, isJeans: true };
    const positions = patch.geometry.attributes.position;
    const normals = patch.geometry.attributes.normal;
    const sourcePos = new Float32Array(positions.count * 3);
    const sourceNormals = new Float32Array(positions.count * 3);
    const rest = new Float32Array(positions.count * 3);
    const pins = new Float32Array(positions.count);
    const clearances = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i += 1) {
      const s = patch.source[i];
      const gx = positionsBody.getX(s);
      const gy = positionsBody.getY(s);
      const gz = positionsBody.getZ(s);
      const nx = normals.getX(i);
      const ny = normals.getY(i);
      const nz = normals.getZ(i);
      const c = clearance.at(gy);
      sourcePos[i * 3] = gx; sourcePos[i * 3 + 1] = gy; sourcePos[i * 3 + 2] = gz;
      sourceNormals[i * 3] = nx; sourceNormals[i * 3 + 1] = ny; sourceNormals[i * 3 + 2] = nz;
      clearances[i] = c;
      rest[i * 3] = gx + nx * c;
      rest[i * 3 + 1] = gy + ny * c;
      rest[i * 3 + 2] = gz + nz * c;
      pins[i] = smoothstep(waistbandY - 0.05, waistbandY - 0.008, gy);
    }
    positions.array.set(rest);
    const edges = [];
    const seen = new Set();
    const index = patch.geometry.index.array;
    for (let i = 0; i < index.length; i += 3) {
      const tri = [index[i], index[i + 1], index[i + 2]];
      for (let k = 0; k < 3; k += 1) {
        const a = tri[k];
        const b = tri[(k + 1) % 3];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(a, b);
      }
    }
    relax(positions.array, rest, pins, Uint32Array.from(edges), sourcePos, sourceNormals, clearances, {
      gravity: 0.0007, stiffness: fabric === 'denim' ? 0.9 : 0.78, iterations: 18,
    });
    addFabricFolds(positions.array, normals.array, pins, {
      type: 'jeans', fabric, topY: waistbandY, bottomY: hemY,
      amplitude: fabric === 'denim' ? 0.004 : 0.003, seed: 2.1,
    });
    patch.geometry.computeVertexNormals();
    patch.geometry.computeBoundingSphere();
    const uv = new Float32Array(positions.count * 2);
    for (let i = 0; i < positions.count; i += 1) {
      uv[i * 2] = (Math.atan2(positions.getX(i), positions.getZ(i)) + Math.PI) / TAU;
      uv[i * 2 + 1] = clamp((positions.getY(i) - hemY) / Math.max(waistbandY - hemY, 1e-6), 0, 1);
    }
    patch.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh = new THREE.Mesh(patch.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Sin cinturilla ni pasadores: el vaquero termina directamente en la
    // cintura y el borde de la tela hace de remate.
    if (fabric === 'denim') {
      // Pockets traseros + pespunte dorado
      const hipY = body.landmarks.hip_y_cm / 100;
      for (const side of [-1, 1]) {
        buildPocketPatch(group, body, model, material, {
          yMin: hipY - 0.18, yMax: hipY - 0.02,
          xMin: side < 0 ? -0.18 : 0.03, xMax: side < 0 ? -0.03 : 0.18,
          zMin: -1, zMax: -0.02, side,
          offset: 0.005, topBand: true,
        });
      }
    }
  }

  if (!mesh) return null;

  // Heatmap de tensiÃ³n: malla clonada con colores por zona.
  const heatGeometry = mesh.geometry.clone();
  const colorAttr = new THREE.Float32BufferAttribute(new Float32Array(heatGeometry.attributes.position.count * 3), 3);
  const zoneForY = (y) => {
    const zones = fit?.zones || [];
    let best = zones[0];
    let bestDistance = Infinity;
    const targets = { Pecho: clearance.chestY, Cintura: clearance.waistY, Cadera: clearance.hipY, Muslo: clearance.crotchY - 0.08 };
    for (const zone of zones) {
      const target = targets[zone.name] ?? clearance.chestY;
      const distance = Math.abs(y - target);
      if (distance < bestDistance) { bestDistance = distance; best = zone; }
    }
    return best;
  };
  const heatMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const tmpColor = new THREE.Color();
  for (let i = 0; i < heatGeometry.attributes.position.count; i += 1) {
    const zone = zoneForY(heatGeometry.attributes.position.getY(i));
    const color = ZONE_COLORS[zone?.verdict] || ZONE_COLORS.regular;
    tmpColor.copy(color);
    colorAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }
  heatGeometry.setAttribute('color', colorAttr);
  const heatmap = new THREE.Mesh(heatGeometry, heatMaterial);
  heatmap.visible = false;
  heatmap.renderOrder = 2;
  group.add(heatmap);

  // La base mesh del visor ya es una malla completa. Espejar la prenda otra
  // vez duplicaba la tela y dejaba una copia invertida (camiseta y pantalÃ³n).
  const root = new THREE.Group();
  root.name = group.name;
  root.add(group);

  return {
    group: root,
    mesh,
    heatmap,
    base,
    material,
    meta: {
      type,
      fabric,
      style,
      vertices: mesh.geometry.attributes.position.count,
      triangles: mesh.geometry.index ? mesh.geometry.index.count / 3 : 0,
      clearance: clearance.bust,
    },
    setHeatmap(value) {
      heatmap.visible = !!value;
    },
    dispose() {
      const geometries = new Set();
      const materials = new Set();
      root.traverse((object) => {
        if (!object.isMesh) return;
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((m) => materials.add(m));
        else if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose?.());
      materials.forEach((material) => material.dispose?.());
      root.removeFromParent();
    },
  };
}

// Helpers compartidos con garment-builder-v2.js (prendas de tubo/patrï¿½n).
export {
  buildClearance,
  boundaryLoops,
  addLoopRib,
  buildRib,
  createBand,
  buildWaistband,
  buildBeltLoops,
  buildZipper,
  buildButtons,
  buildHood,
  buildPocketPatch,
  buildDressStraps,
  sampleRingAt,
  superellipse,
  FABRIC_RECIPE,
  LISTING_STYLE,
  DEFAULT_LENGTH,
  DEFAULT_SLEEVE,
  extractPatch,
};

