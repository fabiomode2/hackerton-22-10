#!/usr/bin/env node
/**
 * Exporta las prendas paramétricas del fit-engine a un manifiesto que Blender
 * puede importar (posiciones en metros + índices + metadatos por panel).
 *
 *   node tools/pipeline/export-garments.mjs
 *   node tools/pipeline/export-garments.mjs --only uniqlo-tee-m
 *
 * No modifica el fit-engine: usa la copia temporal de ts-runtime.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const fitScripts = path.join(repoRoot, 'packages', 'fit-engine', 'scripts');
const { prepareTsRuntime } = await import(pathToFileURL(path.join(fitScripts, 'ts-runtime.mjs')).href);

const tmp = prepareTsRuntime();
const { buildGarment, defaultAnchors } = await import(
  pathToFileURL(path.join(tmp, 'src', 'garment.ts')).href
);
const { buildPanelMesh } = await import(pathToFileURL(path.join(tmp, 'src', 'mesh.ts')).href);
const { FABRIC_SPEC } = await import(pathToFileURL(path.join(tmp, 'src', 'garment.ts')).href);

const listings = JSON.parse(readFileSync(path.join(repoRoot, 'demo', 'vinted-mock', 'listings.json'), 'utf8'));

// Una prenda por combinación tipo+tejido. El resto de listings son variantes
// de color/talla y reutilizan el mismo GLB.
const HEROES = [
  'uniqlo-tee-m',
  'carhartt-hoodie-m',
  'levis-501-w32',
  'zara-slip-dress-s',
  'vintage-leather-jacket',
  'cos-midi-skirt-38',
];

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : null;

const outDir = path.join(here, 'out');
mkdirSync(outDir, { recursive: true });

const manifest = [];

for (const id of HEROES) {
  if (only && id !== only) continue;
  const listing = listings.find((item) => item.id === id);
  if (!listing) throw new Error(`Listing no encontrado: ${id}`);

  const model = buildGarment(listing.garment, listing.body);
  const anchors = defaultAnchors(listing.body);
  const spec = FABRIC_SPEC[listing.garment.fabric] ?? FABRIC_SPEC.cotton_jersey;

  const panels = model.panels.map((panel) => {
    // 96 segmentos: suficiente para simular arrugas finas sin explotar el bake.
    const mesh = buildPanelMesh(panel, 96);
    return {
      name: panel.name,
      zone: panel.zone,
      closed: panel.closed,
      theta: panel.theta ?? null,
      folds: panel.folds ?? 0,
      positions: Array.from(mesh.positions, (v) => Math.round(v * 1e6) / 1e6),
      indices: Array.from(mesh.indices),
      uvs: Array.from(mesh.uvs, (v) => Math.round(v * 1e6) / 1e6),
      normals: Array.from(mesh.normals, (v) => Math.round(v * 1e5) / 1e5),
    };
  });

  const vertexCount = panels.reduce((total, panel) => total + panel.positions.length / 3, 0);
  const triangleCount = panels.reduce((total, panel) => total + panel.indices.length / 3, 0);

  const item = {
    id,
    title: listing.title,
    type: listing.garment.type,
    fabric: listing.garment.fabric,
    thickness_cm: spec.thickness_cm,
    stiffness: spec.stiffness,
    body: listing.body,
    anchors,
    measurements: listing.garment.measurements,
    circumferences: model.circumferences,
    ease: model.ease,
    vertexCount,
    triangleCount,
    panels,
  };

  manifest.push(item);
  writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(item));
  console.log(`${id}: ${panels.map((p) => p.name).join(', ')} · ${vertexCount} vértices · ${triangleCount} triángulos`);
}

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nManifiesto: ${path.join(outDir, 'manifest.json')}`);
