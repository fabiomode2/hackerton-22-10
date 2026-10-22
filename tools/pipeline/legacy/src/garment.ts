/**
 * MODELO 3D DE LA PRENDA — medidas del listing → geometría.
 *
 * Idea central: no se modela la prenda, se parametriza. Hay TRES primitivas
 * y seis tipos de prenda:
 *
 *   A. torso + 2 mangas   → tshirt, hoodie, jacket
 *   B. tubo / cono        → dress, skirt
 *   C. pelvis + 2 piernas → jeans
 *
 * La foto NO entra aquí: la geometría sale de las medidas. La foto solo
 * aporta color/estampado (ver `texture-plan.ts`).
 *
 * Este archivo NO construye el maniquí: eso es de `body.ts` (Manu). Solo
 * necesita saber a qué altura están hombro, cintura y cadera, y eso lo
 * deriva de la altura con ratios antropométricos. Si el cuerpo usa otros
 * anclajes, se pasan por `GarmentAnchors`.
 *
 * Unidades: cm. La malla final se convierte a metros en `mesh.ts`.
 */

import type { Body, Fabric, FitZone, Garment, GarmentMeasurements, GarmentType } from './types.ts';
import {
  TAU,
  clamp,
  isPositiveNumber,
  lerp,
  quadraticPath,
  radiiFromCircumference,
  tubeFrames,
  unitPerimeter,
  type RingFrame,
  type Vec3,
} from './superellipse.ts';
import { REQUIRED_MEASUREMENTS, isReliable, validateGarment, type Issue } from './validate.ts';

export type GarmentPanel = {
  name: string;
  zone: FitZone['name'];
  frames: RingFrame[];
  /** true = sección cerrada (tubo) · false = abierta (chaqueta) */
  closed: boolean;
  /** arco de la sección; por defecto [0, 2π) */
  theta?: [number, number];
  capStart?: boolean;
  capEnd?: boolean;
  /** amplitud de las arrugas procedurales, en cm (0 = superficie lisa) */
  folds?: number;
};

export type GarmentCircumferences = {
  chest?: number;
  waist?: number;
  hips?: number;
  thigh?: number;
  hem?: number;
};

/**
 * Alturas de referencia en cm. Se derivan de la altura y la entrepierna.
 * Si el módulo del cuerpo (Manu) usa otros anclajes, pásalos aquí para que
 * la prenda y el maniquí coincidan exactamente.
 */
export type GarmentAnchors = {
  ankleY: number;
  kneeY: number;
  crotchY: number;
  hipY: number;
  waistY: number;
  underbustY: number;
  chestY: number;
  armpitY: number;
  shoulderY: number;
  neckY: number;
};

export type GarmentModel = {
  type: GarmentType;
  fabric: Fabric;
  panels: GarmentPanel[];
  /** contornos reales usados para construir la geometría (cm) */
  circumferences: GarmentCircumferences;
  /** holgura por zona: contorno_prenda − contorno_cuerpo − 2π·grosor */
  ease: Partial<Record<FitZone['name'], number>>;
  thickness_cm: number;
  missing: string[];
  issues: Issue[];
  /** false = hay errores de medida; la geometría es un fallback, no una promesa */
  reliable: boolean;
};

/** Grosor y rigidez por tejido. El grosor entra en la fórmula de holgura. */
export const FABRIC_SPEC: Record<Fabric, { thickness_cm: number; stiffness: number }> = {
  cotton_jersey: { thickness_cm: 0.05, stiffness: 0.2 },
  fleece: { thickness_cm: 0.3, stiffness: 0.6 },
  denim: { thickness_cm: 0.1, stiffness: 0.9 },
  knit: { thickness_cm: 0.2, stiffness: 0.35 },
  linen: { thickness_cm: 0.05, stiffness: 0.25 },
  leather: { thickness_cm: 0.15, stiffness: 0.95 },
};

