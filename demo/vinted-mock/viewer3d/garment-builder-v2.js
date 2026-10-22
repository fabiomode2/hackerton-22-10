/**
 * Prendas 3D v2 — anillos de prenda, no parches de piel.
 *
 * El builder anterior recortaba la superficie del cuerpo y la separaba 1-2 cm:
 * eso produce un traje de neopreno y, al relajar, un globo alrededor del
 * maniquí. Aquí la prenda se genera con sus propios anillos:
 *
 *   torso: tubo con escote, hombros inclinados y remates
 *   mangas: tubos sobre el eje del brazo, con copa
 *   vaqueros: pelvis + dos perneras completas (sin globo en la entrepierna)
 *   falda/vestido: tubo con vuelo y pliegues
 *
 * La holgura sale del fit del listing; la forma, de las tablas del maniquí.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  addLoopRib,
  boundaryLoops,
  buildBeltLoops,
  buildButtons,
  buildDressStraps,
  buildHood,
  buildRib,
  buildWaistband,
  buildZipper,
  createFabricMaterial,
  DEFAULT_LENGTH,
  DEFAULT_SLEEVE,
  extractPatch,
  FABRIC_RECIPE,
  LISTING_STYLE,
  sampleRingAt,
  superellipse,
} from './garment-builder.js';

const TAU = Math.PI * 2;
const CM = 0.01;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / Math.max(b - a, 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
};

function ringPoint(ring, angle) {
  const p = superellipse(angle, ring.rx, ring.rz, ring.n || 2.35);
  return { x: (ring.cx || 0) + p.x, z: (ring.cz || 0) + p.z };
}

function buildLoft(rings, segments, capStart = false) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < rings.length; i += 1) {
    const ring = rings[i];
    for (let j = 0; j < segments; j += 1) {
      const angle = (j / segments) * TAU;
      const p = ringPoint(ring, angle);
      positions.push(p.x, ring.y, p.z);
      uvs.push(j / segments, i / Math.max(rings.length - 1, 1));
    }
  }
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j2 = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + j2;
      const c = (i + 1) * segments + j2;
      const d = (i + 1) * segments + j;
      indices.push(a, b, c, a, c, d);
    }
  }
  if (capStart && rings.length) {
    const center = positions.length / 3;
    const r0 = rings[0];
    positions.push(r0.cx || 0, r0.y, r0.cz || 0);
    uvs.push(0.5, 0);
    for (let j = 0; j < segments; j += 1) {
      indices.push(center, (j + 1) % segments, j);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function edgeArray(index) {
  const seen = new Set();
  const edges = [];
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
  return Uint32Array.from(edges);
}

function relax(geometry, pins, collide, options = {}) {
  const attr = geometry.attributes.position;
  const p = attr.array;
  const rest = new Float32Array(p);
  const edges = edgeArray(geometry.index.array);
  const count = attr.count;
  const edgeRest = new Float32Array(edges.length / 2);
  for (let e = 0; e < edgeRest.length; e += 1) {
    const a = edges[e * 2];
    const b = edges[e * 2 + 1];
    edgeRest[e] = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
  }
  const corr = new THREE.Vector3();
  const iterations = options.iterations ?? 12;
  const stiffness = options.stiffness ?? 0.88;
  const gravity = options.gravity ?? 0.00035;
  for (let pass = 0; pass < iterations; pass += 1) {
    for (let i = 0; i < count; i += 1) {
      const pin = pins[i] || 0;
      if (pin > 0.99) { p[i * 3] = rest[i * 3]; p[i * 3 + 1] = rest[i * 3 + 1]; p[i * 3 + 2] = rest[i * 3 + 2]; continue; }
      p[i * 3 + 1] -= gravity * (1 - pin);
      p[i * 3] = lerp(p[i * 3], rest[i * 3], 0.006 * (1 - pin));
      p[i * 3 + 2] = lerp(p[i * 3 + 2], rest[i * 3 + 2], 0.006 * (1 - pin));
    }
    for (let e = 0; e < edgeRest.length; e += 1) {
      const a = edges[e * 2];
      const b = edges[e * 2 + 1];
      const pa = a * 3;
      const pb = b * 3;
      const dx = p[pb] - p[pa];
      const dy = p[pb + 1] - p[pa + 1];
      const dz = p[pb + 2] - p[pa + 2];
      const len = Math.hypot(dx, dy, dz) || 1e-9;
      const err = (len - edgeRest[e]) / len;
      const wa = (1 - (pins[a] || 0)) * 0.5 * stiffness;
      const wb = (1 - (pins[b] || 0)) * 0.5 * stiffness;
      p[pa] += dx * err * wa; p[pa + 1] += dy * err * wa; p[pa + 2] += dz * err * wa;
      p[pb] -= dx * err * wb; p[pb + 1] -= dy * err * wb; p[pb + 2] -= dz * err * wb;
    }
    for (let i = 0; i < count; i += 1) {
      const pin = pins[i] || 0;
      if (pin > 0.99) continue;
      corr.set(0, 0, 0);
      collide(i, p[i * 3], p[i * 3 + 1], p[i * 3 + 2], corr);
      if (corr.lengthSq()) { p[i * 3] += corr.x; p[i * 3 + 1] += corr.y; p[i * 3 + 2] += corr.z; }
      if (pin > 0) {
        p[i * 3] = lerp(p[i * 3], rest[i * 3], pin);
        p[i * 3 + 1] = lerp(p[i * 3 + 1], rest[i * 3 + 1], pin);
        p[i * 3 + 2] = lerp(p[i * 3 + 2], rest[i * 3 + 2], pin);
      }
    }
  }
  attr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function addFolds(geometry, pins, topY, bottomY, amplitude, seed = 1) {
  const attr = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const p = attr.array;
  for (let i = 0; i < attr.count; i += 1) {
    const pin = pins[i] || 0;
    if (pin > 0.6) continue;
    const x = p[i * 3];
    const y = p[i * 3 + 1];
    const z = p[i * 3 + 2];
    const v = clamp((topY - y) / Math.max(topY - bottomY, 1e-6), 0, 1);
    const env = smoothstep(0.02, 0.22, v) * (1 - pin);
    if (env <= 0) continue;
    const theta = Math.atan2(x, z);
    const wave = Math.sin(theta * 9 + y * 22 + seed) * 0.45 + Math.sin(theta * 15 - y * 29 + 1.7) * 0.28 + Math.sin(y * 48 + theta * 4) * 0.18;
    const amount = wave * amplitude * env;
    p[i * 3] += normals.getX(i) * amount;
    p[i * 3 + 1] += normals.getY(i) * amount;
    p[i * 3 + 2] += normals.getZ(i) * amount;
  }
  attr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/* ------------------------------------------------------------------ */
