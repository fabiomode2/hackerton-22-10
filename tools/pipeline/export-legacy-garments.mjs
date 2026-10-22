#!/usr/bin/env node
/**
 * Exporta las prendas del motor geométrico antiguo (modelado3dRopa) para
 * simularlas en Blender sobre la malla real del visor.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const src = path.join(here, 'legacy', 'src');

for (const name of readdirSync(src)) {
  if (!name.endsWith('.ts')) continue;
  const file = path.join(src, name);
  const code = readFileSync(file, 'utf8').replace(
    /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (m, a, spec, b) => (spec.endsWith('.ts') ? m : `${a}${spec}.ts${b}`),
  );
  writeFileSync(file, code);
}
writeFileSync(path.join(src, 'package.json'), '{"type":"module"}');

const { buildGarment, defaultAnchors, FABRIC_SPEC } = await import(pathToFileURL(path.join(src, 'garment.ts')).href);
const { buildPanelMesh } = await import(pathToFileURL(path.join(src, 'mesh.ts')).href);

const listings = JSON.parse(readFileSync(path.join(repoRoot, 'demo', 'vinted-mock', 'listings.json'), 'utf8'));
const HEROES = ['uniqlo-tee-m', 'carhartt-hoodie-m', 'levis-501-w32', 'zara-slip-dress-s', 'vintage-leather-jacket', 'cos-midi-skirt-38'];
const outDir = path.join(here, 'out');
mkdirSync(outDir, { recursive: true });

const manifest = [];
for (const id of HEROES) {
  const listing = listings.find((l) => l.id === id);
  if (!listing) throw new Error(`No listing ${id}`);
  const model = buildGarment(listing.garment, listing.body);
  const anchors = defaultAnchors(listing.body);
  const panels = model.panels.map((panel) => {
    const mesh = buildPanelMesh(panel, 96);
    return {
      name: panel.name,
      zone: panel.zone,
      closed: panel.closed,
      theta: panel.theta ?? null,
      positions: Array.from(mesh.positions, (v) => Math.round(v * 1e6) / 1e6),
      indices: Array.from(mesh.indices),
      uvs: Array.from(mesh.uvs, (v) => Math.round(v * 1e6) / 1e6),
    };
  });
  const item = {
    id,
    title: listing.title,
    type: listing.garment.type,
    fabric: listing.garment.fabric,
    thickness_cm: (FABRIC_SPEC[listing.garment.fabric] || FABRIC_SPEC.cotton_jersey).thickness_cm,
    body: listing.body,
    anchors,
    measurements: listing.garment.measurements,
    circumferences: model.circumferences,
    ease: model.ease,
    panels,
  };
  manifest.push(item);
  writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(item));
  const verts = panels.reduce((n, p) => n + p.positions.length / 3, 0);
  console.log(`${id}: ${panels.map((p) => p.name).join(', ')} · ${verts} vértices`);
}
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('OK');
