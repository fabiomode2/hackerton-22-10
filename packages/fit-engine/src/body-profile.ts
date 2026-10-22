/**
 * Perfil de cuerpo + resolución antropométrica.
 *
 * Este archivo es la capa "inteligente" del maniquí: convierte lo que el
 * usuario sabe (6 medidas base + medidas opcionales + rasgos cualitativos)
 * en un perfil completo, con priors por sexo/altura, validación y confianza.
 *
 * Regla dura: una medida inferida NUNCA se presenta como medida. Se marca en
 * `inferred` y baja la confianza. El motor de fit solo consume números; la UI
 * decide qué enseñar como "medido" y qué como "estimado".
 *
 * Unidades: cm. Sin DOM, sin red, sin dependencias.
 */
import type { Body } from './types';

export type Sex = 'male' | 'female' | 'neutral';

/**
 * Medidas y rasgos opcionales. Todos son aditivos: si no vienen, se derivan
 * de la altura + sexo + medidas base y se marcan como inferidos.
 */
export type BodyShapeTraits = {
  sex?: Sex;

  // Medidas opcionales (cm)
  underbust_cm?: number;
  back_width_cm?: number; // ancho de espalda a la altura de las escápulas
  torso_length_cm?: number; // C7 → cintura natural (largo de espalda)
  neck_cm?: number;
  thigh_cm?: number; // contorno del muslo alto
  calf_cm?: number; // contorno de pantorrilla
  upper_arm_cm?: number; // contorno del brazo relajado
  wrist_cm?: number;
  ankle_cm?: number;

  // Datos corporales opcionales
  weight_kg?: number;
  body_fat_pct?: number;

  // Rasgos de forma, normalizados 0..1 salvo `posture` (-1..1)
  muscle?: number; // 0 = poca masa, 1 = muy musculado
  posture?: number; // -1 = encorvado, 0 = neutro, 1 = arqueado
  bust_projection?: number; // proyección frontal del pecho
  seat?: number; // volumen de glúteos
  belly?: number; // volumen abdominal frontal
  shoulder_slope?: number; // 0 = hombro recto, 1 = muy caído
};

export type BodyProfile = Body & BodyShapeTraits;

export type BodyWarningSeverity = 'info' | 'warn' | 'error';

export type BodyWarning = {
  code: string;
  message: string;
  severity: BodyWarningSeverity;
};

/** Perfil completo: todas las medidas resueltas, más procedencia y avisos. */
export type ResolvedBodyProfile = {
  sex: Sex;

  height_cm: number;
  bust_cm: number;
  waist_cm: number;
  hips_cm: number;
  shoulder_cm: number;
  inseam_cm: number;
  arm_cm: number;

  underbust_cm: number;
  back_width_cm: number;
  torso_length_cm: number;
  neck_cm: number;
  thigh_cm: number;
  calf_cm: number;
  upper_arm_cm: number;
  wrist_cm: number;
  ankle_cm: number;

  weight_kg?: number;
  body_fat_pct?: number;

  muscle: number;
  posture: number;
  bust_projection: number;
  seat: number;
  belly: number;
  shoulder_slope: number;

  inferred: string[];
  warnings: BodyWarning[];
  confidence: number;
};

export const BODY_LIMITS = {
  height_cm: [150, 210],
  bust_cm: [60, 180],
  waist_cm: [45, 160],
  hips_cm: [65, 190],
  shoulder_cm: [28, 65],
  inseam_cm: [55, 110],
  arm_cm: [40, 85],
  underbust_cm: [55, 170],
  back_width_cm: [20, 60],
  torso_length_cm: [25, 65],
  neck_cm: [25, 55],
  thigh_cm: [35, 95],
  calf_cm: [20, 60],
  upper_arm_cm: [18, 55],
  wrist_cm: [11, 25],
  ankle_cm: [15, 35],
} as const;

export type BodyMeasureKey = keyof typeof BODY_LIMITS;

type BaseMeasureKey = 'height_cm' | 'bust_cm' | 'waist_cm' | 'hips_cm' | 'shoulder_cm' | 'inseam_cm';