/* Perfiles del maniquí                                                */
/* ------------------------------------------------------------------ */

function torsoRing(body, model, y) {
  const s = model.torso.sample(clamp(y / model.baseHeight, 0, 1));
  return { y, cx: 0, cz: s.cz || 0, rx: Math.max(s.rx, 0.03), rz: Math.max(s.rz, 0.03), n: 2.35 };
}

function legRing(body, model, side, y) {
  const s = model.legs[side < 0 ? 0 : 1].sample(clamp(y / model.baseHeight, 0, 1));
  return { y, cx: s.cx || 0, cz: s.cz || 0, rx: Math.max(s.rx, 0.025), rz: Math.max(s.rz, 0.025), n: 2.12 };
}

function garmentTorsoRing(body, model, clearance, type, y) {
  const base = torsoRing(body, model, y);
  const ease = clearance.at(y);
  const chestY = body.landmarks.chest_y_cm / 100;
  const hipY = body.landmarks.hip_y_cm / 100;
  const chest = torsoRing(body, model, chestY);
  const hip = torsoRing(body, model, hipY);
  const boxy = type === 'hoodie' || type === 'jacket' || clearance.bust * TAU > 0.075;
  let rx = base.rx + ease + 0.016;
  let rz = base.rz + ease * 0.88 + 0.014;
  if (boxy && y >= hipY - 0.02 && y <= chestY + 0.02) {
    const t = clamp((y - hipY) / Math.max(chestY - hipY, 1e-6), 0, 1);
    rx = Math.max(rx, lerp(hip.rx + clearance.hips, chest.rx + clearance.bust, t) + 0.012);
    rz = Math.max(rz, lerp(hip.rz + clearance.hips * 0.9, chest.rz + clearance.bust * 0.9, t) + 0.01);
  }
  if (y < hipY) {
    const drop = clamp(hipY - y, 0, 0.24);
    rx = Math.max(rx, hip.rx + clearance.hips + 0.028 + Math.min(0.016, drop * 0.06));
    rz = Math.max(rz, hip.rz + clearance.hips * 0.92 + 0.022 + Math.min(0.012, drop * 0.05));
  }
  return { ...base, y, rx, rz, ease };
}

/* ------------------------------------------------------------------ */
/* Torso + mangas                                                      */
/* ------------------------------------------------------------------ */

