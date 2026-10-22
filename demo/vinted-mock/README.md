# Demo móvil tipo Vinted — outfit check

Marketplace local de segunda mano, en formato móvil, que sirve de envoltorio para el probador 3D. **Sin build, sin dependencias y sin red**: se abre con un servidor estático y todo lo que necesita está en esta carpeta.

> Mock para la demo del hackathon. No está afiliado a Vinted ni usa su API. La marca y el layout se reproducen solo como escenario de producto.

## Arrancar

```bash
# Desde la raíz del repo, para que /deck/ y /demo/ compartan origen.
python3 -m http.server 8080
```

Abrir: <http://localhost:8080/demo/vinted-mock/>

## Viewer 3D integrado

El CTA abre el viewer local `viewer3d/` en un iframe con:

```
?listing=<id>&embed=1
```

No hay que levantar un segundo servidor: todo se sirve desde esta misma carpeta. El viewer carga una base mesh CC0, la deforma con las 6 medidas del anuncio, la pinta con ropa interior y calcula el veredicto con las medidas planas de la prenda. Incluye presets de talla XS–Plus y sliders de cuerpo. **No renderiza la prenda todavía** (cuerpo + veredicto).

Para apuntar a otro viewer (por ejemplo, un Vite externo) sigue funcionando:

```
http://localhost:8080/?viewer=http://localhost:5173
http://localhost:8080/?viewer=./viewer3d/
```

Si el viewer no está disponible, el drawer muestra a los 5 s un estado de estudio con un maniquí, un botón **Reintentar** y un enlace **Abrir en pestaña**.

### Contrato de integración

El CTA llama a:

```js
window.FitViewer.open(listing);
```

`listing` es el objeto completo de `data.js` (incluye `id`, `title`, `size_label`, `garment`, `body` y `photos`).

API disponible:

```js
window.FitViewer.open(listing);
window.FitViewer.close();
window.FitViewer.setUrl('http://localhost:5174');
window.FitViewer.isOpen();
window.FitViewer.getUrl();
```

El viewer debe avisar cuando esté montado para que desaparezca la capa de carga:

```js
parent.postMessage({ type: 'segunda:ready' }, '*');
```

También puede cerrar el drawer o reportar altura:

```js
parent.postMessage({ type: 'segunda:close' }, '*');
parent.postMessage({ type: 'segunda:height', height: 820 }, '*');
```

**Escape:** si el foco está dentro del iframe, el navegador no propaga la tecla a la página padre. Para que Escape cierre el drawer desde dentro del viewer, el viewer debe escuchar `Escape` y enviar `{ type: 'segunda:close' }`. Mientras tanto, la X del header siempre funciona.

## URLs útiles

| URL | Qué hace |
|---|---|
| `/` | Home con los 12 anuncios |
| `/?id=carhartt-hoodie-m` | Anuncio héroe (sudadera) |
| `/?id=uniqlo-tee-m` | Camiseta blanca |
| `/?id=levis-501-w32` | Vaquero Levi's |
| `/?id=zara-slip-dress-s` | Vestido negro |
| `/?id=vintage-leather-jacket` | Cazadora de piel |
| `/?id=levis-trucker-jacket-m` | Chaqueta denim |
| `/viewer3d/?listing=carhartt-hoodie-m` | Viewer 3D a pantalla completa |
| `/?viewer=http://localhost:5174` | Conecta el iframe a otro puerto |
| `/?id=uniqlo-tee-m&viewer=http://localhost:5174` | Deep link + viewer |

## Flujo de demo (60–90 s)

1. Home llena: 12 anuncios, 2 columnas, filtros por categoría y búsqueda.
2. Scroll lento por el feed. Tocar el primer anuncio (lleva el distintivo **Prueba 3D**).
3. En la ficha, enseñar precio, medidas y vendedor. El CTA **Ver cómo te queda** está siempre fijo abajo.
4. Click en el CTA → drawer del probador con el anuncio y la talla.
5. Enseñar veredicto, holgura por zona, ropa interior y cambio de cuerpo con presets (XS–Plus) y sliders.
6. Cerrar con la X (o con Escape si el viewer lo reenvía).
7. Volver al feed y abrir otro anuncio para demostrar que el sistema es general.

