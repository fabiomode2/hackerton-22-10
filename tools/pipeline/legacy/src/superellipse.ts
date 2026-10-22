/**
 * Geometr├¡a base: secciones (superelipses) y conversi├│n circunferencia ÔåÆ radios.
 *
 * Este archivo no sabe de cuerpos ni de prendas: solo de formas.
 *
 * Unidades: cm. Ejes: Y arriba, Z frontal, X derecha.
 */

import type { Ring } from './types.ts';

export type Vec3 = { x: number; y: number; z: number };

/**
 * Una secci├│n colocada en el espacio. `ax` y `az` son unitarios y
 * perpendiculares, as├¡ que la secci├│n puede estar inclinada (mangas).
 * Para cuerpo y torso son (1,0,0) y (0,0,1).
 */
export type RingFrame = {
  center: Vec3;
  ax: Vec3;
  az: Vec3;
  rx: number;
  rz: number;
  /** exponente de la superelipse: 2 = elipse ┬À 2.4 = torso ┬À 3 = cuadrado */
  n: number;
  /** altura de referencia en cm (para UVs y heatmap) */
  y: number;
};

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** Punto de la superelipse: x = rx┬Àsgn(cos t)┬À|cos t|^(2/n), z = rz┬Àsgn(sin t)┬À|sin t|^(2/n) */
export function superellipsePoint(rx: number, rz: number, n: number, t: number): { x: number; z: number } {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const e = 2 / clamp(n, 1.2, 6);
  return {
    x: rx * Math.sign(c) * Math.pow(Math.abs(c), e),
    z: rz * Math.sign(s) * Math.pow(Math.abs(s), e),
  };
}

/** Anillo horizontal ÔåÆ secci├│n en el espacio. */
export function frameFromRing(ring: Ring, offsetX = 0): RingFrame {
  return {
    center: { x: offsetX, y: ring.y, z: ring.cz },
    ax: { x: 1, y: 0, z: 0 },
    az: { x: 0, y: 0, z: 1 },
    rx: ring.rx,
    rz: ring.rz,
    n: ring.n,
    y: ring.y,
  };
}

/** Inversa de `frameFromRing`. Solo v├ílida si la secci├│n es horizontal. */
export function ringFromFrame(frame: RingFrame): Ring {
  return { y: frame.y, rx: frame.rx, rz: frame.rz, cz: frame.center.z, n: frame.n };
}

const perimeterCache = new Map<string, number>();

/**
 * Per├¡metro de la superelipse con rx = 1 y rz = k.
 * Se cachea porque cuerpo y prenda lo recalculan en cada slider.
 */
export function unitPerimeter(k: number, n: number, samples = 256): number {
  const key = `${k.toFixed(4)}|${n.toFixed(4)}|${samples}`;
  const hit = perimeterCache.get(key);
  if (hit !== undefined) return hit;

  let total = 0;
  let prev = superellipsePoint(1, k, n, 0);
  for (let i = 1; i <= samples; i++) {
    const p = superellipsePoint(1, k, n, (i / samples) * TAU);
    total += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
  }
  perimeterCache.set(key, total);
  return total;
}

/**
 * Radios para una circunferencia dada manteniendo la relaci├│n de aspecto k.
 *
 * A diferencia de `r = C / 2¤Ç`, esto respeta el per├¡metro real de la secci├│n:
 * con k = 0.72 y n = 2.4 el frente queda ~12% m├ís ancho, que es lo que se ve
 * en una foto de frente.
 */
export function radiiFromCircumference(
  circumference_cm: number,
  k: number,
  n: number,
): { rx: number; rz: number } {
  const rx = circumference_cm / Math.max(unitPerimeter(k, n), 1e-6);
  return { rx, rz: rx * k };
}

/** Per├¡metro de un anillo horizontal ya construido. */
export function ringPerimeter(ring: Ring): number {
  const k = ring.rz / Math.max(ring.rx, 1e-6);
  return ring.rx * unitPerimeter(k, ring.n);
}

/**
 * Puntos de una secci├│n. Con `closed` no repite el primer punto al final;
 * con `closed = false` devuelve `segments + 1` puntos (arco abierto).
 */
export function sampleFrame(
  frame: RingFrame,
  segments: number,
  t0 = 0,
  t1 = TAU,
  closed = true,
): Vec3[] {
  const count = closed ? segments : segments + 1;
  const span = t1 - t0;
  const out: Vec3[] = new Array(count);
  for (let j = 0; j < count; j++) {
    const t = t0 + (span * j) / segments;
    const p = superellipsePoint(frame.rx, frame.rz, frame.n, t);
    out[j] = {
      x: frame.center.x + frame.ax.x * p.x + frame.az.x * p.z,
      y: frame.center.y + frame.ax.y * p.x + frame.az.y * p.z,
      z: frame.center.z + frame.ax.z * p.x + frame.az.z * p.z,
    };
  }
  return out;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-9) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Secciones a lo largo de una curva (mangas, tirantes).
 * Los radios son circulares: la secci├│n se orienta perpendicular a la tangente.
 */
export function tubeFrames(points: Vec3[], radii: number[], n = 2.1): RingFrame[] {
  const frames: RingFrame[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = normalize(sub(next, prev));
    // Si la tangente es casi vertical, el "arriba" no puede ser Z.
    const up: Vec3 = Math.abs(tangent.z) > 0.95 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    const ax = normalize(cross(up, tangent));
    const az = normalize(cross(tangent, ax));
    frames.push({
      center: points[i],
      ax,
      az,
      rx: radii[i],
      rz: radii[i],
      n,
      y: points[i].y,
    });
  }
  return frames;
}

/** Puntos de una curva de B├®zier cuadr├ítica (para tirantes y ribetes). */
export function quadraticPath(a: Vec3, control: Vec3, b: Vec3, steps: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    out.push({
      x: it * it * a.x + 2 * it * t * control.x + t * t * b.x,
      y: it * it * a.y + 2 * it * t * control.y + t * t * b.y,
      z: it * it * a.z + 2 * it * t * control.z + t * t * b.z,
    });
  }
  return out;
}