/** Holgura por defecto = punto medio de la banda ideal de `EASE_BANDS`. */
export function defaultEase(type: GarmentType): number {
  switch (type) {
    case 'tshirt':
      return 6.5;
    case 'hoodie':
      return 12;
    case 'dress':
      return 7;
    case 'jacket':
      return 15;
    case 'jeans':
      return 4;
    case 'skirt':
      return 7;
  }
}

const DEFAULT_LENGTH: Record<GarmentType, number> = {
  tshirt: 68,
  hoodie: 68,
  dress: 95,
  jacket: 62,
  jeans: 80,
  skirt: 65,
};

const DEFAULT_SLEEVE: Record<GarmentType, number> = {
  tshirt: 20,
  hoodie: 60,
  dress: 0,
  jacket: 58,
  jeans: 0,
  skirt: 0,
};

const TOP_TYPES: GarmentType[] = ['tshirt', 'hoodie', 'jacket'];

/** Medida plana (prenda estirada) → contorno. El vendedor casi siempre da plano. */
export function flatToGirth(flat_cm: number | undefined): number | undefined {
  return isPositiveNumber(flat_cm) ? flat_cm * 2 : undefined;
}

function plausiblePitToPit(flat_cm: number | undefined): number | undefined {
  const girth = flatToGirth(flat_cm);
  // Regla de vinted-data.md: fuera de [60, 160] es error de dedo o talla infantil.
  if (girth === undefined || girth < 60 || girth > 160) return undefined;
  return girth;
}

/** Sanea las medidas del cuerpo sin tocar el contrato. */
export function normalizeBody(input: Body): Body {
  const height = clamp(isPositiveNumber(input.height_cm) ? input.height_cm : 175, 140, 220);
  let waist = clamp(isPositiveNumber(input.waist_cm) ? input.waist_cm : 78, 40, 180);
  const hips = clamp(isPositiveNumber(input.hips_cm) ? input.hips_cm : 96, 55, 200);
  const bust = clamp(isPositiveNumber(input.bust_cm) ? input.bust_cm : 92, 50, 180);
  if (waist > hips) waist = hips * 0.99;
  const inseam = clamp(
    isPositiveNumber(input.inseam_cm) ? input.inseam_cm : Math.round(0.47 * height),
    0.36 * height,
    0.58 * height,
  );
  return {
    height_cm: height,
    bust_cm: bust,
    waist_cm: waist,
    hips_cm: hips,
    shoulder_cm: clamp(isPositiveNumber(input.shoulder_cm) ? input.shoulder_cm : 44, 28, 70),
    inseam_cm: inseam,
    arm_cm: input.arm_cm,
  };
}

/** Alturas de referencia derivadas de la altura y la entrepierna. */
export function defaultAnchors(input: Body): GarmentAnchors {
  const body = normalizeBody(input);
  const H = body.height_cm;
  return {
    ankleY: 0.04 * H,
    kneeY: 0.285 * H,
    crotchY: body.inseam_cm,
    hipY: clamp(body.inseam_cm * 1.1, 0.47 * H, 0.56 * H),
    waistY: 0.615 * H,
    underbustY: 0.675 * H,
    chestY: 0.72 * H,
    armpitY: 0.755 * H,
    shoulderY: 0.82 * H,
    neckY: 0.855 * H,
  };
}

/**
 * Contornos de la prenda. Es la ÚNICA fuente de verdad: `fit.ts` debe usar
 * esta función para calcular la holgura, de modo que el número y la geometría
 * nunca se contradigan.
 */
