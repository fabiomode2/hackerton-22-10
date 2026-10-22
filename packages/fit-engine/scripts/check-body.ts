/**
 * Check numérico del solver de cuerpo.
 *
 * No es un test runner: es un script de verificación que se ejecuta con
 * `npx tsx packages/fit-engine/scripts/check-body.ts`.
 *
 * Comprueba:
 *  - que las circunferencias de cintura/cadera/pecho se reproducen;
 *  - que los landmarks verticales son coherentes;
 *  - que el ancho de espalda se respeta (o se recorta con aviso);
 *  - que no hay NaN ni anillos desordenados;
 *  - que el intérprete de rasgos no pisa lo explícito.
 */
import assert from 'node:assert/strict';
import { applyBodyIntent, interpretBodyTraits } from '../src/body-intent';
import { buildBody, superellipsePerimeter } from '../src/body';
import type { BodyProfile } from '../src/body-profile';

const profiles: { name: string; body: BodyProfile }[] = [
  {
    name: 'female-165',
    body: {
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
    },
  },
  {
    name: 'male-180',
    body: {
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
    },
  },
  {
    name: 'female-plus-170',
    body: {
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
    },
  },
  {
    name: 'male-small-160',
    body: {
      sex: 'male',
      height_cm: 160,
      bust_cm: 88,
      waist_cm: 74,
      hips_cm: 90,
      shoulder_cm: 40,
      inseam_cm: 74,
      arm_cm: 55,
      underbust_cm: 81,
      back_width_cm: 33,
      torso_length_cm: 37,
      neck_cm: 33,
      thigh_cm: 50,
      calf_cm: 34,
      upper_arm_cm: 27,
      wrist_cm: 15.5,
      ankle_cm: 21,
      bust_projection: 0.3,
      seat: 0.3,
      belly: 0.25,
      posture: 0,
      shoulder_slope: 0.4,
    },
  },
  {
    name: 'neutral-inferred',
    body: {
      height_cm: 172,
      bust_cm: 92,
      waist_cm: 76,
      hips_cm: 98,
      shoulder_cm: 41,
      inseam_cm: 79,
    },
  },
];

type Summary = {
  name: string;
  confidence: number;
  torso: number;
  legs: string;
  arms: string;
  neck: number;
  waist: string;
  hip: string;
  bust: string;
  inferred: number;
  warnings: number;
};

const summaries: Summary[] = [];

for (const { name, body } of profiles) {
  const geometry = buildBody(body);
  const { profile, landmarks } = geometry;

  assert.ok(geometry.torso.length >= 20, `${name}: torso con pocos anillos`);
  assert.equal(geometry.legs.length, 2, `${name}: faltan piernas`);
  assert.equal(geometry.arms.length, 2, `${name}: faltan brazos`);
  assert.ok(geometry.neck.length >= 2, `${name}: cuello vacío`);
  assert.equal(geometry.landmarks.head_top_y_cm, profile.height_cm, `${name}: altura`);
  assert.equal(geometry.landmarks.crotch_y_cm, profile.inseam_cm, `${name}: entrepierna`);
  assert.equal(geometry.landmarks.shoulder_width_cm, profile.shoulder_cm, `${name}: hombro`);

  const circumferenceChecks: [string, number, number][] = [
    ['waist', profile.waist_cm, landmarks.waist_y_cm],
    ['hip', profile.hips_cm, landmarks.hip_y_cm],
    ['bust', profile.bust_cm, landmarks.bust_y_cm],
  ];

  for (const [label, target, y] of circumferenceChecks) {
    const ring = geometry.torso.find((candidate) => Math.abs(candidate.y - y) < 1e-6);
    assert.ok(ring, `${name}: no hay anillo de ${label} en y=${y}`);
    const actual = superellipsePerimeter(ring.rx, ring.rz, ring.n);
    assert.ok(
      Math.abs(actual - target) < 0.5,
      `${name}: ${label} objetivo=${target} real=${actual.toFixed(3)}`,
    );
  }

  const chest = geometry.torso.find(
    (candidate) => Math.abs(candidate.y - landmarks.chest_y_cm) < 1e-6,
  );
  assert.ok(chest, `${name}: no hay anillo de pecho`);
  assert.ok(
    chest.rx * 2 <= profile.back_width_cm + 0.01,
    `${name}: el ancho de espalda crece por encima del objetivo`,
  );

  for (const ring of geometry.torso) {
    for (const value of [ring.y, ring.rx, ring.rz, ring.cz, ring.n, ring.cx]) {
      assert.ok(Number.isFinite(value), `${name}: NaN en torso`);
    }
  }
  for (const limb of [...geometry.legs, ...geometry.arms]) {
    for (const ring of limb.rings) {
      for (const value of [ring.center.x, ring.center.y, ring.center.z, ring.rx, ring.rz]) {
        assert.ok(Number.isFinite(value), `${name}: NaN en ${limb.name}`);
      }
    }
  }

  summaries.push({
    name,
    confidence: geometry.confidence,
    torso: geometry.torso.length,
    legs: geometry.legs.map((leg) => leg.rings.length).join('/'),
    arms: geometry.arms.map((arm) => arm.rings.length).join('/'),
    neck: geometry.neck.length,
    waist: `${profile.waist_cm.toFixed(1)}→${landmarks.waist_y_cm.toFixed(1)}`,
    hip: `${profile.hips_cm.toFixed(1)}→${landmarks.hip_y_cm.toFixed(1)}`,
    bust: `${profile.bust_cm.toFixed(1)}→${landmarks.bust_y_cm.toFixed(1)}`,
    inferred: geometry.inferred.length,
    warnings: geometry.warnings.filter((warning) => warning.severity !== 'info').length,
  });
}

