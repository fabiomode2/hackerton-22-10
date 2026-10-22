/**
 * Cuerpo paramétrico a partir de medidas.
 *
 * Pipeline:
 *   BodyProfile (6 base + opcionales + rasgos)
 *     → resolveBodyProfile()  // priors, validación, confianza
 *     → computeTorsoLayout()  // landmarks verticales
 *     → buildTorsoTorso()     // anillos horizontales (contrato Ring)
 *     → buildLeg()/buildArm() // tubos sobre el esqueleto
 *     → validateGeometry()    // reproyección de circunferencias
 *
 * El torso sale como `Ring[]` compatible con el contrato congelado. Piernas y
 * brazos salen como `PathRing[]` (centro + ejes locales) porque no son
 * horizontales. El motor de fit solo necesita `torso`; el viewer usa el resto.
 *
 * Unidades: cm. Ejes: Y arriba, Z frontal, X derecha. Origen en el suelo.
 * Sin DOM, sin red, sin dependencias.
 */
import type { Ring } from './types';
import {
  resolveBodyProfile,
  type BodyProfile,
  type BodyWarning,
  type ResolvedBodyProfile,
} from './body-profile';

export type Vec3 = { x: number; y: number; z: number };

export type BodyRegion =
  | 'hip_low'
  | 'hip'
  | 'waist'
  | 'underbust'
  | 'bust'
  | 'chest'
  | 'axilla'
  | 'shoulder'
  | 'neck'
  | 'thigh'
  | 'knee'
  | 'calf'
  | 'ankle'
  | 'arm'
  | 'forearm'
  | 'wrist';

/** Anillo horizontal del torso. `Ring` + centro X + región + circunferencia. */
export type BodyRing = Ring & {
  cx: number;
  region: BodyRegion;
  circumference_cm: number;
};

/** Anillo de un tubo (brazo/pierna): centro y ejes locales en 3D. */
export type PathRing = {
  center: Vec3;
  u: Vec3;
  v: Vec3;
  rx: number;
  rz: number;
  n: number;
  circumference_cm: number;
  region: BodyRegion;
};

export type BodyLimb = {
  name: 'left_leg' | 'right_leg' | 'left_arm' | 'right_arm';
  kind: 'leg' | 'arm';
  side: -1 | 1;
  joints: Record<string, Vec3>;
  rings: PathRing[];
};

export type BodyHead = {
  center: Vec3;
  rx: number;
  ry: number;
  rz: number;
  n: number;
};

export type BodyFoot = {
  side: -1 | 1;
  center: Vec3;
  rx: number;
  ry: number;
  rz: number;
  n: number;
};

export type BodyHand = {
  side: -1 | 1;
  center: Vec3;
  axis: Vec3;
  length_cm: number;
  width_cm: number;
  thickness_cm: number;
};

export type BodyLandmarks = {
  height_cm: number;
  head_top_y_cm: number;
  chin_y_cm: number;
  neck_base_y_cm: number;
  shoulder_y_cm: number;
  axilla_y_cm: number;
  bust_y_cm: number;
  chest_y_cm: number;
  underbust_y_cm: number;
  waist_y_cm: number;
  hip_y_cm: number;
  crotch_y_cm: number;
  knee_y_cm: number;
  ankle_y_cm: number;

  shoulder_width_cm: number;
  hip_width_cm: number;
  waist_width_cm: number;
  bust_width_cm: number;
  chest_depth_cm: number;

  arm_length_cm: number;
  leg_length_cm: number;
  torso_length_cm: number;
};

export type BodyGeometry = {
  profile: ResolvedBodyProfile;
  torso: BodyRing[];
  legs: BodyLimb[];
  arms: BodyLimb[];
  neck: BodyRing[];
  head: BodyHead;
  feet: BodyFoot[];
  hands: BodyHand[];
  landmarks: BodyLandmarks;
  warnings: BodyWarning[];
  inferred: string[];
  confidence: number;
  meta: {
    ring_count: number;
    estimated_vertices: number;
    estimated_triangles: number;
  };
};