export function garmentCircumferences(garment: Garment, bodyInput: Body): GarmentCircumferences {
  const m = garment.measurements;
  const body = normalizeBody(bodyInput);
  const d = defaultEase(garment.type);

  switch (garment.type) {
    case 'jeans': {
      const waist = flatToGirth(m.waist_cm) ?? body.waist_cm + d;
      const hips = flatToGirth(m.hips_cm) ?? waist * 1.18;
      const thigh = flatToGirth(m.thigh_cm) ?? hips * 0.62;
      const hem = flatToGirth(m.hem_cm) ?? thigh * 0.62;
      return { waist, hips, thigh, hem };
    }
    case 'skirt': {
      const waist = flatToGirth(m.waist_cm) ?? body.waist_cm + d;
      const hips = flatToGirth(m.hips_cm) ?? waist * 1.25;
      const hem = flatToGirth(m.hem_cm) ?? hips * 1.15;
      return { waist, hips, hem };
    }
    case 'dress': {
      const chest = plausiblePitToPit(m.pit_to_pit_cm) ?? body.bust_cm + d;
      const waist = flatToGirth(m.waist_cm) ?? chest;
      const hips = flatToGirth(m.hips_cm) ?? Math.max(waist, chest) * 1.05;
      const hem = flatToGirth(m.hem_cm) ?? hips * 1.25;
      return { chest, waist, hips, hem };
    }
    default: {
      const chest = plausiblePitToPit(m.pit_to_pit_cm) ?? body.bust_cm + d;
      // Sin medida de cintura, una camiseta NO se ciñe: baja recta desde el pecho.
      const waist = flatToGirth(m.waist_cm) ?? chest - 2;
      const hips = flatToGirth(m.hips_cm) ?? chest + 2;
      return { chest, waist, hips, hem: hips };
    }
  }
}

function easeAt(garmentGirth: number, bodyGirth: number, thickness_cm: number): number {
  return garmentGirth - bodyGirth - TAU * thickness_cm;
}

/**
 * Contorno aproximado del torso a una altura. Solo se usa para el clamp
 * visual: el veredicto siempre compara contra las medidas declaradas.
 */
function bodyGirthAt(body: Body, anchors: GarmentAnchors, y: number): number {
  const points = [
    { y: anchors.crotchY, C: body.hips_cm },
    { y: anchors.hipY, C: body.hips_cm },
    { y: anchors.waistY, C: body.waist_cm },
    { y: anchors.chestY, C: body.bust_cm },
    { y: anchors.armpitY, C: body.bust_cm + 1.5 },
  ];
  if (y <= points[0].y) return points[0].C;
  const last = points[points.length - 1];
  if (y >= last.y) return last.C;
  for (let i = 1; i < points.length; i++) {
    if (y <= points[i].y) {
      const t = (y - points[i - 1].y) / Math.max(points[i].y - points[i - 1].y, 1e-6);
      return lerp(points[i - 1].C, points[i].C, t);
    }
  }
  return last.C;
}

type Anchor = { y: number; C: number; k: number; n: number };

/**
 * Evita que la prenda atraviese el cuerpo cuando la holgura es negativa.
 * OJO: esto es solo visual. El veredicto y el heatmap usan la holgura real.
 */
function visualClamp(C: number, y: number, body: Body, anchors: GarmentAnchors): number {
  // Por debajo de la cadera no hay torso que clavar; por encima de la axila
  // manda la silueta (hombro y cuello), no el contorno del pecho.
  if (y < anchors.hipY - 1 || y > anchors.armpitY + 0.5) return C;
  return Math.max(C, bodyGirthAt(body, anchors, y) + 0.4);
}

function anchorsToFrames(list: Anchor[], body: Body, anchors: GarmentAnchors): RingFrame[] {
  const sorted = list
    .filter((a) => Number.isFinite(a.y) && Number.isFinite(a.C) && a.C > 0)
    .sort((a, b) => a.y - b.y);

  const deduped: Anchor[] = [];
  for (const a of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.y - a.y) < 0.75) {
      deduped[deduped.length - 1] = a; // gana el ancla superior
    } else {
      deduped.push(a);
    }
  }

  return deduped.map((a) => {
    const C = visualClamp(a.C, a.y, body, anchors);
    const { rx, rz } = radiiFromCircumference(C, a.k, a.n);
    return {
      center: { x: 0, y: a.y, z: 0 },
      ax: { x: 1, y: 0, z: 0 },
      az: { x: 0, y: 0, z: 1 },
      rx,
      rz,
      n: a.n,
      y: a.y,
    };
  });
}