La barra inferior y las acciones secundarias (Vender, Perfil, Comprar) muestran un toast: están fuera del alcance de esta demo. **Presentación** abre el deck en una pestaña nueva (el deck incluye esta misma demo en su slide de demo).

## Los 12 anuncios

Hay **2 prendas de cada tipo** del contrato del motor (`hoodie`, `tshirt`, `jeans`, `dress`, `jacket`, `skirt`), 6 de hombre y 6 de mujer. Los ids son estables y se usan en el iframe.

| id | Prenda | Tipo | Precio | Talla |
|---|---|---|---|---|
| `carhartt-hoodie-m` | Sudadera Carhartt | hoodie | 32 € | M |
| `uniqlo-tee-m` | Camiseta Uniqlo | tshirt | 8 € | M |
| `levis-501-w32` | Levi's 501 | jeans | 25 € | W32 L32 |
| `zara-slip-dress-s` | Vestido lencero | dress | 18 € | S |
| `vintage-leather-jacket` | Cazadora de piel | jacket | 65 € | M |
| `cos-midi-skirt-38` | Falda plisada | skirt | 20 € | 38 |
| `nike-club-hoodie-l` | Sudadera Nike | hoodie | 21 € | L |
| `acne-studios-tee-s` | Camiseta negra | tshirt | 27 € | S |
| `weekday-mom-jeans-38` | Vaqueros mom | jeans | 19 € | 38 |
| `mango-linen-dress-m` | Vestido de lino | dress | 24 € | M |
| `levis-trucker-jacket-m` | Chaqueta denim | jacket | 30 € | M |
| `zara-satin-skirt-s` | Falda satinada | skirt | 15 € | S |

## Fotos

- `assets/products/<id>/01.jpg` — foto principal, recortada a 3:4 (800 × 1067).
- `assets/products/<id>/02.jpg` — detalle para el carrusel.
- Peso total: ~2,4 MB.
- Fotografías de **Pexels** y **Unsplash**, licencias libres; recortadas y optimizadas para la demo. No son fotos de listings reales de Vinted.
- Si falta una foto, la UI genera un placeholder con el monograma de la marca; la demo sigue viéndose bien.

## Estructura

```
demo/vinted-mock/
├── index.html      shell móvil + orden de scripts
├── styles.css      sistema visual, home, detalle, marco de móvil
├── app.js          SPA: router, filtros, favoritos, carrusel, toasts
├── data.js         catálogo mock (window.LISTINGS / window.CATEGORIES)
├── listings.json   mismo catálogo en JSON
├── viewer.js       drawer + API FitViewer + handshake
├── viewer.css      estilos del drawer
├── viewer3d/       visor 3D: base mesh CC0, deformación y veredicto
├── assets/         fotos locales
└── fonts/          Inter y Nunito locales
```

## Qué es real y qué no

- **Real:** layout, navegación, filtros, búsqueda, favoritos, ficha, medidas, carrusel, drawer, integración por iframe y fallback.
- **Real (prototipo):** el visor `viewer3d/` genera un maniquí a partir de las 6 medidas y calcula la holgura con las medidas del anuncio.
- **Demo:** la deformación de la base mesh es aproximada y el cálculo de fit del visor es una vista previa local; el motor definitivo es `packages/fit-engine/src/fit.ts` (Jaime).
- **Mock:** catálogo, vendedores, fotos, precios y valoraciones.

## QA rápido

```bash
node --check app.js
node --check data.js
node --check viewer.js
node --check viewer3d/app.js
```

Comprobado con Chromium headless a 320×700, 390×844, 430×932 y 1440×900: 12 tarjetas, 12 imágenes cargadas, filtros, búsqueda sin acentos, estado vacío, favoritos persistentes, deep links, carrusel, CTA sin viewer (fallback) y CTA con viewer (handshake + cierre).
