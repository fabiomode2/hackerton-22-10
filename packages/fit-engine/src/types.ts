/**
 * CONTRATO CONGELADO — solo el lead edita este archivo.
 * Si necesitas un cambio, avisa en voz alta antes de tocar.
 *
 * Unidades: cm en los datos, metros en la escena (usa `cm()` para convertir).
 * Ejes: Y arriba, Z frontal, X derecha. Origen en el suelo, entre los pies.
 */

export type Body = {
  height_cm: number; // 150–210
  bust_cm: number; // contorno de pecho
  waist_cm: number; // contorno de cintura
  hips_cm: number; // contorno de cadera
  shoulder_cm: number; // ancho de hombro, punta a punta
  inseam_cm: number; // entrepierna → suelo
  arm_cm?: number; // largo de brazo
};

/**
 * Un anillo horizontal de la pila que forma cuerpo y prenda.
 * `y` y `cz` en cm. La sección se dibuja como superelipse:
 *   x = rx * sign(cos t) * |cos t|^(2/n)
 *   z = cz + rz * sign(sin t) * |sin t|^(2/n)
 * n = 2 → elipse · n = 2.4 → torso · n >= 3 → muy cuadrado
 */
export type Ring = {
  y: number;
  rx: number;
  rz: number;
  cz: number;
  n: number;
};

export type GarmentType = 'tshirt' | 'hoodie' | 'dress' | 'jeans' | 'jacket' | 'skirt';

export type Fabric = 'cotton_jersey' | 'fleece' | 'denim' | 'knit' | 'linen' | 'leather';

/** Medidas planas tal y como las da el vendedor en el listing (cm). */
export type GarmentMeasurements = {
  pit_to_pit_cm?: number;
  length_cm?: number;
  shoulder_cm?: number;
  sleeve_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  inseam_cm?: number;
  rise_cm?: number;
  thigh_cm?: number;
  hem_cm?: number;
};

export type Garment = {
  type: GarmentType;
  fabric: Fabric;
  measurements: GarmentMeasurements;
  /** De dónde salió cada medida. Opcional y aditivo: si falta, se asume seller_stated. */
  sources?: Partial<Record<keyof GarmentMeasurements, MeasurementSource>>;
  /** Metadatos del pipeline de extracción, para auditar la demo. */
  extraction?: { model: string; at: string; warnings: string[] };
};

/** Procedencia de una medida. Orden de fiabilidad: seller > ocr > calibrated > inferred > vlm. */
export type MeasurementSource =
  | 'seller_stated'
  | 'ocr_tape'
  | 'calibrated_photo'
  | 'inferred'
  | 'vlm_estimate';

/** Pesos de fiabilidad por fuente. Los usa la fusión del pipeline. */
export const SOURCE_WEIGHT: Record<MeasurementSource, number> = {
  seller_stated: 1.0,
  ocr_tape: 0.85,
  calibrated_photo: 0.8,
  inferred: 0.45,
  vlm_estimate: 0.3,
};

/** Una herramienta que el orquestador puede pedir. */
export type PipelineTool =
  | 'jev.classify'
  | 'jev.has_tape'
  | 'jev.locate_tape'
  | 'ocr.tape'
  | 'engine.infer';

/** Un paso del plan. `why` es obligatorio: si no se puede explicar, no se hace. */
export type PlanStep = {
  tool: PipelineTool;
  args: Record<string, unknown>;
  why: string;
};

/** Salida del orquestador (LLM o `planDeterministic()`). */
export type Plan = {
  plan: PlanStep[];
  /** Una sola pregunta al usuario si faltan datos y no hay fuente fiable. */
  ask_user: string | null;
  confidence_prior: number;
};

/** Resultado de una llamada a herramienta. */
export type ToolResult = {
  tool: PipelineTool;
  ok: boolean;
  value: unknown;
  source: MeasurementSource | null;
  confidence: number;
  error?: string;
};

export type FitVerdict = 'too_small' | 'tight' | 'regular' | 'loose' | 'too_big';

export type FitZone = {
  name: 'bust' | 'waist' | 'hips' | 'shoulder' | 'length' | 'thigh' | 'inseam';
  /** holgura en cm: positivo = sobra tela, negativo = aprieta */
  ease_cm: number;
  /** tensión normalizada: >0 aprieta, <0 sobra */
  tension: number;
  verdict: FitVerdict;
};

export type FitResult = {
  verdict: FitVerdict;
  /** holgura en el punto crítico (el más negativo) */
  ease_cm: number;
  /** 0–1: cuántas medidas traía el listing respecto a las necesarias */
  confidence: number;
  /** Desglose opcional de la confianza compuesta (ver docs/pipeline.md §8). */
  confidence_parts?: { coverage: number; source_quality: number; consistency: number };
  zones: FitZone[];
  /** nombres de medidas que faltan, para enseñarlo en la UI */
  missing: string[];
};

/** Anuncio normalizado. Es lo que consume la demo. */
export type Listing = {
  id: string;
  title: string;
  brand?: string;
  price: number;
  size_label?: string;
  condition?: string;
  photos: string[];
  garment: Garment;
  /** perfil de cuerpo del comprador, si ya lo tiene guardado */
  body: Body;
};

/** cm → metros de escena */
export const cm = (v: number): number => v * 0.01;

/**
 * Bandas de holgura por tipo de prenda, en cm de contorno.
 * `ideal` es el rango donde la prenda "sienta bien".
 * Por debajo de `min` → too_small · por encima de `max` → too_big.
 */
export const EASE_BANDS: Record<GarmentType, { min: number; ideal: [number, number]; max: number }> = {
  tshirt: { min: -2, ideal: [3, 10], max: 20 },
  hoodie: { min: 2, ideal: [8, 16], max: 28 },
  dress: { min: 0, ideal: [4, 10], max: 20 },
  jacket: { min: 4, ideal: [10, 20], max: 32 },
  jeans: { min: -1, ideal: [2, 6], max: 12 },
  skirt: { min: 0, ideal: [4, 10], max: 18 },
};
