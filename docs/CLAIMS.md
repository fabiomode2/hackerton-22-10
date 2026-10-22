# CLAIMS — ledger de lo que el proyecto puede decir

> **Este es el ledger canónico.** `docs/pitch.md` contiene el guion y su propia tabla de escenario; si hay discrepancia, manda este documento.
> Regla: **un claim sin evidencia no se dice**. Y si se dice, se dice con su límite.

Última revisión: **22/10/2026**.

---

## 1. Estados

| Estado | Significado | Qué implica |
|---|---|---|
| **REAL** | Implementado y visible en la demo o ejecutable en el repo | Se puede enseñar sin asteriscos |
| **REAL (X)** | Implementado y verificado, pero acotado a un ámbito: motor, mock, infra, proceso | Se explica el ámbito antes de enseñarlo |
| **REAL (WIP)** | Implementado, con acabados o partes en revisión | Se enseña, pero se dice qué falta |
| **DEMO** | Funciona con datos mock, precalculados o una simplificación deliberada | Se enseña como demo, no como producción |
| **PARCIAL** | Una parte existe y otra no | Se nombra exactamente qué falta |
| **ROADMAP** | Diseñado, documentado o prototipado fuera de la demo; no shipped | Se enseña en slide, nunca como producto |
| **ESTIMATE** | Cálculo propio con supuestos declarados | Se etiqueta como estimación, no como dato |

---

## 2. Producto

