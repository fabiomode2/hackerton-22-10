#!/usr/bin/env node
/**
 * Servidor temporal para sacar la malla deformada del maniquí del visor y
 * llevarla a Blender. Solo escucha en localhost.
 *
 *   node tools/pipeline/save-body-server.mjs
 *   POST /save-body?meta=<urlencoded JSON>  (body binario: pos, norm, idx, groups)
 */

import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
const port = Number(process.argv[2] || 8099);

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method !== 'POST' || !req.url?.startsWith('/save-body')) {
    return res.writeHead(404).end('not found');
  }
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const meta = JSON.parse(url.searchParams.get('meta') || '{}');
      const data = Buffer.concat(chunks);
      writeFileSync(path.join(out, 'viewer-body.bin'), data);
      writeFileSync(path.join(out, 'viewer-body-meta.json'), JSON.stringify(meta, null, 2));
      console.log(`body: ${data.length} bytes · ${meta.vertexCount} verts · ${meta.indexCount} indices`);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, bytes: data.length }));
    } catch (error) {
      console.error(error);
      res.writeHead(500).end(String(error));
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`save-body en http://localhost:${port}/save-body`);
});