// El intérprete de rasgos no puede inventar medidas ni pisar lo explícito.
const intent = interpretBodyTraits([
  'hombros anchos',
  'complexión atlética',
  'postura encorvada',
  'me queda todo mal',
]);

assert.equal(intent.shape.shoulder_slope, 0.2, 'intent: hombros anchos');
assert.equal(intent.shape.muscle, 0.8, 'intent: atlético');
assert.equal(intent.shape.posture, -0.6, 'intent: encorvado');
assert.deepEqual(intent.unmatched, ['me queda todo mal'], 'intent: frase no reconocida');
assert.ok(intent.confidence > 0.5, 'intent: confianza');

const inferred = applyBodyIntent({ ...profiles[0].body, shoulder_slope: undefined }, intent);
assert.equal(inferred.shoulder_slope, 0.2, 'intent: rellena lo que falta');

const explicit = applyBodyIntent({ ...profiles[0].body, shoulder_slope: 0.9 }, intent);
assert.equal(explicit.shoulder_slope, 0.9, 'intent: lo explícito gana');

// Un perfil al que le faltan medidas base sigue funcionando y baja confianza.
const partial = buildBody({
  height_cm: 172,
  bust_cm: 92,
  waist_cm: 76,
  hips_cm: 98,
  shoulder_cm: 41,
  inseam_cm: 79,
});
assert.ok(partial.inferred.includes('arm_cm'), 'inferidos: falta brazo');
assert.ok(partial.confidence < 1, 'inferidos: la confianza baja');

const header = [
  'perfil'.padEnd(18),
  'conf'.padStart(5),
  'torso'.padStart(5),
  'piernas'.padStart(8),
  'brazos'.padStart(8),
  'cuello'.padStart(6),
  'cintura'.padStart(14),
  'cadera'.padStart(14),
  'pecho'.padStart(14),
  'inf'.padStart(4),
  'warn'.padStart(5),
];

console.log(header.join(' '));
for (const summary of summaries) {
  console.log(
    [
      summary.name.padEnd(18),
      summary.confidence.toFixed(3).padStart(5),
      String(summary.torso).padStart(5),
      summary.legs.padStart(8),
      summary.arms.padStart(8),
      String(summary.neck).padStart(6),
      summary.waist.padStart(14),
      summary.hip.padStart(14),
      summary.bust.padStart(14),
      String(summary.inferred).padStart(4),
      String(summary.warnings).padStart(5),
    ].join(' '),
  );
}

console.log('\nOK: geometría, landmarks y circunferencias verificados.');
console.log(
  `Rasgos: ${Object.entries(intent.shape)
    .map(([key, value]) => `${key}=${value.toFixed(2)}`)
    .join(', ')} · no reconocidos: ${intent.unmatched.join(', ') || 'ninguno'}`,
);
