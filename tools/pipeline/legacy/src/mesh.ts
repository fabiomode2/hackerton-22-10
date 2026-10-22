/**
 * De anillos a malla: triangulaci├│n, normales, UVs y metadatos para el heatmap.
 *
 * Salida pensada para Three.js:
 *   - `positions` en METROS (la escena trabaja en metros; los datos en cm)
 *   - `indices` Uint32 (WebGL2 lo soporta; evita el l├¡mite de 65k)
 *   - `ringIndex[i]` = anillo de origen del v├®rtice i ÔåÆ el viewer colorea por
 *     tensi├│n sin tener que rehacer el mapeo.
 *   - `groups` = por panel, con rangos de v├®rtices/├¡ndices y de anillos.
 */

import type { Vec3 } from './superellipse.ts';
import { TAU, sampleFrame } from './superellipse.ts';
import type { GarmentModel, GarmentPanel } from './garment.ts';

export type MeshGroup = {
  name: string;
  zone: string;
  vertexStart: number;
  vertexCount: number;
  indexStart: number;
  indexCount: number;
  ringStart: number;
  ringCount: number;
};

export type BuiltMesh = {
  /** metros */
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** anillo de origen de cada v├®rtice */
  ringIndex: Uint16Array;
  groups: MeshGroup[];
};

export const EMPTY_MESH: BuiltMesh = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  uvs: new Float32Array(0),
  indices: new Uint32Array(0),
  ringIndex: new Uint16Array(0),
  groups: [],
};

const CM_TO_M = 0.01;

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Construye la malla de un panel.
 * `segments` = puntos por anillo. 48 es suficiente para que no se vea facetado.
 */
export function buildPanelMesh(panel: GarmentPanel, segments = 48): BuiltMesh {
  const rings = panel.frames;
  if (rings.length < 2) return { ...EMPTY_MESH };

  const S = Math.max(8, Math.floor(segments));
  const cols = panel.closed ? S : S + 1;
  const [t0, t1] = panel.theta ?? [0, TAU];

  const positions: number[] = [];
  const uvs: number[] = [];
  const ringIndex: number[] = [];
  const indices: number[] = [];

  // v = longitud recorrida a lo largo del panel, normalizada.
  const cumulative: number[] = [0];
  for (let i = 1; i < rings.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(rings[i - 1].center, rings[i].center));
  }
  const totalLength = Math.max(cumulative[cumulative.length - 1], 1e-6);

  for (let i = 0; i < rings.length; i++) {
    const points = sampleFrame(rings[i], S, t0, t1, panel.closed);
    const t = rings.length > 1 ? i / (rings.length - 1) : 0;
    // Arrugas procedurales: se apagan en los bordes para no romper el bajo
    // ni el cuello. Amplitud en cm, radial (no cambia la silueta).
    const foldEnvelope = panel.folds ? Math.sin(Math.PI * t) * panel.folds : 0;
    for (let j = 0; j < cols; j++) {
      const p = points[j];
      let px = p.x;
      let py = p.y;
      let pz = p.z;

      if (foldEnvelope !== 0) {
        const theta = t0 + ((t1 - t0) * j) / S;
        const wave =
          Math.sin(theta * 4 + t * 5.2 + 0.7) * 0.55 +
          Math.sin(theta * 7 - t * 3.1 + 1.3) * 0.45 -
          // costura lateral: una hendidura fina en ╬© = 0 y ╬© = ¤Ç
          0.9 * Math.pow(Math.abs(Math.cos(theta)), 12);
        const dx = p.x - rings[i].center.x;
        const dy = p.y - rings[i].center.y;
        const dz = p.z - rings[i].center.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        const k = (foldEnvelope * wave) / len;
        px += dx * k;
        py += dy * k;
        pz += dz * k;
      }

      positions.push(px * CM_TO_M, py * CM_TO_M, pz * CM_TO_M);
      uvs.push(j / S, cumulative[i] / totalLength);
      ringIndex.push(i);
    }
  }

  // Caras entre anillos consecutivos.
  for (let i = 0; i < rings.length - 1; i++) {
    const lastJ = panel.closed ? cols : cols - 1;
    for (let j = 0; j < lastJ; j++) {
      const j2 = panel.closed ? (j + 1) % cols : j + 1;
      const a = i * cols + j;
      const b = i * cols + j2;
      const c = (i + 1) * cols + j2;
      const d = (i + 1) * cols + j;
      // Orden (a, c, b) ÔåÆ normal hacia fuera.
      indices.push(a, c, b, a, d, c);
    }
  }

  // Tapas (solo paneles cerrados). El bajo de una camiseta y la base de un
  // maniqu├¡ se ven desde abajo: sin tapa parece un tubo hueco.
  const addCap = (ring: number, flip: boolean) => {
    const base = positions.length / 3;
    const f = rings[ring];
    positions.push(f.center.x * CM_TO_M, f.center.y * CM_TO_M, f.center.z * CM_TO_M);
    uvs.push(0.5, ring === 0 ? 0 : 1);
    ringIndex.push(ring);

    for (let j = 0; j < S; j++) {
      const j2 = (j + 1) % S;
      const a = ring * cols + j;
      const b = ring * cols + j2;
      if (flip) indices.push(base, b, a);
      else indices.push(base, a, b);
    }
  };

  if (panel.capStart && panel.closed) addCap(0, true);
  if (panel.capEnd && panel.closed) addCap(rings.length - 1, false);

  let normals = computeNormals(positions, indices);

  // Orientaci├│n: las mangas y las perneras se apilan hacia abajo, as├¡ que el
  // orden de las caras se invierte. Se detecta comparando la normal con el
  // vector radial de cada v├®rtice y se corrige una sola vez.
  let orientation = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    const center = rings[ringIndex[i]].center;
    const rx = positions[i * 3] - center.x * CM_TO_M;
    const ry = positions[i * 3 + 1] - center.y * CM_TO_M;
    const rz = positions[i * 3 + 2] - center.z * CM_TO_M;
    orientation += rx * normals[i * 3] + ry * normals[i * 3 + 1] + rz * normals[i * 3 + 2];
  }
  if (orientation < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = tmp;
    }
    normals = computeNormals(positions, indices);
  }

  return {
    positions: new Float32Array(positions),
    normals,
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    ringIndex: new Uint16Array(ringIndex),
    groups: [
      {
        name: panel.name,
        zone: panel.zone,
        vertexStart: 0,
        vertexCount: positions.length / 3,
        indexStart: 0,
        indexCount: indices.length,
        ringStart: 0,
        ringCount: rings.length,
      },
    ],
  };
}