type TorsoLayout = {
  crotchY: number;
  hipJointY: number;
  hipLowY: number;
  hipY: number;
  waistY: number;
  underbustY: number;
  bustY: number;
  chestY: number;
  axillaY: number;
  shoulderY: number;
  neckBaseY: number;
  chinY: number;
  headTopY: number;
  kneeY: number;
  ankleY: number;
};

type TorsoKey = {
  y: number;
  circumference: number;
  ratio: number;
  n: number;
  frontBias: number;
  region: BodyRegion;
};

const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

function scale(v: Vec3, factor: number): Vec3 {
  return vec(v.x * factor, v.y * factor, v.z * factor);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function lengthOf(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = lengthOf(v);
  if (len < 1e-9) return vec(0, 0, 0);
  return scale(v, 1 / len);
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return vec(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
}

/**
 * Punto de una superelipse. `n = 2` es una elipse; `n > 2` se acerca a un
 * rectángulo redondeado. `t` recorre 0..2π.
 */
export function superellipsePoint(t: number, rx: number, rz: number, n: number): { x: number; z: number } {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const exponent = 2 / n;
  return {
    x: rx * Math.sign(c) * Math.pow(Math.abs(c), exponent),
    z: rz * Math.sign(s) * Math.pow(Math.abs(s), exponent),
  };
}

/** Perímetro numérico de la superelipse (96 muestras por defecto). */
export function superellipsePerimeter(rx: number, rz: number, n: number, samples = 96): number {
  let perimeter = 0;
  let previous = superellipsePoint(0, rx, rz, n);

  for (let i = 1; i <= samples; i += 1) {
    const point = superellipsePoint((i / samples) * TAU, rx, rz, n);
    perimeter += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }

  return perimeter;
}

/**
 * Dado un contorno y una relación profundidad/anchura, resuelve los semiejes.
 * Se hace por bisección porque la superelipse no tiene inversa cerrada.
 */
function solveRxForCircumference(
  circumference: number,
  depthRatio: number,
  n: number,
): { rx: number; rz: number } {
  const ratio = clamp(depthRatio, 0.35, 1.4);
  let low = 0.001;
  let high = Math.max(circumference, 1);

  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    const perimeter = superellipsePerimeter(mid, mid * ratio, n);
    if (perimeter < circumference) low = mid;
    else high = mid;
  }

  const rx = (low + high) / 2;
  return { rx, rz: rx * ratio };
}

/** Anillo horizontal a partir de un contorno. */
function ringFromCircumference(
  y: number,
  circumference: number,
  depthRatio: number,
  n: number,
  region: BodyRegion,
  cx = 0,
  frontBias = 0,
): BodyRing {
  const { rx, rz } = solveRxForCircumference(circumference, depthRatio, n);
  return {
    y,
    rx,
    rz,
    cz: rz * frontBias,
    n,
    cx,
    region,
    circumference_cm: circumference,
  };
}

/**
 * Anillo horizontal con una anchura objetivo (p. ej. ancho de espalda).
 * Si la anchura no cabe en el contorno, se recorta y se avisa.
 */
function ringFromWidth(
  y: number,
  width: number,
  circumference: number,
  depthRatio: number,
  n: number,
  region: BodyRegion,
  frontBias = 0,
): BodyRing {
  const rx = Math.min(width / 2, circumference / 4.2);
  let low = 0.001;
  let high = Math.max(circumference, 1);

  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    const perimeter = superellipsePerimeter(rx, mid, n);
    if (perimeter < circumference) low = mid;
    else high = mid;
  }

  const rz = (low + high) / 2;
  return {
    y,
    rx,
    rz,
    cz: rz * frontBias,
    n,
    cx: 0,
    region,
    circumference_cm: circumference,
  };
}

/** Anillo horizontal definido directamente por sus semiejes. */
function directRing(
  y: number,
  rx: number,
  rz: number,
  n: number,
  region: BodyRegion,
  cx = 0,
  frontBias = 0,
): BodyRing {
  return {
    y,
    rx,
    rz,
    cz: rz * frontBias,
    n,
    cx,
    region,
    circumference_cm: superellipsePerimeter(rx, rz, n),
  };
}