| # | Claim | Estado | Evidencia | Límite |
|---|---|---|---|---|
| P01 | El cuerpo se construye desde 6 medidas base + medidas opcionales | **REAL** | `packages/fit-engine/src/body-profile.ts` → `resolveBodyProfile()`; `body.ts` → `buildBody()` | El cuerpo visible es una base mesh CC0 deformada; el motor calcula perfil, landmarks y anillos, no una malla desde cero |
| P02 | Las medidas que faltan se infieren con priors y se marcan como inferidas | **REAL** | `resolveBodyProfile()`; `ResolvedBodyProfile.inferred` | Un valor inferido nunca se presenta como medido |
| P03 | Las medidas fuera de rango se clampan y generan avisos | **REAL** | `readMeasurement()`, `BODY_LIMITS`, `BodyWarning` | El aviso se muestra en el modelo de datos; la UI de la demo no despliega todos los warnings |
| P04 | El perfil tiene una confianza compuesta (cobertura + consistencia) | **REAL** | `resolveBodyProfile()`: `0.7 · coverage + 0.3 · consistency` | Es una heurística, no una probabilidad calibrada |
| P05 | Los rasgos cualitativos ("hombros anchos", "complexión atlética") se traducen a forma | **REAL (motor)** | `body-intent.ts` → `interpretBodyTraits()`, `applyBodyIntent()` | No hay campo de texto libre en la UI de la demo; el motor está listo, la fachada no |
| P06 | El maniquí se genera con una base mesh CC0 y se deforma con los anillos del motor | **REAL** | `viewer3d/app.js` → `loadModel()`, `deform()`; `assets/female-base.glb`, `male-base.glb` | La deformación es aproximada; no es un avatar escaneado ni SMPL |
| P07 | El maniquí es abstracto: sin cara, pelo, ojos ni textura de piel | **REAL** | `buildHeadModel()`, `buildGroupWeights()`; documentado en `viewer3d/README.md` | Es una decisión de producto y privacidad, no fotorrealismo |
| P08 | Hay ropa interior procedural (boxer/bragas + sujetador) y presets XS–Plus | **REAL** | `app.js` → `updateUnderwear()`, `PRESETS`; `styles.css` | La ropa interior es máscara de fragmento + bandas 3D, no una prenda simulada |
| P09 | El usuario puede guardar su maniquí en el dispositivo | **REAL** | `app.js` → `savePersonalProfile()`, `loadSavedPersonalProfile()`; clave `segunda-piel:personal-mannequin:v1` | Solo `localStorage`; no se sincroniza entre dispositivos y se pierde al borrar datos |
| P10 | La prenda 3D se genera desde la malla del cuerpo + medidas del listing | **REAL (WIP)** | `viewer3d/garment-builder.js` → `buildGarment()`, `buildTopPatch()`, `buildPleatedPanel()` | La sisa/cuello y el sombreado de la media malla espejada siguen en revisión (`docs/agent-notes/cloth-viewer-wip.md`) |
| P11 | Se construyen 6 tipos: camiseta, sudadera, vestido, vaquero, chaqueta y falda | **REAL (WIP)** | `buildGarment()`; `data.js` tiene 2 listings de cada tipo | Los detalles de chaqueta/capucha/bolsillos son básicos; no hay forro ni solapa real |
| P12 | Hay 7 recetas de material PBR y 7 sets de texturas CC0 (21 mapas) | **REAL** | `FABRIC_RECIPE`, `loadFabricTextures()`; `assets/tex/` | Los normal maps se reutilizan y rotan; no hay simulación de tejido a nivel de fibra |
| P13 | La holgura se calcula por zona y produce un veredicto | **REAL** | `app.js` → `computeFit()`; `FIT_BANDS`, `FABRIC_THICKNESS_CM` | Es `fit-lite` en el viewer, no el `computeFit()` definitivo del contrato |
| P14 | El veredicto usa la zona crítica (holgura más negativa) | **REAL** | `computeFit()` → `critical`; `VERDICT_TITLES` | No agrega todas las zonas en un score; muestra el desglose |
| P15 | Se muestran las medidas que faltan y una confianza | **REAL** | `computeFit()` → `missing`, `confidence`; `updateFit()` | El cálculo de `missing` es específico por tipo y no cubre todas las medidas opcionales |
| P16 | El mapa de tensión pinta la prenda por zonas | **REAL (DEMO)** | `garment-builder.js` → `setHeatmap()`; `ZONE_COLORS` | El color se asigna por zona/altura, no por tensión por vértice; es una visualización, no una medición de campo |
| P17 | La demo tiene 12 anuncios, 6 tipos y 7 tejidos | **REAL** | `demo/vinted-mock/data.js`, `listings.json` | Son datos mock; no hay scraping ni API de Vinted |
| P18 | La demo funciona sin red y sin build | **REAL** | `serve.mjs`; `viewer3d/vendor/`; fuentes/GLB/HDRI locales | Requiere un servidor HTTP local; no funciona abriendo `index.html` con `file://` |
| P19 | La integración es un iframe con handshake y cierre | **REAL (mock)** | `demo/vinted-mock/viewer.js`; `app.js` → `postMessage({type:'segunda:ready'})` | Es una integración de demo; no hay extensión ni SDK de producción |
| P20 | El deck HTML incluye la demo real embebida | **REAL** | `deck/index.html`, `deck/manifest.js`, `deck/slides/` | El deck es HTML estático; no es Slidev ni PDF generado |
| P21 | El deploy publica `main` y previews por rama | **REAL (infra)** | `scripts/build-site.sh`, `deploy/README.md`, `.github/workflows/` | El camino activo es el poller del VPS; Actions es opcional y no está configurado con secretos |
| P22 | Un revisor auto-mergea ramas `feat/*` si pasan build y revisión | **REAL (proceso)** | `docs/agent-notes/auto-merge.md`; commits `auto-merge: ...` | Es infraestructura del hackathon, no una feature del producto |
| P23 | Hay una extensión Chrome MV3 | **ROADMAP** | No existe `apps/extension/` en este repo | La demo usa iframe; la extensión quedó fuera del alcance |
| P24 | Hay integración nativa con Vinted | **ROADMAP** | `docs/PLAN.md` §6; `docs/pitch.md` | No hay API, permiso ni partnership; el mock reproduce la superficie |
| P25 | Hay un motor de fit completo en `packages/fit-engine/src/fit.ts` | **PARCIAL** | `types.ts` define `FitResult`; `index.ts` lo anuncia como pendiente | El fit que se ejecuta es `fit-lite` en `viewer3d/app.js`; `fit.ts` no existe |
| P26 | Hay orquestador LLM en vivo | **ROADMAP** | `docs/pipeline.md`; `types.ts` → `Plan`, `PlanStep`, `PipelineTool` | La demo usa datos declarados; no hay llamada a un LLM |
| P27 | Hay lectura de cinta métrica con Jev/OCR en vivo | **ROADMAP** | `docs/vision-extraction.md` | No hay integración; el atajo está investigado y tipado |
| P28 | Hay medidas del cuerpo desde fotos | **ROADMAP** | `docs/vision-extraction.md` | Rompe la promesa on-device y requiere escala/consentimiento |
| P29 | Hay simulación de tela real | **ROADMAP** | `garment-builder.js` → `relax()` | Es relajación de distancias + gravedad + colisión direccional + pliegues analíticos; no XPBD |
| P30 | Hay AR en móvil | **ROADMAP** | `docs/PLAN.md` §4 | No implementado |

---

## 3. Cifras del pitch

