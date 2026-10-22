/**
 * Validaci├│n de las medidas de la prenda antes de construir geometr├¡a.
 *
 * Regla del proyecto: no inventar medidas. Si falta un dato, se declara
 * (`missing`) y baja la confianza; si est├í fuera de rango, se marca como
 * no fiable en vez de renderizar una monstruosidad.
 */

import type { Garment, GarmentMeasurements, GarmentType } from './types.ts';

export type IssueLevel = 'error' | 'warning' | 'info';

export type Issue = {
  level: IssueLevel;
  code: string;
  field?: string;
  message: string;
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

/** Medidas que el motor necesita para no caer a valores por defecto. */
export const REQUIRED_MEASUREMENTS: Record<GarmentType, (keyof GarmentMeasurements)[]> = {
  tshirt: ['pit_to_pit_cm', 'length_cm'],
  hoodie: ['pit_to_pit_cm', 'length_cm'],
  jacket: ['pit_to_pit_cm', 'length_cm'],
  dress: ['pit_to_pit_cm', 'length_cm'],
  skirt: ['waist_cm', 'length_cm'],
  jeans: ['waist_cm', 'inseam_cm'],
};

/** Rangos f├¡sicos plausibles, en cm. Fuera de aqu├¡ hay error de dedo o prenda infantil. */
const MEASUREMENT_RANGE: Partial<Record<keyof GarmentMeasurements, [number, number]>> = {
  pit_to_pit_cm: [20, 90],
  shoulder_cm: [20, 70],
  sleeve_cm: [5, 90],
  waist_cm: [25, 70], // ├ù2 ÔåÆ [50, 140]
  hips_cm: [20, 100],
  inseam_cm: [30, 110],
  rise_cm: [10, 50],
  thigh_cm: [15, 60],
  hem_cm: [8, 50],
};

/** El largo depende del tipo: una camiseta no mide 120 cm ni un vestido 30. */
const LENGTH_RANGE: Record<GarmentType, [number, number]> = {
  tshirt: [40, 90],
  hoodie: [45, 90],
  jacket: [45, 95],
  dress: [60, 170],
  skirt: [30, 110],
  jeans: [60, 170],
};

export function validateGarment(garment: Garment): Issue[] {
  const issues: Issue[] = [];
  const m = garment.measurements;
  const required = REQUIRED_MEASUREMENTS[garment.type] ?? [];

  for (const field of required) {
    const value = m[field];
    if (!isNum(value) || value <= 0) {
      issues.push({
        level: 'error',
        code: 'garment.missing',
        field,
        message: `falta ${field}, necesario para ${garment.type}`,
      });
    }
  }

  for (const key of Object.keys(m) as (keyof GarmentMeasurements)[]) {
    const value = m[key];
    if (value === undefined) continue;
    if (!isNum(value) || value <= 0) {
      issues.push({
        level: 'error',
        code: 'garment.invalid',
        field: key,
        message: `${key} = ${String(value)} no es una medida v├ílida`,
      });
      continue;
    }
    const range =
      key === 'length_cm' ? LENGTH_RANGE[garment.type] : MEASUREMENT_RANGE[key];
    if (range && !inRange(value, range[0], range[1])) {
      issues.push({
        level: 'warning',
        code: 'garment.range',
        field: key,
        message: `${key} = ${value} cm fuera de rango [${range[0]}, ${range[1]}]; no se usa`,
      });
    }
  }

  // Regla de vinted-data.md: pit_to_pit ├ù 2 fuera de [60, 160] no es fiable.
  const pit = m.pit_to_pit_cm;
  if (isNum(pit) && pit > 0) {
    const chest = pit * 2;
    if (chest < 60 || chest > 160) {
      issues.push({
        level: 'error',
        code: 'garment.chest_implausible',
        field: 'pit_to_pit_cm',
        message: `pecho de prenda = ${chest} cm (${pit} ├ù 2); fuera de [60, 160], no se usa`,
      });
    }
  }

  return issues;
}

/** true si no hay ning├║n error bloqueante. */
export function isReliable(issues: Issue[]): boolean {
  return !issues.some((i) => i.level === 'error');
}

/** Texto corto para la UI. */
export function summarizeIssues(issues: Issue[]): string[] {
  return issues.map((i) => i.message);
}