/**
 * Alturas de los landmarks. Las medidas mandan; las proporciones solo rellenan
 * lo que no se puede medir con una cinta (posición de cadera, hombro, etc.).
 */
function computeTorsoLayout(profile: ResolvedBodyProfile): TorsoLayout {
  const height = profile.height_cm;
  // Si la entrepierna es implausible (>55% de la altura), se regulariza para
  // que la cadera quede por encima del crotch. El perfil conserva el dato
  // original; la geometría avisa y usa el valor efectivo.
  const crotchY = Math.min(profile.inseam_cm, 0.55 * height);
  const hipJointY = crotchY + 0.04 * height;
  const hipY = Math.max(0.55 * height, hipJointY + 3);
  const neckBaseY = 0.835 * height;

  const waistMin = hipY + 3;
  const waistMax = Math.max(waistMin + 1, 0.66 * height);
  const waistY = clamp(neckBaseY - profile.torso_length_cm, waistMin, waistMax);

  const bustY = Math.max(0.71 * height, waistY + 0.08 * height);
  const underbustY = Math.max(waistY + 0.02 * height, bustY - 0.05 * height);
  const chestY = bustY + 0.015 * height;
  const axillaY = Math.max(0.765 * height, chestY + 0.01 * height);
  const shoulderY = Math.max(
    0.815 * height - 0.02 * height * profile.shoulder_slope,
    axillaY + 0.01 * height,
  );
  const chinY = Math.max(0.87 * height, neckBaseY + 0.02 * height);
  const headTopY = height;
  const kneeY = 0.285 * height;
  const ankleY = 0.039 * height;

  return {
    crotchY,
    hipJointY,
    hipLowY: hipJointY - 1,
    hipY,
    waistY,
    underbustY,
    bustY,
    chestY,
    axillaY,
    shoulderY,
    neckBaseY,
    chinY,
    headTopY,
    kneeY,
    ankleY,
  };
}

function buildTorsoKeys(profile: ResolvedBodyProfile, layout: TorsoLayout): TorsoKey[] {
  const hipRatio =
    (profile.sex === 'female' ? 0.82 : profile.sex === 'male' ? 0.76 : 0.79) +
    profile.seat * 0.04;
  const waistRatio =
    (profile.sex === 'female' ? 0.7 : profile.sex === 'male' ? 0.74 : 0.72) +
    profile.belly * 0.08;
  const bustRatio =
    profile.sex === 'female'
      ? 0.8 + profile.bust_projection * 0.08
      : profile.sex === 'male'
        ? 0.74
        : 0.77;
  const bustN = profile.sex === 'female' ? 2.15 : profile.sex === 'male' ? 2.35 : 2.25;

  const hipBias = -0.06 - profile.seat * 0.12 - profile.posture * 0.02;
  const waistBias = -0.02 + profile.belly * 0.14 + profile.posture * 0.02;
  const bustBias =
    (profile.sex === 'female' ? 0.02 + profile.bust_projection * 0.14 : 0.02) +
    profile.posture * 0.03;
  const chestBias = 0.02 + profile.posture * 0.02;

  return [
    {
      y: layout.hipLowY,
      circumference: profile.hips_cm * 0.98,
      ratio: hipRatio,
      n: 2.2,
      frontBias: hipBias,
      region: 'hip_low',
    },
    {
      y: layout.hipY,
      circumference: profile.hips_cm,
      ratio: hipRatio,
      n: 2.2,
      frontBias: hipBias,
      region: 'hip',
    },
    {
      y: layout.waistY,
      circumference: profile.waist_cm,
      ratio: waistRatio,
      n: 2.2,
      frontBias: waistBias,
      region: 'waist',
    },
    {
      y: layout.underbustY,
      circumference: profile.underbust_cm,
      ratio: 0.735,
      n: 2.25,
      frontBias: 0.01,
      region: 'underbust',
    },
    {
      y: layout.bustY,
      circumference: profile.bust_cm,
      ratio: bustRatio,
      n: bustN,
      frontBias: bustBias,
      region: 'bust',
    },
    {
      y: layout.chestY,
      circumference: profile.bust_cm * 0.98,
      ratio: 0.75,
      n: 2.35,
      frontBias: chestBias,
      region: 'chest',
    },
    {
      y: layout.axillaY,
      circumference: profile.bust_cm * 0.94,
      ratio: 0.72,
      n: 2.3,
      frontBias: 0,
      region: 'axilla',
    },
  ];
}

