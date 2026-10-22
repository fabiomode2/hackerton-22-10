/**
 * Intérprete determinista de rasgos cualitativos.
 *
 * El LLM puede hacer esto mismo (texto libre → JSON de forma), pero la demo
 * no depende de él: estas reglas son el fallback y la referencia de contrato.
 *
 * Regla dura: este módulo NUNCA toca medidas en cm. Solo mueve parámetros de
 * forma normalizados (0..1 o -1..1). Si el usuario dice "espalda ancha", eso
 * no inventa un ancho: ajusta la pendiente de hombro y, como mucho, pide la
 * medida que falta.
 */
import type { BodyProfile, BodyShapeTraits } from './body-profile';

type ShapeKey = 'muscle' | 'posture' | 'bust_projection' | 'seat' | 'belly' | 'shoulder_slope';

export type BodyTraitIntent = {
  shape: Partial<Pick<BodyShapeTraits, ShapeKey>>;
  matched: string[];
  unmatched: string[];
  confidence: number;
  why: string[];
};

type Rule = {
  id: string;
  patterns: RegExp[];
  shape: Partial<Record<ShapeKey, number>>;
  why: string;
};

const RULES: Rule[] = [
  {
    id: 'shoulders_square',
    patterns: [/hombros? anchos?/, /espalda ancha/, /espalda amplia/, /wide shoulders/],
    shape: { shoulder_slope: 0.2 },
    why: 'Hombros anchos → línea de hombro más recta y trapecio más horizontal.',
  },
  {
    id: 'shoulders_sloped',
    patterns: [/hombros? caidos?/, /hombros? estrechos?/, /sloped shoulders/],
    shape: { shoulder_slope: 0.8 },
    why: 'Hombros caídos → acromion más bajo y línea de hombro más suave.',
  },
  {
    id: 'athletic',
    patterns: [/atletic[oa]/, /deportista/, /musculad[oa]/, /muscul[oa]/, /tonificad[oa]/],
    shape: { muscle: 0.8, belly: 0.1 },
    why: 'Complexión atlética → más masa en hombro/brazo y menos volumen abdominal.',
  },
  {
    id: 'curvy',
    patterns: [/curvas?/, /caderas? anchas?/, /gluteos?/, /nalgas?/, /curvy/],
    shape: { seat: 0.8, bust_projection: 0.65 },
    why: 'Caderas/glúteos marcados → más profundidad posterior en cadera y pecho.',
  },
  {
    id: 'large_bust',
    patterns: [/pecho grande/, /busto grande/, /pechos?/, /large bust/],
    shape: { bust_projection: 0.85 },
    why: 'Pecho grande → más proyección frontal en la sección del busto.',
  },
  {
    id: 'small_bust',
    patterns: [/pecho pequen[oa]/, /busto pequen[oa]/, /small bust/],
    shape: { bust_projection: 0.2 },
    why: 'Pecho pequeño → menos proyección frontal en el busto.',
  },
  {
    id: 'belly',
    patterns: [/barriga/, /abdomen/, /panza/, /vientre/, /belly/],
    shape: { belly: 0.75 },
    why: 'Abdomen marcado → más profundidad frontal en la cintura.',
  },
  {
    id: 'flat_stomach',
    patterns: [/vientre plano/, /abdomen plano/, /flat stomach/],
    shape: { belly: 0.05 },
    why: 'Abdomen plano → menos profundidad frontal en la cintura.',
  },
  {
    id: 'slouch',
    patterns: [/encorvad[oa]/, /postura caida/, /espalda curva/, /slouch/],
    shape: { posture: -0.6 },
    why: 'Postura encorvada → el centro de la sección se desplaza hacia atrás en el pecho.',
  },
  {
    id: 'upright',
    patterns: [/postura recta/, /espalda recta/, /erguid[oa]/, /upright/],
    shape: { posture: 0.4 },
    why: 'Postura erguida → pecho ligeramente adelantado y cadera neutra.',
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Convierte frases como "hombros anchos, cintura marcada" en parámetros de
 * forma. No es un LLM: es el fallback barato y auditable. El LLM, si se usa,
 * debe devolver exactamente esta misma estructura y pasar por el validador.
 */
export function interpretBodyTraits(traits: string[]): BodyTraitIntent {
  const matched: string[] = [];
  const unmatched: string[] = [];
  const why: string[] = [];
  const values: Partial<Record<ShapeKey, number[]>> = {};
  const appliedRules = new Set<string>();

  for (const trait of traits) {
    const text = normalize(trait);
    if (!text) continue;

    let traitMatched = false;
    for (const rule of RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(text))) continue;

      traitMatched = true;
      appliedRules.add(rule.id);

      for (const [key, value] of Object.entries(rule.shape) as [ShapeKey, number][]) {
        (values[key] ??= []).push(value);
      }

      if (!why.includes(rule.why)) why.push(rule.why);
    }

    if (traitMatched) matched.push(trait);
    else unmatched.push(trait);
  }

  const shape: Partial<Record<ShapeKey, number>> = {};
  for (const [key, list] of Object.entries(values) as [ShapeKey, number[]][]) {
    shape[key] = list.reduce((sum, value) => sum + value, 0) / list.length;
  }

  const confidence =
    appliedRules.size === 0 ? 0 : Math.min(1, Math.round((0.45 + 0.15 * appliedRules.size) * 100) / 100);

  return {
    shape,
    matched,
    unmatched,
    confidence,
    why,
  };
}

/**
 * Aplica el intent solo a los campos que el usuario no ha definido.
 * Lo explícito siempre gana: si el usuario ya dijo `belly: 0.2`, una frase
 * como "barriga" no lo pisa.
 */
export function applyBodyIntent(profile: BodyProfile, intent: BodyTraitIntent): BodyProfile {
  const next: BodyProfile = { ...profile };

  for (const key of Object.keys(intent.shape) as ShapeKey[]) {
    if (next[key] === undefined) {
      next[key] = intent.shape[key];
    }
  }

  return next;
}