function buildSleeves(
  garment: Garment,
  body: Body,
  anchors: GarmentAnchors,
  type: GarmentType,
  shoulderWidth: number,
): GarmentPanel[] {
  const length = garment.measurements.sleeve_cm ?? DEFAULT_SLEEVE[type];
  if (!isPositiveNumber(length) || length < 8) return [];

  const long = length > 35;
  const armGirth = body.bust_cm * 0.36;
  const easeGirth = type === 'tshirt' ? 6 : type === 'hoodie' ? 12 : 8;
  const startR = (armGirth + easeGirth) / TAU;
  // Una manga corta se abre en el puño; una larga se cierra en la muñeca.
  const endR = long ? (body.bust_cm * 0.17 + 2) / TAU : startR * 1.16;

  const panels: GarmentPanel[] = [];
  for (const side of [-1, 1] as const) {
    // Curva: arranca dentro del hombro, sale y cae. Con un tubo recto parece
    // un tubo de fontanería, no una manga.
    const p0: Vec3 = { x: side * 0.34 * shoulderWidth, y: anchors.shoulderY - 4, z: 0 };
    const p1: Vec3 = {
      x: side * (long ? 0.47 : 0.52) * shoulderWidth,
      y: anchors.shoulderY - 4 - length * (long ? 0.35 : 0.45),
      z: 0,
    };
    const p2: Vec3 = {
      x: side * (long ? 0.44 : 0.55) * shoulderWidth,
      y: anchors.shoulderY - 4 - length,
      z: 0,
    };
    const points = quadraticPath(p0, p1, p2, 5);
    const radii = points.map((_, i) => lerp(startR, endR, i / (points.length - 1)));

    panels.push({
      name: side < 0 ? 'sleeve.L' : 'sleeve.R',
      zone: 'bust',
      frames: tubeFrames(points, radii, 2.15),
      closed: true,
      capStart: true,
      capEnd: false,
      folds: 0.3,
    });
  }
  return panels;
}