function interpolateTorsoKey(keys: TorsoKey[], y: number): TorsoKey {
  if (y <= keys[0].y) return { ...keys[0], y };
  if (y >= keys[keys.length - 1].y) return { ...keys[keys.length - 1], y };

  let index = 0;
  while (index < keys.length - 1 && keys[index + 1].y < y) index += 1;

  const a = keys[index];
  const b = keys[index + 1];
  const t = smoothstep((y - a.y) / (b.y - a.y));

  return {
    y,
    circumference: lerp(a.circumference, b.circumference, t),
    ratio: lerp(a.ratio, b.ratio, t),
    n: lerp(a.n, b.n, t),
    frontBias: lerp(a.frontBias, b.frontBias, t),
    region: t < 0.5 ? a.region : b.region,
  };
}

function buildTorso(
  profile: ResolvedBodyProfile,
  layout: TorsoLayout,
  warnings: BodyWarning[],
): BodyRing[] {
  const keys = buildTorsoKeys(profile, layout);
  const samples: number[] = [];
  const perGap = 3;

  for (let i = 0; i < keys.length - 1; i += 1) {
    for (let j = 0; j < perGap; j += 1) {
      samples.push(lerp(keys[i].y, keys[i + 1].y, j / perGap));
    }
  }
  samples.push(keys[keys.length - 1].y);

  const torso: BodyRing[] = [];
  for (const y of samples) {
    const key = interpolateTorsoKey(keys, y);
    torso.push(
      ringFromCircumference(y, key.circumference, key.ratio, key.n, key.region, 0, key.frontBias),
    );
  }

  // El ancho de espalda manda en el anillo de pecho. Si no cabe en el
  // contorno, el motor prioriza el contorno (la prenda se calcula con él).
  const chestIndex = torso.findIndex((ring) => Math.abs(ring.y - layout.chestY) < 1e-6);
  if (chestIndex >= 0) {
    const chest = ringFromWidth(
      layout.chestY,
      profile.back_width_cm,
      profile.bust_cm * 0.98,
      0.75,
      2.35,
      'chest',
      0.02 + profile.posture * 0.02,
    );
    if (Math.abs(chest.rx * 2 - profile.back_width_cm) > 1) {
      warnings.push({
        code: 'back_width_adjusted',
        message: `El ancho de espalda (${profile.back_width_cm.toFixed(1)} cm) no cabe en el contorno de pecho; se ajusta a ${(chest.rx * 2).toFixed(1)} cm.`,
        severity: 'info',
      });
    }
    torso[chestIndex] = chest;
  }

  const axilla = torso[torso.length - 1];
  // El torso no llega al ancho biacromial completo: los deltoides y el tubo
  // del brazo aportan los últimos centímetros.
  const shoulderRx = (profile.shoulder_cm / 2) * 0.82;
  const shoulderRz = Math.max(axilla.rz * 0.72, shoulderRx * 0.52);
  const shoulderN = 2.5;

  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4;
    const s = smoothstep(t);
    torso.push(
      directRing(
        lerp(layout.axillaY, layout.shoulderY, t),
        lerp(axilla.rx, shoulderRx, s),
        lerp(axilla.rz, shoulderRz, s),
        lerp(axilla.n, shoulderN, s),
        'shoulder',
      ),
    );
  }

  torso.push(directRing(layout.shoulderY, shoulderRx, shoulderRz, shoulderN, 'shoulder'));

  const neckBase = ringFromCircumference(
    layout.neckBaseY,
    profile.neck_cm,
    0.9,
    2.0,
    'neck',
    0,
    0.01,
  );
  const shoulder = torso[torso.length - 1];

  for (let i = 1; i <= 2; i += 1) {
    const t = i / 3;
    const s = smoothstep(t);
    torso.push(
      directRing(
        lerp(layout.shoulderY, layout.neckBaseY, t),
        lerp(shoulder.rx, neckBase.rx, s),
        lerp(shoulder.rz, neckBase.rz, s),
        lerp(shoulder.n, neckBase.n, s),
        'neck',
      ),
    );
  }

  torso.push(neckBase);
  return torso;
}