function makeTop(listing, body, model, clearance) {
  const type = listing.garment.type;
  const m = listing.garment.measurements;
  const H = body.profile.height_cm / 100;
  const shoulderY = body.landmarks.shoulder_y_cm / 100;
  const neckY = body.landmarks.neck_base_y_cm / 100;
  const armpitY = body.landmarks.axilla_y_cm / 100;
  const chestY = body.landmarks.chest_y_cm / 100;
  const hipY = body.landmarks.hip_y_cm / 100;
  const lengthCm = m.length_cm ?? DEFAULT_LENGTH[type] ?? 68;
  const hemY = clamp(shoulderY - lengthCm * CM, 0.2 * H, armpitY - 0.08);
  const shoulderHalf = body.landmarks.shoulder_width_cm / 200;
  const neckGirth = (body.profile.neck_cm ?? 0.19 * H * 100) / 100;
  const neckRx = neckGirth / TAU * 1.38 + 0.018;
  const neckRz = neckRx * 0.92;
  const neckBody = torsoRing(body, model, neckY);
  const neckCz = neckBody.cz;
  const shoulderRing = {
    y: shoulderY,
    cx: 0,
    cz: torsoRing(body, model, shoulderY).cz,
    rx: shoulderHalf * 1.16 + clearance.bust * 0.8 + 0.016,
    rz: Math.max(torsoRing(body, model, chestY).rz * 0.9 + clearance.bust * 0.5, 0.076),
    n: 2.55,
  };

  const ys = [];
  const steps = Math.max(9, Math.ceil((shoulderY - hemY) / 0.03));
  for (let i = 0; i < steps; i += 1) ys.push(lerp(hemY, shoulderY, i / steps));
  ys.push(shoulderY);
  const rings = ys.map((y) => garmentTorsoRing(body, model, clearance, type, y));
  rings[rings.length - 1] = { ...shoulderRing, ease: clearance.bust };
  const cap = 6;
  for (let i = 1; i <= cap; i += 1) {
    const t = i / cap;
    const taper = smoothstep(0.25, 1, t);
    rings.push({
      y: lerp(shoulderY, neckY + 0.01, t),
      cx: 0,
      cz: lerp(shoulderRing.cz, neckCz, t),
      rx: lerp(shoulderRing.rx + 0.02, neckRx + 0.02, taper),
      rz: lerp(shoulderRing.rz + 0.02, neckRz + 0.018, taper),
      n: lerp(2.55, 2.05, taper),
    });
  }

  const torso = buildLoft(rings, 96);
  const sp = torso.attributes.position;
  for (let i = 0; i < sp.count; i += 1) {
    const y = sp.getY(i);
    if (y > shoulderY - 0.035) {
      const ang = Math.atan2(sp.getX(i), sp.getZ(i));
      sp.setY(i, y - 0.022 * Math.abs(Math.cos(ang)) * smoothstep(shoulderY - 0.035, shoulderY + 0.012, y));
    }
  }
  sp.needsUpdate = true;
  torso.computeVertexNormals();

  const pins = new Float32Array(sp.count);
  for (let i = 0; i < sp.count; i += 1) {
    const y = sp.getY(i);
    const x = Math.abs(sp.getX(i));
    const top = smoothstep(shoulderY - 0.06, shoulderY - 0.005, y);
    const neck = smoothstep(neckY - 0.04, neckY + 0.01, y) * (1 - smoothstep(neckRx * 2.5, neckRx * 3.6, x));
    pins[i] = clamp(Math.max(top * 0.85, neck), 0, 1);
  }
  relax(torso, pins, (i, x, y, z, out) => {
    const ring = torsoRing(body, model, Math.min(y, shoulderY));
    const dx = x - ring.cx; const dz = z - ring.cz;
    const q = Math.hypot(dx / ring.rx, dz / ring.rz);
    if (q < 1.025) { const s = 1.025 / Math.max(q, 1e-4); out.x += dx * (s - 1); out.z += dz * (s - 1); }
  }, { iterations: 11, stiffness: 0.9, gravity: 0.0003 });
  addFolds(torso, pins, neckY, hemY, type === 'hoodie' ? 0.0026 : 0.002, 1.4);

  return { torso, pins, hemY, topY: neckY, neckY, shoulderY, chestY, neckRx, neckRz, neckCz, clearance };
}

