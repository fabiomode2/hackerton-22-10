/**
 * Render de previsualización del maniquí.
 *
 * Genera una lámina SVG (y luego PNG con cairosvg) directamente desde
 * `buildBody()`. No es el viewer: es una herramienta de QA visual para ver
 * la silueta, las proporciones y el efecto de los priors sin montar R3F.
 *
 * Uso:
 *   npx tsx packages/fit-engine/scripts/render-body-preview.ts
 *   python3 -c "import cairosvg; cairosvg.svg2png(...)"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildBody,
  superellipsePoint,
  type BodyGeometry,
  type BodyRing,
  type PathRing,
  type Vec3,
} from '../src/body';
import type { BodyProfile } from '../src/body-profile';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const INK = '#111110';
const PAPER = '#F6F4EF';
const MUTED = '#6B6862';
const LINE = '#111110';
const ACCENT = '#007782';
const CLAY = [208, 195, 177] as const;

const SEGMENTS = 40;
const LAT_SEGMENTS = 16;
const LON_SEGMENTS = 32;

type Face = {
  points: Vec3[];
  shade: number;
};

type Camera = {
  camDir: Vec3;
  right: Vec3;
  up: Vec3;
};

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function lengthOf(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = lengthOf(v);
  return len < 1e-9 ? { x: 0, y: 0, z: 0 } : scale(v, 1 / len);
}

function cameraFor(azimuthDeg: number, elevationDeg: number): Camera {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  const camDir = normalize({
    x: Math.sin(az) * Math.cos(el),
    y: Math.sin(el),
    z: Math.cos(az) * Math.cos(el),
  });
  const forward = scale(camDir, -1);
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = normalize(cross(right, forward));
  return { camDir, right, up };
}

const LIGHT = normalize({ x: -0.45, y: 0.85, z: 0.55 });

function shadeFor(normal: Vec3): number {
  return 0.55 + 0.45 * Math.abs(dot(normal, LIGHT));
}

function shadeColor(shade: number): string {
  const [r, g, b] = CLAY;
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `rgb(${clamp(r * shade)},${clamp(g * shade)},${clamp(b * shade)})`;
}

function addQuad(faces: Face[], a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
  const normal = normalize(cross(sub(b, a), sub(d, a)));
  if (lengthOf(normal) < 1e-9) return;
  faces.push({ points: [a, b, c, d], shade: shadeFor(normal) });
}

function addTriangle(faces: Face[], a: Vec3, b: Vec3, c: Vec3): void {
  const normal = normalize(cross(sub(b, a), sub(c, a)));
  if (lengthOf(normal) < 1e-9) return;
  faces.push({ points: [a, b, c], shade: shadeFor(normal) });
}

function addCap(faces: Face[], ring: Vec3[], apex: Vec3): void {
  for (let j = 0; j < ring.length; j += 1) {
    addTriangle(faces, ring[j], ring[(j + 1) % ring.length], apex);
  }
}

function addTube(faces: Face[], rings: Vec3[][]): void {
  if (rings.length < 2) return;
  const segments = rings[0].length;
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const j2 = (j + 1) % segments;
      addQuad(faces, rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]);
    }
  }
}

function bodyRingPoints(ring: BodyRing, segments = SEGMENTS): Vec3[] {
  const points: Vec3[] = [];
  for (let j = 0; j < segments; j += 1) {
    const t = (j / segments) * TAU;
    const p = superellipsePoint(t, ring.rx, ring.rz, ring.n);
    points.push({ x: ring.cx + p.x, y: ring.y, z: ring.cz + p.z });
  }
  return points;
}

function pathRingPoints(ring: PathRing, segments = SEGMENTS): Vec3[] {
  const points: Vec3[] = [];
  for (let j = 0; j < segments; j += 1) {
    const t = (j / segments) * TAU;
    const p = superellipsePoint(t, ring.rx, ring.rz, ring.n);
    points.push(add(ring.center, add(scale(ring.u, p.x), scale(ring.v, p.z))));
  }
  return points;
}

function ellipsoidRings(
  center: Vec3,
  rx: number,
  ry: number,
  rz: number,
  latSegments = LAT_SEGMENTS,
  lonSegments = LON_SEGMENTS,
): Vec3[][] {
  const rings: Vec3[][] = [];
  for (let i = 0; i <= latSegments; i += 1) {
    const lat = -Math.PI / 2 + (i / latSegments) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const ring: Vec3[] = [];
    for (let j = 0; j < lonSegments; j += 1) {
      const lon = (j / lonSegments) * TAU;
      ring.push({
        x: center.x + rx * cosLat * Math.cos(lon),
        y: center.y + ry * sinLat,
        z: center.z + rz * cosLat * Math.sin(lon),
      });
    }
    rings.push(ring);
  }
  return rings;
}

function handRings(
  center: Vec3,
  axis: Vec3,
  length: number,
  width: number,
  thickness: number,
  latSegments = LAT_SEGMENTS,
  lonSegments = LON_SEGMENTS,
): Vec3[][] {
  const w = normalize(axis);
  let u = normalize(cross(w, { x: 0, y: 1, z: 0 }));
  if (lengthOf(u) < 1e-6) u = { x: 1, y: 0, z: 0 };
  const v = normalize(cross(w, u));

  const rings: Vec3[][] = [];
  for (let i = 0; i <= latSegments; i += 1) {
    const lat = -Math.PI / 2 + (i / latSegments) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const ring: Vec3[] = [];
    for (let j = 0; j < lonSegments; j += 1) {
      const lon = (j / lonSegments) * TAU;
      ring.push(
        add(
          center,
          add(
            scale(w, (length / 2) * sinLat),
            add(
              scale(u, (width / 2) * cosLat * Math.cos(lon)),
              scale(v, (thickness / 2) * cosLat * Math.sin(lon)),
            ),
          ),
        ),
      );
    }
    rings.push(ring);
  }
  return rings;
}

function buildFaces(geometry: BodyGeometry): Face[] {
  const faces: Face[] = [];

  addTube(faces, geometry.torso.map((ring) => bodyRingPoints(ring)));
  addTube(faces, geometry.neck.map((ring) => bodyRingPoints(ring)));

  for (const leg of geometry.legs) {
    addTube(faces, leg.rings.map((ring) => pathRingPoints(ring)));
  }
  for (const arm of geometry.arms) {
    const armRings = arm.rings.map((ring) => pathRingPoints(ring));
    addTube(faces, armRings);

    // Cierra la boca del hombro con un cono muy plano hacia dentro del torso.
    // Sin esto, el tubo abierto del brazo se ve como un agujero en 3/4.
    const apex = add(
      arm.joints.shoulder,
      scale(normalize(sub(arm.joints.shoulder, arm.joints.elbow)), 1.5),
    );
    addCap(faces, armRings[0], apex);
  }

  addTube(
    faces,
    ellipsoidRings(
      geometry.head.center,
      geometry.head.rx,
      geometry.head.ry,
      geometry.head.rz,
      LAT_SEGMENTS,
      LON_SEGMENTS,
    ),
  );

  for (const foot of geometry.feet) {
    addTube(
      faces,
      ellipsoidRings(foot.center, foot.rx, foot.ry, foot.rz, 12, 24),
    );
  }

  for (const hand of geometry.hands) {
    addTube(
      faces,
      handRings(
        hand.center,
        hand.axis,
        hand.length_cm,
        hand.width_cm,
        hand.thickness_cm,
        10,
        20,
      ),
    );
  }

  return faces;
}

type Panel = {
  cx: number;
  groundY: number;
  scale: number;
};

function renderPanel(faces: Face[], camera: Camera, panel: Panel): string {
  const projected = faces.map((face) => {
    const points = face.points.map((point) => ({
      x: dot(point, camera.right),
      y: dot(point, camera.up),
      depth: dot(point, camera.camDir),
    }));
    const depth = points.reduce((sum, point) => sum + point.depth, 0) / points.length;
    return { points, depth, shade: face.shade };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const face of projected) {
    for (const point of face.points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  const originX = panel.cx - ((minX + maxX) / 2) * panel.scale;
  const originY = panel.groundY + minY * panel.scale;

  projected.sort((a, b) => a.depth - b.depth);

  const polygons: string[] = [];
  for (const face of projected) {
    const points = face.points
      .map(
        (point) =>
          `${(originX + point.x * panel.scale).toFixed(1)},${(originY - point.y * panel.scale).toFixed(1)}`,
      )
      .join(' ');
    const fill = shadeColor(face.shade);
    polygons.push(
      `<polygon points="${points}" fill="${fill}" stroke="${fill}" stroke-width="0.45"/>`,
    );
  }

  const shadowWidth = (maxX - minX) * panel.scale * 0.34;
  const shadow = `<ellipse cx="${panel.cx}" cy="${panel.groundY + 3}" rx="${shadowWidth.toFixed(1)}" ry="9" fill="${INK}" opacity="0.06"/>`;

  return `${shadow}\n${polygons.join('\n')}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const female165: BodyProfile = {
  sex: 'female',
  height_cm: 165,
  bust_cm: 88,
  waist_cm: 70,
  hips_cm: 96,
  shoulder_cm: 38,
  inseam_cm: 76,
  arm_cm: 56,
  underbust_cm: 76,
  back_width_cm: 31,
  torso_length_cm: 39,
  neck_cm: 30.5,
  thigh_cm: 55,
  calf_cm: 34.5,
  upper_arm_cm: 27,
  wrist_cm: 15,
  ankle_cm: 21.5,
  bust_projection: 0.6,
  seat: 0.65,
  belly: 0.2,
  posture: 0.05,
  shoulder_slope: 0.5,
};

const male180: BodyProfile = {
  sex: 'male',
  height_cm: 180,
  bust_cm: 100,
  waist_cm: 84,
  hips_cm: 98,
  shoulder_cm: 46,
  inseam_cm: 84,
  arm_cm: 62,
  underbust_cm: 92,
  back_width_cm: 38,
  torso_length_cm: 42,
  neck_cm: 38,
  thigh_cm: 57,
  calf_cm: 37,
  upper_arm_cm: 31,
  wrist_cm: 17.5,
  ankle_cm: 23.5,
  bust_projection: 0.25,
  seat: 0.35,
  belly: 0.2,
  posture: 0,
  shoulder_slope: 0.35,
};

const femalePlus170: BodyProfile = {
  sex: 'female',
  height_cm: 170,
  bust_cm: 110,
  waist_cm: 95,
  hips_cm: 120,
  shoulder_cm: 42,
  inseam_cm: 78,
  arm_cm: 58,
  underbust_cm: 92,
  back_width_cm: 35,
  torso_length_cm: 41,
  neck_cm: 33,
  thigh_cm: 68,
  calf_cm: 42,
  upper_arm_cm: 33,
  wrist_cm: 16,
  ankle_cm: 23,
  bust_projection: 0.7,
  seat: 0.8,
  belly: 0.65,
  posture: 0,
  shoulder_slope: 0.5,
};

const bodies = [
  {
    name: 'MUJER',
    subtitle: '165 cm · talla media',
    profile: female165,
  },
  {
    name: 'HOMBRE',
    subtitle: '180 cm · talla media',
    profile: male180,
  },
  {
    name: 'MUJER',
    subtitle: '170 cm · talla grande',
    profile: femalePlus170,
  },
];

const width = 1650;
const height = 1050;
const VIEW = (process.env.VIEW ?? 'front') as 'front' | 'side' | 'three-quarter';
const VIEW_LABEL: Record<typeof VIEW, string> = {
  front: 'vista frontal',
  side: 'vista lateral',
  'three-quarter': 'vista 3/4',
};
const POSTER_SCALE = 700 / 180;
const camera =
  VIEW === 'side' ? cameraFor(-90, 0) : VIEW === 'three-quarter' ? cameraFor(30, 8) : cameraFor(15, 2);

const panels = [
  { cx: 295, groundY: 885, scale: POSTER_SCALE },
  { cx: 825, groundY: 885, scale: POSTER_SCALE },
  { cx: 1355, groundY: 885, scale: POSTER_SCALE },
];

const parts: string[] = [];
parts.push(`<rect width="${width}" height="${height}" fill="${PAPER}"/>`);

parts.push(
  `<text x="60" y="62" font-family="Georgia, 'Times New Roman', serif" font-size="36" letter-spacing="1.2" fill="${INK}">OUTFIT CHECK</text>`,
);
parts.push(
  `<text x="60" y="88" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="13" fill="${MUTED}">Maniquí antropométrico · prototipo determinista · ${VIEW_LABEL[VIEW]} · medidas en cm</text>`,
);
parts.push(`<line x1="60" y1="112" x2="1590" y2="112" stroke="${LINE}" opacity="0.12"/>`);

parts.push(
  `<rect x="1460" y="40" width="64" height="24" rx="12" fill="${ACCENT}"/>` +
    `<text x="1492" y="56" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="600" fill="#FFFFFF">REAL</text>`,
);
parts.push(
  `<text x="1534" y="56" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="10" fill="${MUTED}">solver offline</text>`,
);

bodies.forEach(({ name, subtitle, profile }, index) => {
  const panel = panels[index];
  const geometry = buildBody(profile);
  const faces = buildFaces(geometry);
  const svgBody = renderPanel(faces, camera, panel);

  parts.push(svgBody);

  parts.push(
    `<text x="${panel.cx}" y="160" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="25" letter-spacing="0.6" fill="${INK}">${escapeXml(name)}</text>`,
  );
  parts.push(
    `<text x="${panel.cx}" y="182" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" fill="${MUTED}">${escapeXml(subtitle)}</text>`,
  );

  const measurements = [
    `pecho ${profile.bust_cm} · cintura ${profile.waist_cm} · cadera ${profile.hips_cm}`,
    `hombro ${profile.shoulder_cm} · entrepierna ${profile.inseam_cm} · brazo ${profile.arm_cm}`,
    `espalda ${profile.back_width_cm} · largo ${profile.torso_length_cm} · cuello ${profile.neck_cm}`,
    `conf ${geometry.confidence.toFixed(2)} · 26 anillos torso · 8+8 piernas · 14+14 brazos`,
  ];

  measurements.forEach((line, lineIndex) => {
    parts.push(
      `<text x="${panel.cx}" y="${922 + lineIndex * 16}" text-anchor="middle" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="10" fill="${lineIndex === 3 ? MUTED : INK}">${escapeXml(line)}</text>`,
    );
  });
});

parts.push(`<line x1="560" y1="145" x2="560" y2="975" stroke="${LINE}" opacity="0.08"/>`);
parts.push(`<line x1="1090" y1="145" x2="1090" y2="975" stroke="${LINE}" opacity="0.08"/>`);
parts.push(`<line x1="60" y1="1000" x2="1590" y2="1000" stroke="${LINE}" opacity="0.12"/>`);

parts.push(
  `<text x="60" y="1024" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="10" fill="${MUTED}">Sin assets · torso 26 anillos · piernas 8+8 · brazos 14+14 · cuello 5 · reproyección &lt; 0.5 cm</text>`,
);
parts.push(
  `<text x="60" y="1041" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="10" fill="${MUTED}">outfit check · 22/10 · Y arriba · Z frontal · X derecha · origen en el suelo</text>`,
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${parts.join('\n')}\n</svg>\n`;

const output = resolve(process.cwd(), `packages/fit-engine/out/body-preview-${VIEW}.svg`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, svg, 'utf8');

console.log(`SVG: ${output}`);
console.log(`Caras: ${bodies.map((body) => buildFaces(buildBody(body.profile)).length).join(' / ')}`);