function buildLeg(
  profile: ResolvedBodyProfile,
  layout: TorsoLayout,
  side: -1 | 1,
): BodyLimb {
  const hipJointX = (profile.sex === 'female' ? 0.05 : profile.sex === 'male' ? 0.046 : 0.048) *
    profile.height_cm;
  const kneeX = hipJointX * 0.94;
  const ankleX = hipJointX * 0.84;

  const hip = vec(side * hipJointX, layout.hipJointY, 0);
  const knee = vec(side * kneeX, layout.kneeY, 0.5);
  const ankle = vec(side * ankleX, layout.ankleY, 0);

  const xAt = (y: number): number => {
    if (y >= layout.kneeY) {
      const t = (layout.hipJointY - y) / (layout.hipJointY - layout.kneeY);
      return side * lerp(hipJointX, kneeX, clamp(t, 0, 1));
    }
    const t = (layout.kneeY - y) / (layout.kneeY - layout.ankleY);
    return side * lerp(kneeX, ankleX, clamp(t, 0, 1));
  };

  const zAt = (y: number): number => {
    if (y >= layout.kneeY) {
      const t = (layout.hipJointY - y) / (layout.hipJointY - layout.kneeY);
      return lerp(0, 0.5, clamp(t, 0, 1));
    }
    const t = (layout.kneeY - y) / (layout.kneeY - layout.ankleY);
    return lerp(0.5, 0, clamp(t, 0, 1));
  };

  const calfY = lerp(layout.kneeY, layout.ankleY, 0.45);
  const keyData: {
    y: number;
    c: number;
    ratio: number;
    region: BodyRegion;
    frontBias: number;
  }[] = [
    { y: layout.hipJointY, c: profile.thigh_cm * 1.02, ratio: 0.95, region: 'thigh', frontBias: 0 },
    {
      y: lerp(layout.hipJointY, layout.kneeY, 0.15),
      c: profile.thigh_cm,
      ratio: 0.95,
      region: 'thigh',
      frontBias: 0,
    },
    {
      y: lerp(layout.hipJointY, layout.kneeY, 0.55),
      c: profile.thigh_cm * 0.88,
      ratio: 0.95,
      region: 'thigh',
      frontBias: 0,
    },
    {
      y: lerp(layout.hipJointY, layout.kneeY, 0.85),
      c: profile.thigh_cm * 0.68,
      ratio: 0.93,
      region: 'thigh',
      frontBias: 0,
    },
    {
      y: layout.kneeY,
      c: Math.max(profile.calf_cm * 0.95, profile.thigh_cm * 0.6),
      ratio: 0.92,
      region: 'knee',
      frontBias: 0.04,
    },
    { y: calfY, c: profile.calf_cm, ratio: 0.9, region: 'calf', frontBias: -0.08 },
    {
      y: lerp(layout.kneeY, layout.ankleY, 0.85),
      c: profile.calf_cm * 0.78,
      ratio: 0.88,
      region: 'calf',
      frontBias: -0.04,
    },
    {
      y: layout.ankleY,
      c: profile.ankle_cm,
      ratio: 0.86,
      region: 'ankle',
      frontBias: 0,
    },
  ];

  const rings: PathRing[] = keyData.map((key) => {
    const { rx, rz } = solveRxForCircumference(key.c, key.ratio, 2.05);
    return {
      center: vec(xAt(key.y), key.y, zAt(key.y) + rz * key.frontBias),
      u: vec(1, 0, 0),
      v: vec(0, 0, 1),
      rx,
      rz,
      n: 2.05,
      circumference_cm: key.c,
      region: key.region,
    };
  });

  return {
    name: side < 0 ? 'left_leg' : 'right_leg',
    kind: 'leg',
    side,
    joints: { hip, knee, ankle },
    rings,
  };
}