/** Peso de cada medida base en la confianza. Suman 1. */
const BASE_WEIGHTS: Record<BaseMeasureKey, number> = {
  height_cm: 0.15,
  bust_cm: 0.2,
  waist_cm: 0.2,
  hips_cm: 0.2,
  shoulder_cm: 0.15,
  inseam_cm: 0.1,
};

const OPTIONAL_MEASURE_KEYS = [
  'underbust_cm',
  'back_width_cm',
  'torso_length_cm',
  'neck_cm',
  'thigh_cm',
  'calf_cm',
  'upper_arm_cm',
  'wrist_cm',
  'ankle_cm',
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function limit(key: BodyMeasureKey, value: number): number {
  const [min, max] = BODY_LIMITS[key];
  return clamp(value, min, max);
}

function readMeasurement(
  key: BodyMeasureKey,
  value: number | undefined,
  fallback: number,
  inferred: string[],
  warnings: BodyWarning[],
): number {
  if (value === undefined) {
    inferred.push(key);
    return limit(key, fallback);
  }

  const [min, max] = BODY_LIMITS[key];
  if (value < min || value > max) {
    const clamped = clamp(value, min, max);
    warnings.push({
      code: 'measurement_clamped',
      message: `${key}=${value.toFixed(1)} cm está fuera de [${min}, ${max}]; se ajusta a ${clamped.toFixed(1)} cm.`,
      severity: 'warn',
    });
    return clamped;
  }

  return value;
}

/**
 * Resuelve un perfil parcial en uno completo.
 *
 * - Las medidas base que falten se infieren de altura + sexo.
 * - Las opcionales que falten se derivan con ratios antropométricos.
 * - Los valores fuera de rango se clampan con aviso.
 * - La confianza baja si faltan medidas base, si hay avisos o si hay
 *   inconsistencias (p. ej. cintura > cadera + 5 cm).
 */
export function resolveBodyProfile(profile: BodyProfile): ResolvedBodyProfile {
  const warnings: BodyWarning[] = [];
  const inferred: string[] = [];

  const sex: Sex =
    profile.sex === 'male' || profile.sex === 'female' ? profile.sex : 'neutral';

  if (profile.sex !== undefined && sex === 'neutral' && profile.sex !== 'neutral') {
    warnings.push({
      code: 'sex_invalid',
      message: `Sexo "${String(profile.sex)}" no reconocido; se usa "neutral".`,
      severity: 'info',
    });
  }

  const height = readMeasurement(
    'height_cm',
    numberOr(profile.height_cm),
    170,
    inferred,
    warnings,
  );

  const bustFallback =
    sex === 'female' ? 0.53 * height : sex === 'male' ? 0.56 * height : 0.545 * height;
  const waistFallback =
    sex === 'female' ? 0.42 * height : sex === 'male' ? 0.46 * height : 0.44 * height;
  const hipsFallback =
    sex === 'female' ? 0.55 * height : sex === 'male' ? 0.52 * height : 0.535 * height;
  const shoulderFallback =
    sex === 'female' ? 0.225 * height : sex === 'male' ? 0.245 * height : 0.235 * height;
  const inseamFallback = 0.46 * height;
  const armFallback = 0.34 * height;

  const bust = readMeasurement('bust_cm', numberOr(profile.bust_cm), bustFallback, inferred, warnings);
  const waist = readMeasurement('waist_cm', numberOr(profile.waist_cm), waistFallback, inferred, warnings);
  const hips = readMeasurement('hips_cm', numberOr(profile.hips_cm), hipsFallback, inferred, warnings);
  const shoulder = readMeasurement(
    'shoulder_cm',
    numberOr(profile.shoulder_cm),
    shoulderFallback,
    inferred,
    warnings,
  );
  const inseam = readMeasurement(
    'inseam_cm',
    numberOr(profile.inseam_cm),
    inseamFallback,
    inferred,
    warnings,
  );
  const arm = readMeasurement('arm_cm', numberOr(profile.arm_cm), armFallback, inferred, warnings);

  const underbustFallback =
    sex === 'female' ? bust * 0.86 : sex === 'male' ? bust * 0.92 : bust * 0.89;
  const torsoLengthFallback = 0.235 * height;
  const neckFallback =
    sex === 'female' ? 0.18 * height : sex === 'male' ? 0.19 * height : 0.185 * height;
  const thighFallback =
    sex === 'female' ? 0.33 * height : sex === 'male' ? 0.31 * height : 0.32 * height;
  const calfFallback =
    sex === 'female' ? 0.2 * height : sex === 'male' ? 0.21 * height : 0.205 * height;
  const upperArmFallback =
    sex === 'female' ? 0.165 * height : sex === 'male' ? 0.175 * height : 0.17 * height;
  const wristFallback =
    sex === 'female' ? 0.09 * height : sex === 'male' ? 0.095 * height : 0.0925 * height;
  const ankleFallback =
    sex === 'female' ? 0.125 * height : sex === 'male' ? 0.13 * height : 0.1275 * height;

  const underbust = readMeasurement(
    'underbust_cm',
    numberOr(profile.underbust_cm),
    underbustFallback,
    inferred,
    warnings,
  );
  const backWidth = readMeasurement(
    'back_width_cm',
    numberOr(profile.back_width_cm),
    shoulder * 0.82,
    inferred,
    warnings,
  );
  const torsoLength = readMeasurement(
    'torso_length_cm',
    numberOr(profile.torso_length_cm),
    torsoLengthFallback,
    inferred,
    warnings,
  );
  const neck = readMeasurement('neck_cm', numberOr(profile.neck_cm), neckFallback, inferred, warnings);
  const thigh = readMeasurement('thigh_cm', numberOr(profile.thigh_cm), thighFallback, inferred, warnings);
  const calf = readMeasurement('calf_cm', numberOr(profile.calf_cm), calfFallback, inferred, warnings);
  const upperArm = readMeasurement(
    'upper_arm_cm',
    numberOr(profile.upper_arm_cm),
    upperArmFallback,
    inferred,
    warnings,
  );
  const wrist = readMeasurement('wrist_cm', numberOr(profile.wrist_cm), wristFallback, inferred, warnings);
  const ankle = readMeasurement('ankle_cm', numberOr(profile.ankle_cm), ankleFallback, inferred, warnings);

  const weightRaw = numberOr(profile.weight_kg);
  let weight: number | undefined;
  if (weightRaw !== undefined) {
    if (weightRaw < 30 || weightRaw > 250) {
      warnings.push({
        code: 'weight_outlier',
        message: `weight_kg=${weightRaw} está fuera de [30, 250]; se ignora.`,
        severity: 'warn',
      });
    } else {
      weight = weightRaw;
    }
  }

  const bodyFatRaw = numberOr(profile.body_fat_pct);
  let bodyFat: number | undefined;
  if (bodyFatRaw !== undefined) {
    if (bodyFatRaw < 3 || bodyFatRaw > 60) {
      warnings.push({
        code: 'body_fat_outlier',
        message: `body_fat_pct=${bodyFatRaw} está fuera de [3, 60]; se ajusta.`,
        severity: 'warn',
      });
      bodyFat = clamp(bodyFatRaw, 3, 60);
    } else {
      bodyFat = bodyFatRaw;
    }
  }

  if (weight !== undefined) {
    const bmi = weight / Math.pow(height / 100, 2);
    if (bmi < 14 || bmi > 45) {
      warnings.push({
        code: 'bmi_outlier',
        message: `El IMC implícito (${bmi.toFixed(1)}) es extremo; revisa peso y altura.`,
        severity: 'warn',
      });
    }
  }

  const muscle = clamp(
    numberOr(profile.muscle) ?? (sex === 'male' ? 0.55 : sex === 'female' ? 0.45 : 0.5),
    0,
    1,
  );
  const posture = clamp(numberOr(profile.posture) ?? 0, -1, 1);
  const bustProjection = clamp(
    numberOr(profile.bust_projection) ??
      (sex === 'female' ? 0.55 : sex === 'male' ? 0.25 : 0.4),
    0,
    1,
  );
  const seat = clamp(
    numberOr(profile.seat) ??
      (bodyFat !== undefined
        ? clamp((bodyFat - 12) / 35, 0, 1)
        : sex === 'female'
          ? 0.6
          : sex === 'male'
            ? 0.35
            : 0.48),
    0,
    1,
  );
  const belly = clamp(
    numberOr(profile.belly) ??
      (bodyFat !== undefined ? clamp((bodyFat - 15) / 30, 0, 1) : 0.25),
    0,
    1,
  );
  const shoulderSlope = clamp(numberOr(profile.shoulder_slope) ?? 0.45, 0, 1);

  if (waist > hips + 5) {
    warnings.push({
      code: 'waist_gt_hips',
      message: `Cintura (${waist.toFixed(1)}) > cadera (${hips.toFixed(1)}) + 5 cm. Revisa las medidas; el cuerpo se genera igual.`,
      severity: 'warn',
    });
  }
  if (bust < underbust + 1) {
    warnings.push({
      code: 'bust_lt_underbust',
      message: `Pecho (${bust.toFixed(1)}) ≤ bajo pecho (${underbust.toFixed(1)}). Revisa las medidas.`,
      severity: 'warn',
    });
  }
  if (inseam > height * 0.55) {
    warnings.push({
      code: 'inseam_too_long',
      message: `Entrepierna (${inseam.toFixed(1)} cm) > 55% de la altura. Revisa la medida.`,
      severity: 'warn',
    });
  }
  if (shoulder > height * 0.36) {
    warnings.push({
      code: 'shoulder_too_wide',
      message: `Hombro (${shoulder.toFixed(1)} cm) > 36% de la altura. Revisa la medida.`,
      severity: 'warn',
    });
  }
  if (waist < height * 0.3) {
    warnings.push({
      code: 'waist_too_small',
      message: `Cintura (${waist.toFixed(1)} cm) < 30% de la altura. Revisa la medida.`,
      severity: 'warn',
    });
  }
  if (torsoLength > height * 0.34 || torsoLength < height * 0.18) {
    warnings.push({
      code: 'torso_length_outlier',
      message: `Largo de espalda (${torsoLength.toFixed(1)} cm) fuera del rango esperado para ${height.toFixed(0)} cm.`,
      severity: 'warn',
    });
  }

  const baseProvided = (Object.keys(BASE_WEIGHTS) as BaseMeasureKey[]).filter(
    (key) => numberOr(profile[key]) !== undefined,
  );
  const baseCoverage = baseProvided.reduce((sum, key) => sum + BASE_WEIGHTS[key], 0);
  const optionalProvided = OPTIONAL_MEASURE_KEYS.filter(
    (key) => numberOr(profile[key]) !== undefined,
  ).length;
  const optionalRatio = optionalProvided / OPTIONAL_MEASURE_KEYS.length;
  const optionalPenalty = 0.05 * (1 - optionalRatio);
  const coverage = clamp(baseCoverage + 0.1 * optionalRatio - optionalPenalty, 0, 1);

  const consistency =
    1 - Math.min(0.35, warnings.filter((warning) => warning.severity !== 'info').length * 0.06);

  const confidence = Math.round(clamp(0.7 * coverage + 0.3 * consistency, 0, 1) * 1000) / 1000;

  if (inferred.length > 0) {
    warnings.push({
      code: 'inferred_values',
      message: `Valores inferidos (no medidos): ${inferred.join(', ')}.`,
      severity: 'info',
    });
  }

  return {
    sex,
    height_cm: height,
    bust_cm: bust,
    waist_cm: waist,
    hips_cm: hips,
    shoulder_cm: shoulder,
    inseam_cm: inseam,
    arm_cm: arm,
    underbust_cm: underbust,
    back_width_cm: backWidth,
    torso_length_cm: torsoLength,
    neck_cm: neck,
    thigh_cm: thigh,
    calf_cm: calf,
    upper_arm_cm: upperArm,
    wrist_cm: wrist,
    ankle_cm: ankle,
    weight_kg: weight,
    body_fat_pct: bodyFat,
    muscle,
    posture,
    bust_projection: bustProjection,
    seat,
    belly,
    shoulder_slope: shoulderSlope,
    inferred,
    warnings,
    confidence,
  };
}
