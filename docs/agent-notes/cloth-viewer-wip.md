# Prenda 3D — estado WIP (rama `feat/cloth-viewer`)

**Qué hay**
- `viewer3d/app.js` carga el maniquí CC0, lo deforma por medidas, calcula fit y ahora construye una prenda 3D.
- `viewer3d/garment-builder.js` recorta la superficie del cuerpo, aplica holgura por zona, relaja con gravedad/colisiones y añade remates (cuello, puños, bajo, cinturilla, capota, bolsillos, cremallera).
- Materiales PBR locales: 7 tejidos de Poly Haven (CC0) en `viewer3d/assets/tex/` + HDRI de estudio.
- Servidor estático sin dependencias: `node demo/vinted-mock/serve.mjs 8080`.

**Qué funciona**
- Camiseta, sudadera, vaquero, vestido, chaqueta y falda se construyen desde el listing.
- El veredicto y el heatmap siguen saliendo de las medidas; la prenda no toca el contrato de fit.
- La órbita, presets de talla y sliders siguen funcionando.

**Qué está roto / siguiente**
1. La base mesh es una media malla (corte sagital). Ahora se espeja en Z para el cuerpo y la prenda. Hay que revisar el sombreado de la mitad espejada (normales invertidas) y el encaje en el plano Z=0.
2. La manga se recorta de la malla real en A-pose. El largo de manga funciona por proyección sobre `upperarm01→wrist`, pero la copa de manga no tiene costura de sisa: se ve como una camiseta de neopreno en el hombro. Hay que añadir una copa/armhole seam.
3. El cuello/puños/bajo son tubos sobre el borde del recorte. El borde del recorte es escalonado; suavizar el loop o construir una banda de canalé de verdad.
4. Faltan detalles de chaqueta (solapa/forro), capucha con volumen real y bolsillos de vaquero con forma. Ahora hay versiones básicas.
5. El solver es una relajación de distancias + colisión direccional contra el vértice de origen. No es XPBD; para la demo da pliegues, pero conviene sustituirlo por un solver con restricciones de bending y autocolisión si da tiempo.
6. La luz está muy alta y el fondo claro se come la camiseta blanca. Bajar exposición / oscurecer el estudio.

**Cómo probar**
```bash
node demo/vinted-mock/serve.mjs 8080
# http://localhost:8080/viewer3d/?listing=uniqlo-tee-m
# http://localhost:8080/  → abre un anuncio → Ver cómo te queda
```

**Debug**
- `window.__spDebug.state`, `.scene`, `.camera`, `.controls`.
- `window.__spGarmentDebug = true` antes de cargar imprime bboxes de rest/settled.