function makeSleeve(listing, body, model, clearance, side) {
  const joint = side < 0 ? model.armJoints?.left : model.armJoints?.right;
  if (!joint) return null;
  const type = listing.garment.type;
  const m = listing.garment.measurements;
  const sleeveCm = m.sleeve_cm ?? DEFAULT_SLEEVE[type] ?? 20;
  if (sleeveCm < 5) return null;
  const axis = new THREE.Vector3().subVectors(joint.wrist, joint.shoulder);
  const armLen = axis.length();
  if (armLen < 0.1) return null;
  axis.normalize();
  const tEnd = clamp((sleeveCm * CM) / armLen, 0.12, 0.98);
  const upperGirth = (body.profile.upper_arm_cm ?? body.profile.bust_cm * 0.36) / 100;
  const wristGirth = (body.profile.wrist_cm ?? body.profile.bust_cm * 0.17) / 100;
  const ease = type === 'tshirt' ? 0.02 : type === 'hoodie' ? 0.03 : 0.022;
  const r0 = Math.max(upperGirth / TAU + ease, 0.038);
  const r1 = type === 'tshirt' ? r0 * 0.94 : Math.max(wristGirth / TAU + ease * 0.75, 0.028);
  const up = Math.abs(axis.y) > 0.92 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const ax = new THREE.Vector3().crossVectors(up, axis).normalize();
  const az = new THREE.Vector3().crossVectors(axis, ax).normalize();

  const samples = [
    { t: -0.10, r: r0 * 0.86 },
    { t: -0.02, r: r0 * 0.95 },
    { t: 0.06, r: r0 },
  ];
  const rows = 11;
  for (let i = 0; i < rows - samples.length; i += 1) {
    const u = (i + 1) / (rows - samples.length);
    samples.push({ t: lerp(0.16, tEnd, u), r: lerp(r0, r1, Math.pow(u, 0.9)) });
  }
  const segments = 56;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const center = joint.shoulder.clone().addScaledVector(axis, s.t * armLen);
    for (let j = 0; j < segments; j += 1) {
      const a = (j / segments) * TAU;
      const p = new THREE.Vector3().copy(center)
        .addScaledVector(ax, Math.cos(a) * s.r)
        .addScaledVector(az, Math.sin(a) * s.r);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / segments, i / (samples.length - 1));
    }
  }
  for (let i = 0; i < samples.length - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j2 = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + j2;
      const c = (i + 1) * segments + j2;
      const d = (i + 1) * segments + j;
      indices.push(a, b, c, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const pins = new Float32Array(positions.length / 3);
  for (let i = 0; i < samples.length; i += 1) {
    const pin = 1 - smoothstep(0.02, 0.14, samples[i].t);
    for (let j = 0; j < segments; j += 1) pins[i * segments + j] = pin;
  }
  relax(geometry, pins, (i, x, y, z, out) => {
    const p = new THREE.Vector3(x, y, z);
    const rel = p.clone().sub(joint.shoulder);
    const t = clamp(rel.dot(axis) / armLen, 0, 1);
    const center = joint.shoulder.clone().addScaledVector(axis, t * armLen);
    const rad = p.clone().sub(center);
    const d = rad.length();
    const minD = Math.max(upperGirth / TAU * (1 - 0.42 * t) + 0.006, 0.022);
    if (d < minD) { rad.normalize().multiplyScalar(minD - d); out.add(rad); }
  }, { iterations: 10, stiffness: 0.92, gravity: 0.0003 });
  addFolds(geometry, pins, joint.shoulder.y, joint.shoulder.y - sleeveCm * CM, 0.0016, 2 + side);

  // Cerrar la copa DESPUÉS del solver: si se añade antes, el centro de la
  // tapa entra en la relajación y genera NaN. Aquí solo tapa el tubo para que
  // no se vea el interior oscuro en el hombro.
  const capCenter = new THREE.Vector3();
  for (let j = 0; j < segments; j += 1) {
    capCenter.x += positions[j * 3];
    capCenter.y += positions[j * 3 + 1];
    capCenter.z += positions[j * 3 + 2];
  }
  capCenter.multiplyScalar(1 / segments);
  const capIndex = positions.length / 3;
  positions.push(capCenter.x, capCenter.y, capCenter.z);
  uvs.push(0.5, 0);
  for (let j = 0; j < segments; j += 1) {
    indices.push(capIndex, (j + 1) % segments, j);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/* ------------------------------------------------------------------ */
/* Vaqueros                                                            */
/* ------------------------------------------------------------------ */

function makeJeans(listing, body, model, clearance) {
  const m = listing.garment.measurements;
  const waistY = body.landmarks.waist_y_cm / 100;
  const hipY = body.landmarks.hip_y_cm / 100;
  const crotchY = body.landmarks.crotch_y_cm / 100;
  const ankleY = body.landmarks.ankle_y_cm / 100;
  const rise = (m.rise_cm ?? 28) * CM;
  const inseam = (m.inseam_cm ?? body.landmarks.leg_length_cm) * CM;
  const waistbandY = clamp(crotchY + rise, waistY - 0.05, waistY + 0.05);
  const hemY = Math.max(ankleY + 0.012, crotchY - inseam);
  const hip = torsoRing(body, model, hipY);
  const hipEase = clearance.hips + 0.014;

  const pelvisYs = [crotchY - 0.015, crotchY + 0.04, hipY, lerp(hipY, waistbandY, 0.55), waistbandY];
  const pelvis = buildLoft(pelvisYs.map((y) => {
    const b = torsoRing(body, model, y);
    return { ...b, rx: Math.max(b.rx + hipEase, hip.rx + hipEase * 0.92), rz: Math.max(b.rz + hipEase * 0.9, hip.rz + hipEase * 0.82), n: 2.45 };
  }), 96, true);
  const pelvisPins = new Float32Array(pelvis.attributes.position.count);
  const pp = pelvis.attributes.position;
  for (let i = 0; i < pp.count; i += 1) pelvisPins[i] = smoothstep(waistbandY - 0.06, waistbandY - 0.01, pp.getY(i));
  relax(pelvis, pelvisPins, (i, x, y, z, out) => {
    const ring = torsoRing(body, model, y);
    const dx = x - ring.cx; const dz = z - ring.cz;
    const q = Math.hypot(dx / ring.rx, dz / ring.rz);
    if (q < 1.025) { const s = 1.025 / Math.max(q, 1e-4); out.x += dx * (s - 1); out.z += dz * (s - 1); }
  }, { iterations: 10, stiffness: 0.9, gravity: 0.0003 });

  const parts = [pelvis];
  const thighGirth = ((m.thigh_cm ?? 31) * 2) / 100;
  const hemGirth = ((m.hem_cm ?? 19) * 2) / 100;
  for (const side of [-1, 1]) {
    const legYs = [hemY, lerp(hemY, crotchY, 0.33), lerp(hemY, crotchY, 0.66), crotchY - 0.01, crotchY + 0.07];
    const leg = buildLoft(legYs.map((y) => {
      const b = legRing(body, model, side, y);
      const t = clamp((crotchY - y) / Math.max(crotchY - hemY, 1e-6), 0, 1);
      const girth = lerp(thighGirth, hemGirth, Math.pow(t, 0.82));
      const radius = Math.max(girth / TAU + 0.008, 0.032);
      return { ...b, rx: radius, rz: radius * 0.94, n: 2.12 };
    }), 64);
    const pins = new Float32Array(leg.attributes.position.count);
    const lp = leg.attributes.position;
    for (let i = 0; i < lp.count; i += 1) pins[i] = smoothstep(crotchY - 0.01, crotchY + 0.08, lp.getY(i));
    relax(leg, pins, (i, x, y, z, out) => {
      const ring = legRing(body, model, side, y);
      const dx = x - ring.cx; const dz = z - ring.cz;
      const q = Math.hypot(dx / ring.rx, dz / ring.rz);
      if (q < 1.025) { const s = 1.025 / Math.max(q, 1e-4); out.x += dx * (s - 1); out.z += dz * (s - 1); }
    }, { iterations: 10, stiffness: 0.94, gravity: 0.00025 });
    addFolds(leg, pins, crotchY, hemY, 0.0016, 3 + side);
    parts.push(leg);
  }
  const geometry = mergeGeometries(parts, false);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, hemY, topY: waistbandY, waistbandY, hipY, crotchY, clearance };
}

/* ------------------------------------------------------------------ */
/* Vaqueros continuos (parche del cuerpo, sin relax agresivo)           */
/* ------------------------------------------------------------------ */

function makeJeansPatch(listing, body, model, clearance) {
  const m = listing.garment.measurements;
  const waistY = body.landmarks.waist_y_cm / 100;
  const hipY = body.landmarks.hip_y_cm / 100;
  const crotchY = body.landmarks.crotch_y_cm / 100;
  const ankleY = body.landmarks.ankle_y_cm / 100;
  const rise = (m.rise_cm ?? 28) * CM;
  const inseam = (m.inseam_cm ?? body.landmarks.leg_length_cm) * CM;
  const waistbandY = clamp(crotchY + rise, waistY - 0.05, waistY + 0.05);
  const hemY = Math.max(ankleY + 0.012, crotchY - inseam);
  const groups = model.groupWeights;
  const bodyPositions = model.geometry.attributes.position;
  const keep = (i) => {
    const y = bodyPositions.getY(i);
    if (y < hemY || y > waistbandY) return false;
    const torso = groups[i * 6] > 0.3;
    const leg = groups[i * 6 + 3] + groups[i * 6 + 4] > 0.35;
    return torso || leg;
  };
  const patch = extractPatch(model.geometry, groups, keep);
  if (!patch) return null;
  const positions = patch.geometry.attributes.position;
  const normals = patch.geometry.attributes.normal;
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    const c = clearance.at(y) * 0.62 + 0.007;
    positions.setXYZ(
      i,
      positions.getX(i) + normals.getX(i) * c,
      positions.getY(i) + normals.getY(i) * c,
      positions.getZ(i) + normals.getZ(i) * c,
    );
  }
  positions.needsUpdate = true;

  // Pierna recta: el parche del cuerpo sigue el gemelo y parece un legging.
  // Ensanchamos cada pernera hacia el ancho de muslo/bajo del listing.
  const thighGirth = ((m.thigh_cm ?? 31) * 2) / 100;
  const hemGirth = ((m.hem_cm ?? 19) * 2) / 100;
  for (let i = 0; i < positions.count; i += 1) {
    const src = patch.source[i];
    if (src === undefined) continue;
    const legWeight = groups[src * 6 + 3] + groups[src * 6 + 4];
    if (legWeight < 0.25) continue;
    const y = positions.getY(i);
    if (y > hipY + 0.04) continue;
    const side = positions.getX(i) < 0 ? -1 : 1;
    const base = legRing(body, model, side, y);
    const t = clamp((crotchY - y) / Math.max(crotchY - hemY, 1e-6), 0, 1);
    const target = Math.max(base.rx + 0.012, lerp(thighGirth, hemGirth, Math.pow(t, 0.82)) / TAU + 0.008);
    const dx = positions.getX(i) - base.cx;
    const dz = positions.getZ(i) - base.cz;
    const d = Math.hypot(dx, dz);
    if (d < 1e-5) continue;
    const scale = lerp(1, target / d, Math.min(1, legWeight * 0.95));
    positions.setXYZ(i, base.cx + dx * scale, y, base.cz + dz * scale);
  }
  positions.needsUpdate = true;
  patch.geometry.computeVertexNormals();
  patch.geometry.computeBoundingSphere();
  // UVs cilíndricas
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i += 1) {
    uv[i * 2] = (Math.atan2(positions.getX(i), positions.getZ(i)) + Math.PI) / TAU;
    uv[i * 2 + 1] = clamp((positions.getY(i) - hemY) / Math.max(waistbandY - hemY, 1e-6), 0, 1);
  }
  patch.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return { geometry: patch.geometry, hemY, topY: waistbandY, waistbandY, hipY, crotchY, clearance };
}