function buildTopPanels(
  garment: Garment,
  body: Body,
  anchors: GarmentAnchors,
  girths: GarmentCircumferences,
): GarmentPanel[] {
  const m = garment.measurements;
  const type = garment.type;

  const chest = girths.chest ?? body.bust_cm;
  const waist = girths.waist ?? chest - 2;
  const hips = girths.hips ?? chest + 2;

  const length = m.length_cm ?? DEFAULT_LENGTH[type];
  const hemY = clamp(anchors.shoulderY - length, 25, anchors.armpitY - 4);

  const shoulderWidth = m.shoulder_cm ?? body.shoulder_cm + 2;
  const neckGirth = 0.22 * body.height_cm + (type === 'hoodie' ? 4 : type === 'jacket' ? 3 : 2.5);

  const hemGirth = type === 'hoodie' ? hips - 4 : hips + 2;

  const chestRx = radiiFromCircumference(chest, 0.7, 2.3).rx;
  const armpitRx = radiiFromCircumference(chest + 1, 0.69, 2.35).rx;
  const shoulderRx = 0.47 * shoulderWidth;
  const shoulderRz = 0.55 * shoulderRx;
  const neckR = radiiFromCircumference(neckGirth, 0.92, 2.0);
  const neckRise = 5.2;

  const lower: Anchor[] = [
    { y: hemY, C: hemGirth, k: 0.74, n: 2.4 },
    { y: anchors.hipY, C: hips, k: 0.76, n: 2.45 },
    { y: anchors.waistY, C: waist, k: 0.73, n: 2.4 },
    { y: anchors.underbustY, C: lerp(waist, chest, 0.5), k: 0.71, n: 2.35 },
    { y: anchors.chestY, C: chest, k: 0.7, n: 2.3 },
    { y: anchors.armpitY, C: chest + 1, k: 0.69, n: 2.35 },
  ].filter((a) => a.y >= hemY - 0.5);

  const midRx = lerp(armpitRx, shoulderRx, 0.55);
  lower.push({
    y: lerp(anchors.armpitY, anchors.shoulderY, 0.55),
    C: midRx * unitPerimeter(0.58, 2.5),
    k: 0.58,
    n: 2.5,
  });

  const frames = anchorsToFrames(lower, body, anchors);

  // Hombro → cuello: perfil suave. El truco es que el clamp visual no se aplica
  // aquí; si no, el cuello se cierra al contorno del pecho y sale una tapa plana.
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ease = t * t * (3 - 2 * t);
    const rx = lerp(shoulderRx, neckR.rx, Math.pow(t, 1.45));
    const rz = lerp(shoulderRz, neckR.rz, Math.pow(t, 1.25));
    const y = anchors.shoulderY + neckRise * ease;
    frames.push({
      center: { x: 0, y, z: 0 },
      ax: { x: 1, y: 0, z: 0 },
      az: { x: 0, y: 0, z: 1 },
      rx,
      rz,
      n: 2.35,
      y,
    });
  }

  // Cuello de canalé: banda corta sobre la abertura.
  const top = frames[frames.length - 1];
  const collar: RingFrame[] = [
    { ...top, rx: top.rx * 1.05, rz: top.rz * 1.05 },
    {
      ...top,
      center: { x: 0, y: top.y + 1.5, z: 0 },
      y: top.y + 1.5,
      rx: top.rx * 1.01,
      rz: top.rz * 1.01,
    },
  ];

  // Una chaqueta abierta: arco con hueco frontal de ~10 cm.
  const openFront = type === 'jacket';
  let theta: [number, number] | undefined;
  if (openFront) {
    const gap = clamp(5 / Math.max(chestRx, 10), 0.1, 0.35);
    theta = [Math.PI / 2 + gap / 2, Math.PI / 2 + TAU - gap / 2];
  }

  const panels: GarmentPanel[] = [
    {
      name: 'torso',
      zone: 'bust',
      frames,
      closed: !openFront,
      theta,
      capStart: false,
      capEnd: false,
      folds: 0.45,
    },
    {
      name: 'collar',
      zone: 'shoulder',
      frames: collar,
      closed: !openFront,
      theta: openFront ? theta : undefined,
      capStart: false,
      capEnd: false,
    },
  ];

  // Bajo de la chaqueta: banda que remata el corte y evita el borde de papel.
  if (type === 'jacket') {
    const hem = frames[0];
    const band: RingFrame[] = [
      { ...hem, rx: hem.rx * 1.015, rz: hem.rz * 1.015 },
      {
        ...hem,
        center: { x: 0, y: hem.y + 3.5, z: 0 },
        y: hem.y + 3.5,
        rx: hem.rx * 1.0,
        rz: hem.rz * 1.0,
      },
    ];
    panels.push({
      name: 'hem',
      zone: 'hips',
      frames: band,
      closed: !openFront,
      theta: openFront ? theta : undefined,
      capStart: false,
      capEnd: false,
    });
  }

  panels.push(...buildSleeves(garment, body, anchors, type, shoulderWidth));
  return panels;
}

function buildDressPanels(
  garment: Garment,
  body: Body,
  anchors: GarmentAnchors,
  girths: GarmentCircumferences,
): GarmentPanel[] {
  const m = garment.measurements;

  const chest = girths.chest ?? body.bust_cm;
  const waist = girths.waist ?? chest;
  const hips = girths.hips ?? Math.max(waist, chest) * 1.05;
  const hem = girths.hem ?? hips * 1.25;

  const length = m.length_cm ?? DEFAULT_LENGTH.dress;
  const hemY = clamp(anchors.shoulderY - length, 20, anchors.waistY - 8);

  const list: Anchor[] = [
    { y: hemY, C: hem, k: 0.82, n: 2.35 },
    { y: anchors.hipY, C: hips, k: 0.78, n: 2.4 },
    { y: anchors.waistY, C: waist, k: 0.74, n: 2.4 },
    { y: anchors.chestY, C: chest, k: 0.7, n: 2.3 },
    { y: anchors.armpitY, C: chest + 1, k: 0.69, n: 2.35 },
  ];

  const frames = anchorsToFrames(list, body, anchors);
  const panels: GarmentPanel[] = [
    { name: 'torso', zone: 'bust', frames, closed: true, capStart: false, capEnd: false },
  ];

  // Tirantes finos: sin ellos, un vestido lencero parece un tubo sin sentido.
  const top = frames[frames.length - 1];
  const chestRx = radiiFromCircumference(chest, 0.7, 2.3).rx;
  for (const side of [-1, 1] as const) {
    const x = side * chestRx * 0.35;
    const path = quadraticPath(
      { x, y: top.y + 1, z: top.rz * 0.8 },
      { x, y: anchors.shoulderY + 1.5, z: 0 },
      { x, y: top.y + 1, z: -top.rz * 0.8 },
      6,
    );
    panels.push({
      name: side < 0 ? 'strap.L' : 'strap.R',
      zone: 'shoulder',
      frames: tubeFrames(path, path.map(() => 0.45), 2.0),
      closed: true,
    });
  }

  return panels;
}