function buildArm(
  profile: ResolvedBodyProfile,
  layout: TorsoLayout,
  side: -1 | 1,
): BodyLimb {
  const shoulderJointX = (profile.shoulder_cm / 2) * 0.84;
  const shoulderJointY = layout.shoulderY;
  const armLength = profile.arm_cm;
  const angle = (28 * Math.PI) / 180;

  const shoulder = vec(side * shoulderJointX, shoulderJointY, 0);
  const elbow = vec(
    side * (shoulderJointX + armLength * 0.52 * Math.sin(angle)),
    shoulderJointY - armLength * 0.52 * Math.cos(angle),
    0.025 * armLength,
  );
  const wrist = vec(
    side * (shoulderJointX + armLength * Math.sin(angle)),
    shoulderJointY - armLength * Math.cos(angle),
    0.02 * armLength,
  );

  const pathAt = (t: number): Vec3 => {
    if (t <= 0.52) return lerpVec(shoulder, elbow, t / 0.52);
    return lerpVec(elbow, wrist, (t - 0.52) / 0.48);
  };

  const circumferenceKeys: { t: number; c: number }[] = [
    { t: 0, c: profile.upper_arm_cm * 1.12 },
    { t: 0.15, c: profile.upper_arm_cm },
    { t: 0.45, c: profile.upper_arm_cm * 0.92 },
    { t: 0.52, c: profile.upper_arm_cm * 0.86 },
    { t: 0.65, c: profile.upper_arm_cm * 0.84 },
    { t: 0.85, c: profile.upper_arm_cm * 0.72 },
    { t: 1, c: profile.wrist_cm },
  ];

  const circumferenceAt = (t: number): number => {
    if (t <= circumferenceKeys[0].t) return circumferenceKeys[0].c;
    const last = circumferenceKeys[circumferenceKeys.length - 1];
    if (t >= last.t) return last.c;

    let index = 0;
    while (index < circumferenceKeys.length - 1 && circumferenceKeys[index + 1].t < t) {
      index += 1;
    }
    const a = circumferenceKeys[index];
    const b = circumferenceKeys[index + 1];
    const s = smoothstep((t - a.t) / (b.t - a.t));
    return lerp(a.c, b.c, s);
  };

  const rings: PathRing[] = [];
  const ringCount = 14;

  for (let i = 0; i < ringCount; i += 1) {
    const t = i / (ringCount - 1);
    const center = pathAt(t);
    const previous = pathAt(Math.max(0, t - 0.01));
    const next = pathAt(Math.min(1, t + 0.01));
    const axis = normalize(sub(next, previous));

    let u = normalize(cross(axis, vec(0, 0, 1)));
    if (lengthOf(u) < 1e-6) u = vec(1, 0, 0);
    const v = normalize(cross(axis, u));

    const circumference = circumferenceAt(t);
    const { rx, rz } = solveRxForCircumference(circumference, 0.92, 2.0);

    rings.push({
      center,
      u,
      v,
      rx,
      rz,
      n: 2.0,
      circumference_cm: circumference,
      region: t >= 0.98 ? 'wrist' : t < 0.52 ? 'arm' : 'forearm',
    });
  }

  return {
    name: side < 0 ? 'left_arm' : 'right_arm',
    kind: 'arm',
    side,
    joints: { shoulder, elbow, wrist },
    rings,
  };
}

function buildNeck(profile: ResolvedBodyProfile, layout: TorsoLayout): BodyRing[] {
  const rings: BodyRing[] = [];
  const count = 5;

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = lerp(layout.neckBaseY, layout.chinY, t);
    const circumference = lerp(profile.neck_cm, profile.neck_cm * 0.92, smoothstep(t));
    rings.push(ringFromCircumference(y, circumference, 0.9, 2.0, 'neck', 0, 0.01));
  }

  return rings;
}

function buildHead(profile: ResolvedBodyProfile, layout: TorsoLayout): BodyHead {
  const headHeight = layout.headTopY - layout.chinY;
  return {
    center: vec(0, layout.chinY + headHeight / 2, 0.005 * profile.height_cm),
    rx: 0.045 * profile.height_cm,
    ry: headHeight / 2,
    rz: 0.055 * profile.height_cm,
    n: 2.2,
  };
}