/* ------------------------------------------------------------------ */
/* Falda / vestido                                                     */
/* ------------------------------------------------------------------ */

function makeSkirtDress(listing, body, model, clearance) {
  const type = listing.garment.type;
  const m = listing.garment.measurements;
  const H = body.profile.height_cm / 100;
  const waistY = body.landmarks.waist_y_cm / 100;
  const hipY = body.landmarks.hip_y_cm / 100;
  const chestY = body.landmarks.chest_y_cm / 100;
  const armpitY = body.landmarks.axilla_y_cm / 100;
  const lengthCm = m.length_cm ?? DEFAULT_LENGTH[type] ?? 65;
  const topY = type === 'dress' ? armpitY - 0.008 : waistY + 0.012;
  const hemY = clamp(topY - lengthCm * CM, 0.16 * H, topY - 0.16);
  const rows = 28;
  const segments = type === 'skirt' ? 160 : 128;
  const hip = torsoRing(body, model, hipY);
  const rings = [];
  for (let i = 0; i < rows; i += 1) {
    const t = i / (rows - 1);
    const y = lerp(topY, hemY, t);
    if (y >= hipY) {
      const b = torsoRing(body, model, y);
      rings.push({ y, cx: 0, cz: b.cz, rx: b.rx + clearance.at(y) + 0.008, rz: b.rz + clearance.at(y) * 0.95 + 0.007, n: type === 'dress' ? 2.28 : 2.4 });
    } else {
      const drop = clamp((hipY - y) / Math.max(hipY - hemY, 1e-6), 0, 1);
      const flare = type === 'dress' ? 1.45 : 1.7;
      const amount = 1 + (flare - 1) * Math.pow(drop, 1.4);
      rings.push({ y, cx: 0, cz: hip.cz, rx: (hip.rx + clearance.hips + 0.01) * amount, rz: (hip.rz + clearance.hips * 0.9 + 0.009) * amount, n: type === 'dress' ? 2.28 : 2.4, pleat: type === 'skirt' ? 0.002 + 0.006 * drop : 0, pleatCount: 24 });
    }
  }
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < rings.length; i += 1) {
    const ring = rings[i];
    for (let j = 0; j < segments; j += 1) {
      const a = (j / segments) * TAU;
      const p = superellipse(a, ring.rx, ring.rz, ring.n);
      let x = ring.cx + p.x;
      let z = ring.cz + p.z;
      if (ring.pleat) {
        const scale = 1 + Math.cos(a * ring.pleatCount) * ring.pleat * 2.2;
        x = ring.cx + (x - ring.cx) * scale;
        z = ring.cz + (z - ring.cz) * scale;
      }
      positions.push(x, ring.y, z);
      uvs.push(j / segments, i / (rings.length - 1));
    }
  }
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j2 = (j + 1) % segments;
      const a = i * segments + j;
      const b = i * segments + j2;
      const c = (i + 1) * segments + j2;
      const d = (i + 1) * segments + j;
      indices.push(a, b, c, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const pins = new Float32Array(positions.length / 3);
  for (let i = 0; i < pins.length; i += 1) {
    const y = positions[i * 3 + 1];
    pins[i] = type === 'dress' ? smoothstep(armpitY - 0.05, armpitY, y) : smoothstep(waistY - 0.03, waistY + 0.01, y);
  }
  relax(geometry, pins, (i, x, y, z, out) => {
    if (y > hipY) {
      const b = torsoRing(body, model, y);
      const dx = x - b.cx; const dz = z - b.cz;
      const q = Math.hypot(dx / b.rx, dz / b.rz);
      if (q < 1.025) { const s = 1.025 / Math.max(q, 1e-4); out.x += dx * (s - 1); out.z += dz * (s - 1); }
    }
  }, { iterations: 8, stiffness: 0.92, gravity: 0.00018 });
  addFolds(geometry, pins, topY, hemY, type === 'dress' ? 0.0016 : 0.0009, 5.2);
  return { geometry, topY, hemY, hipY, waistY, chestY, clearance };
}