function buildSkirtPanels(
  garment: Garment,
  body: Body,
  anchors: GarmentAnchors,
  girths: GarmentCircumferences,
): GarmentPanel[] {
  const m = garment.measurements;

  const waist = girths.waist ?? body.waist_cm + 7;
  const hem = girths.hem ?? waist * 1.35;
  const length = m.length_cm ?? DEFAULT_LENGTH.skirt;
  const hemY = clamp(anchors.waistY - length, 10, anchors.waistY - 15);

  const list: Anchor[] = [];
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    list.push({
      y: lerp(hemY, anchors.waistY, t),
      C: lerp(hem, waist, t),
      k: 0.78,
      n: 2.4,
    });
  }

  return [
    {
      name: 'skirt',
      zone: 'hips',
      frames: anchorsToFrames(list, body, anchors),
      closed: true,
      capStart: false,
      capEnd: false,
    },
  ];
}

function buildJeansPanels(
  garment: Garment,
  body: Body,
  anchors: GarmentAnchors,
  girths: GarmentCircumferences,
): GarmentPanel[] {
  const m = garment.measurements;

  const waist = girths.waist ?? body.waist_cm + 4;
  const hips = girths.hips ?? waist * 1.18;
  const thigh = girths.thigh ?? hips * 0.62;
  const hem = girths.hem ?? thigh * 0.62;

  const rise = m.rise_cm ?? 28;
  const waistbandY = clamp(anchors.crotchY + rise, anchors.waistY - 10, anchors.waistY + 12);
  const inseam = m.inseam_cm ?? body.inseam_cm;
  const hemY = Math.max(4, anchors.crotchY - inseam);

  // Pelvis: cinturilla → entrepierna. Baja 3 cm por debajo del tiro para que
  // las perneras nazcan dentro y no se vea el corte horizontal.
  const pelvis: Anchor[] = [
    { y: anchors.crotchY - 3, C: hips * 0.94, k: 0.82, n: 2.45 },
    { y: anchors.crotchY + 2, C: hips * 0.99, k: 0.82, n: 2.45 },
    { y: anchors.hipY, C: hips, k: 0.8, n: 2.45 },
    { y: waistbandY, C: waist, k: 0.78, n: 2.45 },
  ];

  // Separación entre perneras: media anchura de cadera. Si se separan más,
  // las piernas sobresalen del pelvis y aparece un escalón en la entrepierna.
  const hipRx = radiiFromCircumference(hips, 0.8, 2.45).rx;
  const legOffsetX = Math.max(hipRx * 0.44, 5.5);

  const legPanels: GarmentPanel[] = [];
  for (const side of [-1, 1] as const) {
    const frames: RingFrame[] = [];
    const steps = 7;
    const topY = anchors.crotchY + 6;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const y = lerp(topY, hemY, t);
      const C = lerp(thigh * 0.94, hem, Math.pow(t, 0.85));
      const { rx, rz } = radiiFromCircumference(C, 0.95, 2.1);
      frames.push({
        center: { x: side * legOffsetX, y, z: 0 },
        ax: { x: 1, y: 0, z: 0 },
        az: { x: 0, y: 0, z: 1 },
        rx,
        rz,
        n: 2.1,
        y,
      });
    }
    legPanels.push({
      name: side < 0 ? 'leg.L' : 'leg.R',
      zone: 'thigh',
      frames,
      closed: true,
      capStart: false,
      capEnd: false,
      folds: 0.3,
    });
  }

  const pelvisFrames = anchorsToFrames(pelvis, body, anchors);
  const top = pelvisFrames[pelvisFrames.length - 1];
  const waistbandFrames: RingFrame[] = [
    { ...top, rx: top.rx * 1.03, rz: top.rz * 1.03 },
    {
      ...top,
      center: { x: 0, y: top.y + 4, z: 0 },
      y: top.y + 4,
      rx: top.rx * 0.99,
      rz: top.rz * 0.99,
    },
  ];

  return [
    {
      name: 'pelvis',
      zone: 'hips',
      frames: pelvisFrames,
      closed: true,
      capStart: false,
      capEnd: false,
      folds: 0.15,
    },
    {
      name: 'waistband',
      zone: 'waist',
      frames: waistbandFrames,
      closed: true,
      capStart: false,
      capEnd: false,
    },
    ...legPanels,
  ];
}

