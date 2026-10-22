/**
 * FIXTURE — no es el motor. Es el cuerpo hardcodeado para que Dev 3 y Dev 4
 * puedan construir la escena y la demo desde el minuto 20, sin esperar a Dev 1.
 *
 * Dev 1 sustituye esto por `buildBody(body: Body): Ring[]` en `body.ts`.
 * Cuerpo de referencia: 175 cm · pecho 92 · cintura 78 · cadera 96 · hombro 44 · entrepierna 80.
 *
 * El torso y las piernas son lofts separados: una sola pila de anillos no puede
 * hacer dos piernas. Para el MVP (camiseta) basta con el torso.
 */
import type { Body, Ring } from './types';

export const MOCK_BODY: Body = {
  height_cm: 175,
  bust_cm: 92,
  waist_cm: 78,
  hips_cm: 96,
  shoulder_cm: 44,
  inseam_cm: 80,
  arm_cm: 60,
};

/** Torso: de cadera a base del cuello. */
export const MOCK_TORSO_RINGS: Ring[] = [
  { y: 88, rx: 16.4, rz: 11.9, cz: 0, n: 2.4 }, // cadera
  { y: 96, rx: 15.2, rz: 10.9, cz: 0, n: 2.4 }, // cadera alta
  { y: 106, rx: 13.0, rz: 9.4, cz: 0, n: 2.4 }, // cintura (mínimo)
  { y: 117, rx: 13.6, rz: 9.8, cz: 0, n: 2.4 }, // bajo pecho
  { y: 124, rx: 15.4, rz: 11.1, cz: 0, n: 2.4 }, // pecho (máximo)
  { y: 131, rx: 15.0, rz: 10.4, cz: 0, n: 2.4 }, // axila
  { y: 143, rx: 18.2, rz: 9.6, cz: 0, n: 2.5 }, // hombro
  { y: 150, rx: 6.2, rz: 5.6, cz: 0, n: 2.0 }, // base del cuello
];

/** Una pierna; se renderiza dos veces con offset en X (±8.5 cm). */
export const MOCK_LEG_RINGS: Ring[] = [
  { y: 8, rx: 3.5, rz: 3.2, cz: 0, n: 2.0 }, // tobillo
  { y: 30, rx: 5.7, rz: 5.2, cz: 0, n: 2.0 }, // pantorrilla
  { y: 48, rx: 5.8, rz: 5.4, cz: 0, n: 2.0 }, // rodilla
  { y: 64, rx: 7.6, rz: 6.7, cz: 0, n: 2.0 }, // muslo medio
  { y: 78, rx: 9.4, rz: 7.8, cz: 0, n: 2.0 }, // muslo alto
  { y: 88, rx: 10.2, rz: 8.4, cz: 0, n: 2.2 }, // unión con cadera
];

/** Separación entre piernas en cm (cada una se centra en ±LEG_OFFSET_X). */
export const LEG_OFFSET_X = 8.6;