| # | Cifra | Tipo | Fuente / uso | Límite |
|---|---|---|---|---|
| S01 | **19,3 %** de las ventas online se devuelven (EE. UU., 2025) | Externa | NRF + Happy Returns, *2025 Retail Returns Landscape*; `STATS.md` §1 | Dato de EE. UU.; no extrapolar a España sin decirlo |
| S02 | **25–30 %** de devoluciones en moda online; **56 %** de marcas ≥30 % | Externa | NRF, Radial + Two Boxes, PwC; `STATS.md` §1 | Rango de fuentes; citar la fuente en el pie |
| S03 | **53–67 %** de devoluciones de moda por talla/ajuste | Externa | Coresight, Rithum, Eightx; `STATS.md` §1 | Rango, no una cifra única; no decir "el 67 %" sin fuente |
| S04 | **~66 %** del precio del artículo: coste de procesar una devolución de apparel | Externa | Coresight / Optoro; `STATS.md` §1 | Distinta de la media de todos los sectores (~21 %, Pitney Bowes); decir cuál se usa |
| S05 | Vinted no cubre devoluciones por talla | Externa | Política de Vinted, `vinted.com/help/465`; `STATS.md` §2 | "Incorrect size" sí puede ser SNAD; distinguir "no me queda" de "talla incorrecta" |
| S06 | **750.000 €/año** de ahorro estimado en 100.000 pedidos | **ESTIMATE** | `deck/slides/24-volume.html`; supuestos: 25 % devoluciones, 10 % evitadas, ~30 €/devolución | Es un cálculo propio, no un resultado medido; decirlo en la slide |
| S07 | **20 M** de personas en España con problemas para encontrar su talla | **ESTIMATE** | `deck/slides/23-proof.html`; nota al pie "estimación de mercado en España" | No hay fuente pública verificada en `STATS.md`; no presentarla como dato duro |

> **Regla:** las cifras S01–S05 llevan fuente y fecha en el pie de slide. S06–S07 llevan la palabra **estimación** visible. Si no está en esta tabla, no se usa.

---

## 4. Frases que no se pueden decir

Estas frases suenan bien y son falsas o no están probadas. Están prohibidas en el escenario y en los docs:

- "Medimos tu cuerpo con la cámara del móvil." → **ROADMAP**, y con problemas de privacidad.
- "Un LLM calcula la talla." → El LLM no toca el número. El veredicto sale del motor.
- "Es una simulación física de tela." → Es una relajación geométrica; no hay XPBD ni autocolisión.
- "Funciona en Vinted en producción." → Es un mock local + iframe.
- "Evita el 30 % de las devoluciones." → No hay medición; el 10 % es un supuesto del cálculo.
- "Precisión de 1 cm." → No hay calibración ni referencia de escala; no se ha medido el error.
- "Integración con la API de Vinted." → No existe; no hay scraping ni API.
- "Medidas obligatorias en Vinted." → Son campos estandarizados y presentes en muchos listings; no obligatorios.
- "El cuerpo es 100 % procedural." → La malla base es CC0; la parametricidad está en el perfil, los landmarks, los anillos y la deformación.
- "La prenda está modelada a mano." → Se genera desde el cuerpo + medidas; no hay modelado por listing.

---

## 5. Cómo auditar este ledger en 5 minutos

```bash
# 1. Los JavaScript de la demo no tienen errores de sintaxis
node --check demo/vinted-mock/app.js
node --check demo/vinted-mock/data.js
node --check demo/vinted-mock/viewer.js
node --input-type=module --check < demo/vinted-mock/viewer3d/app.js
node --input-type=module --check < demo/vinted-mock/viewer3d/garment-builder.js

# 2. El motor de cuerpo reproduce circunferencias y no genera NaN
npx --yes tsx packages/fit-engine/scripts/check-body.ts

# 3. No hay red en el runtime del viewer
grep -R "fetch(\|XMLHttpRequest\|https://" -n \
  packages/fit-engine/src demo/vinted-mock/viewer3d/app.js \
  demo/vinted-mock/viewer3d/garment-builder.js

# 4. La demo arranca y el visor responde
node demo/vinted-mock/serve.mjs 8080 &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8080/viewer3d/?listing=carhartt-hoodie-m"
```

**Qué deberías ver:** `node --check` sin salida (éxito), el check del motor con `OK: geometría, landmarks y circunferencias verificados.`, y dos `200`.

Si algo de esto falla, el claim correspondiente deja de ser **REAL** hasta que se arregle. Así funciona un ledger.

---

## 6. Historial del ledger

| Fecha | Cambio |
|---|---|
| 22/10/2026 | Versión inicial: se separan claims de producto, cifras e infraestructura; se marcan `fit-lite`, prenda WIP, LLM y visión como límites explícitos |
| 22/10/2026 | Se añade la distinción **PARCIAL** para el motor de fit y **REAL (WIP)** para la prenda 3D |

---

<div align="center">
<sub>Este documento existe para que el proyecto no se crea sus propias mentiras. Si un claim no está aquí, no está probado.</sub>
</div>