function computeNormals(positions: number[], indices: number[]): Float32Array {
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    const abx = positions[ib] - positions[ia];
    const aby = positions[ib + 1] - positions[ia + 1];
    const abz = positions[ib + 2] - positions[ia + 2];

    const acx = positions[ic] - positions[ia];
    const acy = positions[ic + 1] - positions[ia + 1];
    const acz = positions[ic + 2] - positions[ia + 2];

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    normals[ia] += nx;
    normals[ia + 1] += ny;
    normals[ia + 2] += nz;
    normals[ib] += nx;
    normals[ib + 1] += ny;
    normals[ib + 2] += nz;
    normals[ic] += nx;
    normals[ic + 1] += ny;
    normals[ic + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len < 1e-12) {
      normals[i] = 0;
      normals[i + 1] = 1;
      normals[i + 2] = 0;
    } else {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }
  return normals;
}

/** Une paneles en una sola malla, reescribiendo ├¡ndices y grupos. */
export function mergeMeshes(parts: BuiltMesh[]): BuiltMesh {
  const nonEmpty = parts.filter((p) => p.indices.length > 0);
  if (nonEmpty.length === 0) return { ...EMPTY_MESH };
  if (nonEmpty.length === 1) return nonEmpty[0];

  let vertexTotal = 0;
  let indexTotal = 0;
  for (const p of nonEmpty) {
    vertexTotal += p.positions.length / 3;
    indexTotal += p.indices.length;
  }

  const positions = new Float32Array(vertexTotal * 3);
  const normals = new Float32Array(vertexTotal * 3);
  const uvs = new Float32Array(vertexTotal * 2);
  const indices = new Uint32Array(indexTotal);
  const ringIndex = new Uint16Array(vertexTotal);
  const groups: MeshGroup[] = [];

  let vOffset = 0;
  let iOffset = 0;
  let ringOffset = 0;

  for (const p of nonEmpty) {
    const vCount = p.positions.length / 3;
    const ringCount = p.groups.reduce((max, g) => Math.max(max, g.ringStart + g.ringCount), 0);

    positions.set(p.positions, vOffset * 3);
    normals.set(p.normals, vOffset * 3);
    uvs.set(p.uvs, vOffset * 2);
    ringIndex.set(p.ringIndex, vOffset);

    for (let i = 0; i < p.indices.length; i++) {
      indices[iOffset + i] = p.indices[i] + vOffset;
    }

    for (const g of p.groups) {
      groups.push({
        ...g,
        vertexStart: g.vertexStart + vOffset,
        indexStart: g.indexStart + iOffset,
        ringStart: g.ringStart + ringOffset,
      });
    }

    vOffset += vCount;
    iOffset += p.indices.length;
    ringOffset += ringCount;
  }

  return { positions, normals, uvs, indices, ringIndex, groups };
}

/** Malla completa de una prenda. */
export function buildGarmentMesh(model: GarmentModel, segments = 48): BuiltMesh {
  return mergeMeshes(model.panels.map((panel) => buildPanelMesh(panel, segments)));
}
