# Prenda 3D — estado WIP (base `feat/cloth-viewer`, ajuste en `feat/jeans-fit`)

**Qué hay**
- `viewer3d/app.js` carga el maniquí CC0, lo deforma por medidas, calcula fit y construye una prenda 3D.
- `viewer3d/garment-builder.js` recorta la superficie del cuerpo, aplica holgura por zona, relaja con gravedad/colisiones y añade remates (cuello, puños, bajo, cinturilla, capota, bolsillos, cremallera).
- Materiales PBR locales: 7 tejidos de Poly Haven (CC0) en `viewer3d/assets/tex/` + HDRI de estudio.
- Servidor estático sin dependencias: `node demo/vinted-mock/serve.mjs 8080` o `python3 -m http.server 8080` desde la raíz.
- **Vaquero (`feat/jeans-fit`)**: cintura anclada a la cintura real del maniquí, tiro declarado en la auditoría, bajo desde `hem_cm`, holgura de tiro reducida y suavizado local del asiento.

**Qué funciona**
- Camiseta, sudadera, vaquero, vestido, chaqueta y falda se construyen desde el listing.
- El veredicto y el heatmap siguen saliendo de las medidas; la prenda no toca el contrato de fit.
- La órbita, presets de talla y sliders siguen funcionando.
- El vaquero pasa QA en Levi's W32 y Weekday mom 38, y en presets XS/Plus/Mi cuerpo: sin NaN, sin errores de consola y con `meta.audit` expuesto.

**Arreglado en `feat/jeans-fit`**
1. El espejo duplicado ya se había eliminado en `main`; esta rama parte de ese estado y no lo reintroduce.
2. `waistbandY = waistY + 0.005`: la cinturilla cae en la cintura real del maniquí, no flota sobre el tiro declarado.
3. `hemY = max(ankleY + 0.012, crotchY − inseam_cm)`; se eliminó el factor `0.92`.
4. `hem_cm` del listing manda en el bajo (target 38 cm en el 501; 34 cm en el mom).
5. La holgura del tiro no hereda todo el muslo: control específico en `crotchY` (55 % del muslo, mínimo 4,5 mm) y suavizado Laplaciano local del asiento/tiro.
6. Solver más rígido para denim (8 iteraciones, gravedad baja) y pliegues más sutiles.
7. `garment.meta.audit` devuelve `waistbandY_cm`, `hemY_cm`, `rise_cm`, `inseam_cm`, `waistTarget_cm`, `thighTarget_cm`, `hemTarget_cm` y `hemEase_cm`.

**Qué está roto / siguiente**
1. El resto de prendas sigue usando el espejo histórico (el cuerpo ya es una malla completa). El vestido actual tiene geometría NaN (problema preexistente, no del vaquero).
2. La manga se recorta de la malla real en A-pose. El largo de manga funciona por proyección sobre `upperarm01→wrist`, pero la copa de manga no tiene costura de sisa: se ve como una camiseta de neopreno en el hombro. Hay que añadir una copa/armhole seam.
3. El cuello/puños/bajo son tubos sobre el borde del recorte. El borde del recorte es escalonado; suavizar el loop o construir una banda de canalé de verdad.
4. Faltan detalles de chaqueta (solapa/forro), capucha con volumen real y bolsillos de vaquero con forma. Ahora hay versiones básicas.
5. El solver es una relajación de distancias + colisión direccional contra el vértice de origen. No es XPBD; para la demo da pliegues, pero conviene sustituirlo por un solver con restricciones de bending y autocolisión si da tiempo.
6. La luz está muy alta y el fondo claro se come la camiseta blanca. Bajar exposición / oscurecer el estudio.
7. El tiro sigue siendo un **recorte de la superficie del cuerpo**, no una topología de pantalón con tubo de cadera + perneras + gusset. El resultado actual no clipea y tiene tiro/cintura correctos, pero la entrepierna aún puede mejorar con esa topología.

**Cómo probar**
```bash
node demo/vinted-mock/serve.mjs 8080
# http://localhost:8080/demo/vinted-mock/viewer3d/?listing=levi-501-w32
# http://localhost:8080/demo/vinted-mock/viewer3d/?listing=weekday-mom-jeans-38
# http://localhost:8080/  → abre un anuncio → Ver cómo te queda
```

**Debug**
- `window.__spDebug.state`, `.scene`, `.camera`, `.controls`.
- `window.__spDebug.state.garment.meta.audit` para tiro, entrepierna y targets.
- `window.__spGarmentDebug = true` antes de cargar imprime bboxes de rest/settled.