/**
 * Construye la prenda. Nunca lanza: si faltan medidas devuelve un fallback
 * plausible con `reliable: false`, para que la UI pueda enseñar la advertencia.
 *
 * @param anchors opcional: si el maniquí usa otras alturas, pásalas aquí.
 */
export function buildGarment(
  garment: Garment,
  bodyInput: Body,
  anchors: GarmentAnchors = defaultAnchors(bodyInput),
): GarmentModel {
  const body = normalizeBody(bodyInput);
  const issues = validateGarment(garment);
  const girths = garmentCircumferences(garment, body);
  const spec = FABRIC_SPEC[garment.fabric] ?? FABRIC_SPEC.cotton_jersey;

  // Coherencia vertical del vaquero: tiro + entrepierna no pueden superar el cuerpo.
  if (garment.type === 'jeans') {
    const rise = garment.measurements.rise_cm ?? 28;
    const inseam = garment.measurements.inseam_cm ?? body.inseam_cm;
    if (rise + inseam > 0.66 * body.height_cm) {
      issues.push({
        level: 'warning',
        code: 'garment.jeans_proportions',
        field: 'inseam_cm',
        message: `tiro + entrepierna = ${(rise + inseam).toFixed(0)} cm para ${body.height_cm} cm de altura; revisa las medidas`,
      });
    }
  }

  let panels: GarmentPanel[];
  if (TOP_TYPES.includes(garment.type)) {
    panels = buildTopPanels(garment, body, anchors, girths);
  } else if (garment.type === 'dress') {
    panels = buildDressPanels(garment, body, anchors, girths);
  } else if (garment.type === 'skirt') {
    panels = buildSkirtPanels(garment, body, anchors, girths);
  } else {
    panels = buildJeansPanels(garment, body, anchors, girths);
  }

  const ease: GarmentModel['ease'] = {};
  if (girths.chest !== undefined) {
    ease.bust = easeAt(girths.chest, body.bust_cm, spec.thickness_cm);
  }
  if (girths.waist !== undefined) {
    ease.waist = easeAt(girths.waist, body.waist_cm, spec.thickness_cm);
  }
  if (girths.hips !== undefined) {
    ease.hips = easeAt(girths.hips, body.hips_cm, spec.thickness_cm);
  }
  if (girths.thigh !== undefined) {
    // El muslo del cuerpo se estima igual que en body.ts (0.60 × cadera).
    ease.thigh = easeAt(girths.thigh, body.hips_cm * 0.6, spec.thickness_cm);
  }

  const required = REQUIRED_MEASUREMENTS[garment.type] ?? [];
  const missing = required.filter((key: keyof GarmentMeasurements) => {
    const v = garment.measurements[key];
    return !isPositiveNumber(v);
  }) as string[];

  return {
    type: garment.type,
    fabric: garment.fabric,
    panels,
    circumferences: girths,
    ease,
    thickness_cm: spec.thickness_cm,
    missing,
    issues,
    reliable: isReliable(issues),
  };
}