function buildFoot(profile: ResolvedBodyProfile, leg: BodyLimb): BodyFoot {
  const footLength = 0.15 * profile.height_cm;
  const footWidth = 0.055 * profile.height_cm;
  const footHeight = 0.035 * profile.height_cm;

  return {
    side: leg.side,
    center: vec(
      leg.joints.ankle.x,
      footHeight / 2,
      footLength / 2 - 0.02 * profile.height_cm,
    ),
    rx: footWidth / 2,
    ry: footHeight / 2,
    rz: footLength / 2,
    n: 2.2,
  };
}

function buildHand(profile: ResolvedBodyProfile, arm: BodyLimb): BodyHand {
  const axis = normalize(sub(arm.joints.wrist, arm.joints.elbow));
  const handLength = 0.1 * profile.height_cm;

  return {
    side: arm.side,
    center: add(arm.joints.wrist, scale(axis, handLength / 2)),
    axis,
    length_cm: handLength,
    width_cm: 0.035 * profile.height_cm,
    thickness_cm: 0.018 * profile.height_cm,
  };
}

function ringAtY(rings: BodyRing[], y: number): BodyRing {
  const ring = rings.find((candidate) => Math.abs(candidate.y - y) < 1e-6);
  if (!ring) throw new Error(`No hay anillo del torso en y=${y.toFixed(2)} cm`);
  return ring;
}

function buildLandmarks(
  profile: ResolvedBodyProfile,
  layout: TorsoLayout,
  torso: BodyRing[],
): BodyLandmarks {
  const hip = ringAtY(torso, layout.hipY);
  const waist = ringAtY(torso, layout.waistY);
  const bust = ringAtY(torso, layout.bustY);
  const chest = ringAtY(torso, layout.chestY);

  return {
    height_cm: profile.height_cm,
    head_top_y_cm: layout.headTopY,
    chin_y_cm: layout.chinY,
    neck_base_y_cm: layout.neckBaseY,
    shoulder_y_cm: layout.shoulderY,
    axilla_y_cm: layout.axillaY,
    bust_y_cm: layout.bustY,
    chest_y_cm: layout.chestY,
    underbust_y_cm: layout.underbustY,
    waist_y_cm: layout.waistY,
    hip_y_cm: layout.hipY,
    crotch_y_cm: layout.crotchY,
    knee_y_cm: layout.kneeY,
    ankle_y_cm: layout.ankleY,
    shoulder_width_cm: profile.shoulder_cm,
    hip_width_cm: hip.rx * 2,
    waist_width_cm: waist.rx * 2,
    bust_width_cm: bust.rx * 2,
    chest_depth_cm: chest.rz * 2,
    arm_length_cm: profile.arm_cm,
    leg_length_cm: layout.crotchY,
    torso_length_cm: profile.torso_length_cm,
  };
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`Geometría no finita en ${label}: ${value}`);
}