/* ------------------------------------------------------------------ */
/* Holgura                                                             */
/* ------------------------------------------------------------------ */

function buildClearanceLocal(fit, body, fabric, type) {
  const recipe = FABRIC_RECIPE[fabric] || FABRIC_RECIPE.cotton_jersey;
  const zones = Object.fromEntries((fit?.zones || []).map((z) => [z.name, z.ease_cm]));
  const fallback = { tshirt: 6.5, hoodie: 12, jacket: 15, dress: 7, jeans: 4, skirt: 7 }[type] ?? 7;
  const ease = (name, alt = fallback) => (Number.isFinite(zones[name]) ? zones[name] : alt);
  const radial = (cm) => Math.max(0.0025, (cm * CM) / TAU) + recipe.thickness + 0.0015;
  const l = body.landmarks;
  const H = body.profile.height_cm;
  const chestY = l.chest_y_cm / 100;
  const waistY = l.waist_y_cm / 100;
  const hipY = l.hip_y_cm / 100;
  const crotchY = l.crotch_y_cm / 100;
  const ankleY = l.ankle_y_cm / 100;
  const shoulderY = l.shoulder_y_cm / 100;
  const bust = radial(ease('Pecho', fallback));
  const waist = radial(ease('Cintura', fallback * 0.86));
  const hips = radial(ease('Cadera', fallback * 0.95));
  const thigh = radial(ease('Muslo', fallback * 0.72));
  const c = [
    { y: ankleY, c: thigh * 0.9 }, { y: crotchY, c: thigh }, { y: hipY, c: hips },
    { y: waistY, c: waist }, { y: chestY, c: bust }, { y: shoulderY + 0.06, c: bust * 0.9 },
    { y: H, c: bust * 0.8 },
  ].sort((a, b) => a.y - b.y);
  return {
    at(y) {
      if (y <= c[0].y) return c[0].c;
      if (y >= c[c.length - 1].y) return c[c.length - 1].c;
      for (let i = 1; i < c.length; i += 1) {
        if (y <= c[i].y) return lerp(c[i - 1].c, c[i].c, (y - c[i - 1].y) / Math.max(c[i].y - c[i - 1].y, 1e-6));
      }
      return bust;
    },
    bust, waist, hips, thigh, chestY, waistY, hipY, crotchY, ankleY, shoulderY,
  };
}

