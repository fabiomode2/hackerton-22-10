# Pipeline de prendas 3D (Blender → GLB → visor)

Este directorio contiene el pipeline offline para sustituir la prenda
“segunda piel” por una prenda real, simulada con tela y exportada a GLB.

## Qué hay

- `export-legacy-garments.mjs` — exporta las prendas paramétricas del motor
  geométrico antiguo (`modelado3dRopa`) a JSON (posiciones en metros).
- `import_viewer_body.py` — importa en Blender la malla exacta del maniquí del
  visor (posiciones + grupos + articulaciones), exportada desde el navegador.
- `simulate_garment.py` — simula una prenda con Blender Cloth sobre el maniquí
  del visor, graba la animación cuantizada (`SPCL`) y exporta GLB.
- `build_mannequin.py` — maniquí procedural de respaldo (sin depender del GLB
  base) para pruebas de escala y colisiones.
- `legacy/src/` — copia de `garment.ts`, `mesh.ts`, etc. del motor antiguo,
  usada por el exportador. No forma parte del runtime.

## Flujo

1. Abrir el visor y exportar la malla del maniquí:

   ```bash
   node tools/pipeline/save-body-server.mjs
   # en la consola del visor:
   # POST http://localhost:8099/save-body
   ```

2. Importar el cuerpo en Blender:

   ```bash
   blender -b --python tools/pipeline/import_viewer_body.py
   ```

3. Exportar las prendas:

   ```bash
   node tools/pipeline/export-legacy-garments.mjs
   ```

4. Simular una prenda:

   ```bash
   blender -b --python tools/pipeline/simulate_garment.py -- \
     tools/pipeline/out/uniqlo-tee-m.json 60
   ```

   Genera `out/<id>.glb` (malla final) y `out/<id>.cloth.bin` (posiciones por
   frame cuantizadas a 16 bits).

## Limitaciones

- El bake usa `frame_set` paso a paso, no `ptcache.bake_all` (en Blender 5.2
  el operador de caché en disco es mucho más lento).
- El GLB y el `.cloth.bin` deben compartir el orden de vértices; se generan
  desde la misma pila de modificadores. Si se añade Solidify, hay que incluirla
  también en la grabación de la animación.
- Las mangas del motor antiguo están pensadas para brazos hacia abajo; para el
  visor en A-pose hay que sustituirlas por tubos sobre `armJoints` o posar el
  cuerpo.

Los renders y los `.blend`/`.glb` generados no se commitean.
