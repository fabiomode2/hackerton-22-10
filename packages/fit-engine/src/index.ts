export * from './types';
export * from './mock-body';
export * from './body-profile';
export * from './body-intent';
export * from './body';

// Dev 1 añadirá: export { buildGarment } from './garment';
// Dev 2 añadirá: export { computeFit } from './fit';

// Convención de import en el viewer (sin workspace, alias de Vite):
//   import { MOCK_TORSO_RINGS, cm } from '@fit-engine';
// vite.config.ts:
//   resolve: { alias: { '@fit-engine': path.resolve(__dirname, '../../packages/fit-engine/src') } }