function heatmapFor(geometry, fit, clearance, group) {
  const heat = geometry.clone();
  const colors = new THREE.Float32BufferAttribute(new Float32Array(heat.attributes.position.count * 3), 3);
  const palette = { too_small: new THREE.Color('#b3261e'), tight: new THREE.Color('#a15c00'), regular: new THREE.Color('#007782'), loose: new THREE.Color('#2f5d8a'), too_big: new THREE.Color('#5b5b57') };
  const targets = { Pecho: clearance.chestY, Cintura: clearance.waistY, Cadera: clearance.hipY, Muslo: clearance.crotchY - 0.08 };
  const zones = fit?.zones || [];
  for (let i = 0; i < heat.attributes.position.count; i += 1) {
    const y = heat.attributes.position.getY(i);
    let best = zones[0]; let bd = Infinity;
    for (const z of zones) { const d = Math.abs(y - (targets[z.name] ?? clearance.chestY)); if (d < bd) { bd = d; best = z; } }
    const color = palette[best?.verdict] || palette.regular;
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  heat.setAttribute('color', colors);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(heat, mat);
  mesh.visible = false;
  mesh.renderOrder = 2;
  group.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Ensamblado                                                          */
/* ------------------------------------------------------------------ */

export function buildGarmentV2({ listing, body, model, fit, textures }) {
  const type = listing.garment?.type || 'tshirt';
  const fabric = listing.garment?.fabric || 'cotton_jersey';
  const style = LISTING_STYLE[listing.id] || {};
  const clearance = buildClearanceLocal(fit, body, fabric, type);
  const group = new THREE.Group();
  group.name = `Garment:${listing.id}`;
  const material = createFabricMaterial(fabric, textures, style.color ?? null);
  const detail = buildRib(material);

  let base = null;
  let geometry = null;
  if (type === 'tshirt' || type === 'hoodie' || type === 'jacket') {
    base = makeTop(listing, body, model, clearance);
    const parts = [base.torso];
    for (const side of [-1, 1]) {
      const sleeve = makeSleeve(listing, body, model, clearance, side);
      if (sleeve) parts.push(sleeve);
    }
    geometry = mergeGeometries(parts, false);
  } else if (type === 'jeans') {
    base = makeJeansPatch(listing, body, model, clearance);
    geometry = base.geometry;
  } else {
    base = makeSkirtDress(listing, body, model, clearance);
    geometry = base.geometry;
  }
  if (!geometry) return null;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Remates: escote, puños y bajo. Se toman de los bucles de frontera reales.
  const loops = boundaryLoops(geometry.index.array).map((loop) => {
    let sy = 0; let sx = 0;
    const positions = geometry.attributes.position.array;
    for (const i of loop) { sy += positions[i * 3 + 1]; sx += Math.abs(positions[i * 3]); }
    return { loop, y: sy / loop.length, x: sx / loop.length };
  }).sort((a, b) => b.y - a.y);
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  if (loops.length) {
    const neckLoop = loops.find((l) => l.loop.length > 16 && l.x < 0.16 && l.y > (base.neckY ?? base.topY) - 0.12);
    if (neckLoop) addLoopRib(group, neckLoop.loop, positions, normals, detail, 0.011, 12);
    const hemLoop = loops.find((l) => l.loop.length > 16 && l.y < base.hemY + 0.08 && l.x < 0.3);
    if (hemLoop) addLoopRib(group, hemLoop.loop, positions, normals, material, 0.0055, 8);
    for (const item of loops) {
      if (item === neckLoop || item === hemLoop) continue;
      if (item.x > 0.18 && type !== 'jeans') addLoopRib(group, item.loop, positions, normals, detail, 0.008, 8);
    }
  }

  if (type === 'hoodie') buildHood(group, body, material, detail);
  if (type === 'dress') buildDressStraps(group, body, material);
  if (type === 'jacket') {
    const yTop = base.topY - 0.02; const yBottom = base.hemY + 0.02;
    if (fabric === 'leather') buildZipper(group, body, yBottom, yTop, detail, new THREE.MeshStandardMaterial({ color: 0x9b9388, roughness: 0.35, metalness: 0.8 }));
    else buildButtons(group, body, yTop, yBottom, new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.7 }));
  }
  if (type === 'jeans') {
    const ring = sampleRingAt(body.torso, base.waistbandY * 100);
    if (ring) {
      buildWaistband(group, body, base.waistbandY * 100, 0.038, clearance.waist, material, detail);
      buildBeltLoops(group, body, base.waistbandY * 100, material);
    }
    if (fabric === 'denim') {
      const gold = new THREE.MeshStandardMaterial({ color: 0xc9a25c, roughness: 0.55, metalness: 0.1 });
      const fly = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.006), material);
      const fr = sampleRingAt(body.torso, base.waistbandY * 100);
      fly.position.set(0, base.waistbandY - 0.06, ((fr?.cz || 0) + (fr?.rz || 8)) / 100 + 0.012);
      group.add(fly);
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.003, 20), gold);
      button.rotation.x = Math.PI / 2;
      button.position.set(0, base.waistbandY - 0.012, fly.position.z + 0.004);
      group.add(button);
    }
  }

  const heatmap = heatmapFor(geometry, fit, clearance, group);
  return {
    group,
    mesh,
    heatmap,
    base,
    material,
    meta: { type, fabric, style, vertices: geometry.attributes.position.count, triangles: geometry.index ? geometry.index.count / 3 : 0, clearance: clearance.bust },
    setHeatmap(v) { heatmap.visible = !!v; },
    dispose() {
      const gs = new Set(); const ms = new Set();
      group.traverse((o) => { if (!o.isMesh) return; if (o.geometry) gs.add(o.geometry); if (o.material) ms.add(o.material); });
      gs.forEach((g) => g.dispose?.()); ms.forEach((m) => m.dispose?.()); group.removeFromParent();
    },
  };
}