function validateGeometry(
  torso: BodyRing[],
  neck: BodyRing[],
  legs: BodyLimb[],
  arms: BodyLimb[],
  head: BodyHead,
  feet: BodyFoot[],
  hands: BodyHand[],
): void {
  if (torso.length < 10) throw new Error('El torso necesita al menos 10 anillos');
  if (neck.length < 2) throw new Error('El cuello necesita al menos 2 anillos');

  for (let i = 0; i < torso.length; i += 1) {
    const ring = torso[i];
    assertFinite(ring.y, `torso[${i}].y`);
    assertFinite(ring.rx, `torso[${i}].rx`);
    assertFinite(ring.rz, `torso[${i}].rz`);
    assertFinite(ring.cz, `torso[${i}].cz`);
    assertFinite(ring.n, `torso[${i}].n`);
    assertFinite(ring.cx, `torso[${i}].cx`);

    if (ring.rx <= 0 || ring.rz <= 0) {
      throw new Error(`Anillo del torso no positivo en y=${ring.y}: rx=${ring.rx}, rz=${ring.rz}`);
    }
    if (i > 0 && ring.y <= torso[i - 1].y) {
      throw new Error(`Anillos del torso desordenados: ${torso[i - 1].y} → ${ring.y}`);
    }

    const actual = superellipsePerimeter(ring.rx, ring.rz, ring.n);
    const tolerance = Math.max(0.5, ring.circumference_cm * 0.005);
    if (Math.abs(actual - ring.circumference_cm) > tolerance) {
      throw new Error(
        `Circunferencia mal reproducida en ${ring.region} y=${ring.y.toFixed(2)}: ` +
          `objetivo ${ring.circumference_cm.toFixed(2)}, real ${actual.toFixed(2)}`,
      );
    }
  }

  for (const ring of neck) {
    assertFinite(ring.y, 'neck.y');
    assertFinite(ring.rx, 'neck.rx');
    assertFinite(ring.rz, 'neck.rz');
  }

  for (const limb of [...legs, ...arms]) {
    if (limb.rings.length < 4) throw new Error(`${limb.name} necesita al menos 4 anillos`);
    for (let i = 0; i < limb.rings.length; i += 1) {
      const ring = limb.rings[i];
      assertFinite(ring.center.x, `${limb.name}.center.x`);
      assertFinite(ring.center.y, `${limb.name}.center.y`);
      assertFinite(ring.center.z, `${limb.name}.center.z`);
      assertFinite(ring.rx, `${limb.name}.rx`);
      assertFinite(ring.rz, `${limb.name}.rz`);
      if (ring.rx <= 0 || ring.rz <= 0) {
        throw new Error(`${limb.name} tiene un anillo no positivo`);
      }
      if (i > 0 && ring.center.y >= limb.rings[i - 1].center.y) {
        throw new Error(
          `${limb.name}: anillos desordenados en Y (${limb.rings[i - 1].center.y.toFixed(2)} → ${ring.center.y.toFixed(2)})`,
        );
      }
    }
  }

  for (const value of [head.center.y, head.rx, head.ry, head.rz, head.n]) {
    assertFinite(value, 'head');
  }
  for (const foot of feet) {
    for (const value of [foot.center.y, foot.rx, foot.ry, foot.rz, foot.n]) {
      assertFinite(value, 'foot');
    }
  }
  for (const hand of hands) {
    for (const value of [hand.length_cm, hand.width_cm, hand.thickness_cm]) {
      assertFinite(value, 'hand');
    }
  }
}

/**
 * Construye la geometría completa del maniquí.
 *
 * Determinista: mismo perfil → misma geometría. No mide tiempo, no usa
 * `Math.random`, no toca red ni DOM.
 */
export function buildBody(profileInput: BodyProfile): BodyGeometry {
  const profile = resolveBodyProfile(profileInput);
  const warnings = [...profile.warnings];
  const layout = computeTorsoLayout(profile);

  if (layout.crotchY < profile.inseam_cm - 1e-6) {
    warnings.push({
      code: 'inseam_regularized',
      message: `Entrepierna ${profile.inseam_cm.toFixed(1)} cm > 55% de la altura; la geometría usa ${layout.crotchY.toFixed(1)} cm para que la cadera quede por encima del crotch.`,
      severity: 'warn',
    });
  }

  const torso = buildTorso(profile, layout, warnings);
  const legs = [buildLeg(profile, layout, -1), buildLeg(profile, layout, 1)];
  const arms = [buildArm(profile, layout, -1), buildArm(profile, layout, 1)];
  const neck = buildNeck(profile, layout);
  const head = buildHead(profile, layout);
  const feet = legs.map((leg) => buildFoot(profile, leg));
  const hands = arms.map((arm) => buildHand(profile, arm));
  const landmarks = buildLandmarks(profile, layout, torso);

  validateGeometry(torso, neck, legs, arms, head, feet, hands);

  const ringCount =
    torso.length +
    neck.length +
    legs.reduce((sum, leg) => sum + leg.rings.length, 0) +
    arms.reduce((sum, arm) => sum + arm.rings.length, 0);

  return {
    profile,
    torso,
    legs,
    arms,
    neck,
    head,
    feet,
    hands,
    landmarks,
    warnings,
    inferred: profile.inferred,
    confidence: profile.confidence,
    meta: {
      ring_count: ringCount,
      estimated_vertices: ringCount * 64 + 3 * 128,
      estimated_triangles: ringCount * 64 * 2 + 3 * 128,
    },
  };
}
