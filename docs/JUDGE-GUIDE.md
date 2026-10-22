# Guía del jurado — outfit check en 5 minutos

> **Para qué sirve este documento.** Para que cualquier persona pueda evaluar el proyecto sin que se lo contemos nosotros. Está escrito como un recorrido: qué tocar, qué mirar y qué prueba cada cosa.

---

## 1. Si solo tienes 60 segundos

1. Abre la **[demo](https://hack.cesura.duckdns.org/demo/vinted-mock/?id=carhartt-hoodie-m)**.
2. Toca **Ver cómo te queda**.
3. Mira el veredicto: *"Te queda holgado"*, **+17,8 cm** en pecho, **93 %** de confianza.
4. Cambia la talla del maniquí de **M** a **Plus**.
5. Mira cómo el cuerpo, la prenda y el veredicto cambian.

Eso es el producto: **un anuncio, un cuerpo, una respuesta antes de pagar**.

---

## 2. Si tienes 5 minutos

| Parada | Qué hacer | Qué mirar | Qué prueba |
|---|---|---|---|
| **1. El feed** | Abre `/demo/vinted-mock/` | 12 anuncios, 2 por tipo, filtros, búsqueda, favoritos, badge *Prueba 3D* | La demo es un marketplace, no una landing |
| **2. El anuncio** | Abre la sudadera Carhartt | Precio, medidas en la descripción, vendedor, CTA fijo | El dato que usa el motor ya está en el listing |
| **3. El probador** | Toca el CTA | Maniquí 3D, prenda, panel de fit, confianza, medidas | El 3D y el veredicto están integrados en la ficha |
| **4. El cuerpo** | Cambia el preset **M → Plus** | El cuerpo se regenera; la sudadera pasa de holgada a justa/pequeña | El veredicto depende del cuerpo, no de una talla genérica |
| **5. El heatmap** | Pulsa **Ver mapa de tensión** | Colores por zona: rojo/ámbar/verde/azul | La tensión tiene una escala y una leyenda, no es decoración |
| **6. Mi maniquí** | Pestaña **Mi maniquí** → ajusta una medida → **Guardar** → recarga | El perfil persiste en el dispositivo | El cuerpo es del usuario y no sale del navegador |
| **7. El deck** | Abre `/deck/` | Slides con la demo embebida, foco a pantalla completa | La narrativa y el producto son el mismo artefacto |

**El momento que importa:** mismo anuncio, dos cuerpos, dos veredictos. Si el jurado solo recuerda una cosa, que sea esa.

---

## 3. Si tienes 15 minutos (ruta técnica)

### 3.1. La fórmula

Pide que te enseñen `computeFit()` en `demo/vinted-mock/viewer3d/app.js`. La línea clave:

```js
const ease = garmentCm - bodyCm - overhead;
```

- `garmentCm` sale de las medidas planas del listing (`× 2`).
- `bodyCm` sale del perfil del usuario.
- `overhead` es `2π · grosor` del tejido.

El veredicto se clasifica con `classifyEase()` y las bandas de `FIT_BANDS`. No hay una caja negra: hay una resta.

### 3.2. La geometría

Pide que te enseñen `buildGarment()` en `viewer3d/garment-builder.js`:

1. `buildClearance()` convierte la holgura en separación radial.
2. `buildTopPatch()` / `buildPleatedPanel()` recortan la superficie del cuerpo.
3. `relax()` aplica gravedad, restricciones de distancia y colisión contra el maniquí.
4. `addFabricFolds()` añade pliegues deterministas.
5. Los remates (cuello, puños, cinturilla, capucha, bolsillos) se añaden como tubos/bandas.

La prenda no está modelada a mano. Se genera.

### 3.3. El motor de cuerpo

Pide `packages/fit-engine/src/body.ts`. El pipeline es:

```
BodyProfile → resolveBodyProfile() → computeTorsoLayout()
           → buildTorso() / buildLeg() / buildArm()
           → validateGeometry()
```

Los anillos son superelipses; las circunferencias se resuelven por bisección; los landmarks se calculan desde la altura y las medidas. El check numérico está en `packages/fit-engine/scripts/check-body.ts`.

### 3.4. Los límites

Pide `docs/CLAIMS.md`. Ahí está lo que es `REAL`, `DEMO` y `ROADMAP`. Si un claim no está, no está probado.

---

## 4. Preguntas que nos gusta que nos hagan

| Pregunta | Respuesta corta | Evidencia |
|---|---|---|
| **¿Esto no es solo un render bonito?** | El color del heatmap es el veredicto de una resta. Si dice +17,8 cm, hay una resta de 112 − 92 − 2,2. | `computeFit()`; `docs/ENGINE.md` §6 |
| **¿De dónde sale la geometría de la prenda?** | De la malla del cuerpo + las medidas planas. Se recorta, se separa por holgura y se relaja. Sin Blender. | `garment-builder.js`; `docs/ENGINE.md` §5 |
| **¿Y si el vendedor mide mal?** | El motor clampa, avisa y muestra `confidence` y `missing`. No inventa una medida que no existe. | `resolveBodyProfile()`, `computeFit()`; `docs/CLAIMS.md` P02/P03/P15 |
| **¿Por qué Vinted os dejaría entrar?** | Extensión primero (cero integración), SDK después, nativo al final. La demo ya prueba el iframe. | `docs/PLAN.md` §6; `viewer.js` |
| **¿No es caro de escalar?** | WebGL en el cliente, cero assets por listing, base mesh CC0 reutilizable. El coste marginal tiende a 0. | `docs/PLAN.md` §7; `README.md` |
| **¿Y la privacidad?** | No hay backend, no hay fotos, no hay tracking. El cuerpo vive en `localStorage`. | `docs/ARCHITECTURE.md` §8; `viewer3d/app.js` |
| **¿Qué pasa con cuerpos diversos?** | El maniquí se construye desde *tus* medidas, no desde un ideal. Presets XS–Plus, rasgos de forma y medidas opcionales. | `body-profile.ts`; `body-intent.ts`; `viewer3d/app.js` |
| **¿Por qué no un LLM que lo haga todo?** | Porque un LLM alucina centímetros y no es auditable. El LLM decide y explica; el motor mide. | `docs/pipeline.md`; `docs/DECISIONS.md` ADR-007 |
| **¿Qué falta?** | `fit.ts` definitivo, costura de sisa/cuello, visión en vivo, extensión/SDK. Está en el roadmap. | `docs/CLAIMS.md`; `docs/QUALITY.md` |
| **¿Cómo sé que funciona?** | Se puede arrancar sin red, con un servidor estático, y el check del motor pasa. | `README.md`; `docs/QUALITY.md` |
| **¿Escala a 500 M de listings?** | No modelamos 500 M de prendas: generamos la geometría desde medidas. Es el foso frente a Zeekit/3DLOOK. | `docs/PLAN.md` §7; `garment-builder.js` |
| **¿Por qué no AR?** | Otro runtime, otro presupuesto, otra demo. Es roadmap, no MVP. | `docs/PLAN.md` §4; `docs/CLAIMS.md` P30 |

---

## 5. Cómo verificar que no es humo

### 5.1. Sin red

Abre DevTools → Network, recarga el visor. No hay peticiones externas: Three.js, GLB, HDRI, texturas y fuentes son locales. El servidor es estático.

### 5.2. Sin build

No hay `npm install`, no hay `package.json` en la raíz, no hay `vite`. El repo se sirve tal cual con `http.server` o `serve.mjs`.

### 5.3. Con números

En la consola del viewer, después de cargar un anuncio:

```js
// Inspeccionar el fit-lite en vivo
window.__spDebug.state.fit
// {
//   verdict: 'loose',
//   ease_cm: 17.8,
//   zones: [{ name: 'Pecho', ease_cm: 17.8, body_cm: 92, garment_cm: 112, ... }],
//   confidence: 0.93,
//   missing: [],
//   band: { tooSmall: 2, tight: 8, regular: 16, loose: 28 },
//   thickness: 0.35
// }
```

La verificación numérica fuerte del motor de cuerpo está en el repo:

```bash
npx --yes tsx packages/fit-engine/scripts/check-body.ts
```

### 5.4. Con el ledger

`docs/CLAIMS.md` dice qué es real, qué es demo y qué es roadmap. Si el pitch dice algo que no está ahí, el pitch está mal, no el ledger.

### 5.5. Con el código

| Si quieres ver... | Abre... |
|---|---|
| El contrato | `packages/fit-engine/src/types.ts` |
| La geometría del cuerpo | `packages/fit-engine/src/body.ts` |
| Los priors y la confianza | `packages/fit-engine/src/body-profile.ts` |
| La prenda | `demo/vinted-mock/viewer3d/garment-builder.js` |
| El fit | `demo/vinted-mock/viewer3d/app.js` → `computeFit()` |
| La integración | `demo/vinted-mock/viewer.js` |
| La narrativa | `deck/slides/` |
| Las decisiones | `docs/DECISIONS.md` |

---

## 6. URLs

### Producción del hackathon

| Qué | URL |
|---|---|
| Landing | `https://hack.cesura.duckdns.org/` |
| Deck | `https://hack.cesura.duckdns.org/deck/` |
| Demo Vinted | `https://hack.cesura.duckdns.org/demo/vinted-mock/` |
| Anuncio héroe | `https://hack.cesura.duckdns.org/demo/vinted-mock/?id=carhartt-hoodie-m` |
| Visor | `https://hack.cesura.duckdns.org/viewer/` |
| Visor directo | `https://hack.cesura.duckdns.org/demo/vinted-mock/viewer3d/?listing=carhartt-hoodie-m` |
| Previews por rama | `https://hack.cesura.duckdns.org/preview/` |

### Local

```bash
node demo/vinted-mock/serve.mjs 8080
# Demo:  http://localhost:8080/
# Visor: http://localhost:8080/viewer3d/?listing=carhartt-hoodie-m

PORT=8080 ./deck/start.sh
# Deck:  http://localhost:8080/deck/
# Demo:  http://localhost:8080/demo/vinted-mock/
```

> La producción puede caducar cuando termine el hackathon. La demo local siempre está en el repo.

---

## 7. Si algo falla

| Fallo | Qué hacer |
|---|---|
| El GLB o un asset del 3D falla | El visor muestra un panel de error con **Reintentar**; el resto del marketplace sigue |
| WebGL no está disponible | No hay fallback 2D; el visor no arranca. Es un límite conocido |
| El iframe no responde | A los 15 s aparece un estado de estudio con **Reintentar** y **Abrir en pestaña** |
| El HDRI falla | El visor usa `RoomEnvironment`; el look cambia, la función no |
| Las texturas fallan | La prenda se ve sin mapas; el fit sigue |
| No hay `localStorage` | La sesión funciona; el maniquí no persiste |
| No hay red | La demo local funciona; la producción solo necesita el servidor estático |
| El jurado pregunta por el vídeo | No hay un vídeo final en el repo; hay footage y un preview local. La demo en vivo es el entregable |

---

## 8. El guion de 90 segundos

Si quieres presentarlo tú:

1. **0:00** — "Este es un anuncio normal de Vinted. 32 €, talla M, medidas en la descripción."
2. **0:10** — Click en **Ver cómo te queda**. "Un click."
3. **0:20** — "Este es mi cuerpo: 175, pecho 92, cintura 78."
4. **0:30** — Gira la prenda. "La prenda se genera desde las medidas. No hay modelado 3D por anuncio."
5. **0:45** — "Pecho: +17,8 cm de holgura. El veredicto es *holgado*. La confianza, 93 %."
6. **1:00** — Cambia a **Plus**. "Mismo anuncio. Otro cuerpo. Otra respuesta."
7. **1:15** — "Y todo esto corre en el navegador, sin subir una sola foto."
8. **1:25** — Cierre: *"Vinted ya tiene las medidas. Tú ya tienes el cuerpo. Solo falta el espejo."*

El guion completo, con tiempos y Q&A, está en [pitch.md](pitch.md).

---

## 9. Qué no vas a ver

- Un cuerpo escaneado con la cámara.
- Una simulación de tela real.
- Una integración nativa con Vinted.
- Un LLM calculando la talla.
- Una extensión de Chrome.
- AR en el móvil.

Todo eso está en el roadmap, no en la demo. Si alguien lo promete en el escenario, está contradiciendo el ledger.

---

<div align="center">
<sub>La mejor forma de impresionar a un jurado no es enseñar más features. Es enseñar exactamente lo que funciona y saber explicar por qué.</sub>
</div>
