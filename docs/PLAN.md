# Segunda Piel — plan de hackathon (4 h, 7 personas)

## 1. Resumen en 30 segundos

En Vinted, si la prenda no te queda, **no hay devolución**. La política lo dice explícitamente: "items that you don't like or that don't fit you" no son reembolsables; solo la talla *incorrecta* cuenta como "significantly not as described". El comprador asume el 100% del riesgo de talla.

Y sin embargo, el dato para resolverlo **ya está en el listing**: fotos de la prenda y medidas tomadas con cinta métrica.

**Segunda Piel convierte esas medidas en un maniquí paramétrico tuyo y te enseña, en 3D, cómo te queda la prenda antes de comprarla.** No adivinamos: calculamos holgura por zona, la pintamos sobre el cuerpo y damos un veredicto.

- **Para el comprador:** deja de comprar a ciegas.
- **Para Vinted:** menos disputas, más confianza, más recompra.
- **Para el vendedor:** vende más rápido porque el comprador sabe qué esperar.
- **Para el planeta:** cada prenda que no viaja de ida y vuelta.

**One-liner:** *El probador que Vinted no tiene. Las medidas ya están en el anuncio; nosotros las convertimos en un espejo.*

**Cierre:** *Vinted ya tiene las medidas. Tú ya tienes el cuerpo. Solo falta el espejo.*

---

## 2. El problema (datos verificados, fuentes en `STATS.md` y en el anexo §20)

| Dato | Cifra | Fuente |
|---|---|---|
| Devoluciones online | **19,3%** de las ventas online (2025) | NRF / Happy Returns |
| Devoluciones en moda | **25–30%** habitual; **56%** de marcas de apparel ≥30% | NRF, Radial, PwC |
| Causa principal | **53–67%** de las devoluciones de moda son talla/ajuste | Coresight, Rithum, Eightx |
| Coste de procesar una devolución de apparel | **~66% del precio** del artículo | Coresight / Optoro |
| Coste medio de una devolución | **~21% del valor del pedido** | Pitney Bowes |
| Marcas que usan o planean virtual try-on | **85%** | Coresight |

**El giro específico de Vinted (esto es la munición del pitch):**

- Vinted no cubre devoluciones por talla. Solo si el artículo es "significantly not as described".
- "Incorrect size" **sí** es SNAD (si el vendedor se equivocó al etiquetar). Pero "no me queda" **no**.
- Ventana de **2 días** para reportar; el comprador paga el envío de vuelta.
- Resultado: en C2C el coste de una mala decisión de talla no es logístico, es **pérdida total + fricción + desconfianza**.

**Lo que añade el estudio de mercado (22-oct-2026):**

- Devoluciones en moda online: **20–30%**; **25–30%** en las fuentes de `STATS.md`; vaqueros hasta **65%** en Europa. El ajuste explica **~50–70%** de las devoluciones según la fuente (53–67% en la tabla de arriba).
- Solo **1,4%** de los adultos de 18–65 años usa habitualmente un probador virtual (eMarketer, oct-2025). Categoría temprana, fragmentada y en consolidación.
- Los mejores resultados vienen de **medición + recomendación de talla**, no de "ver la ropa en tu cuerpo". Google declara que su try-on **no determina ni garantiza el ajuste real**.

**Frase para el deck:** *"En Vinted, equivocarte de talla no es una devolución. Es una prenda que te quedas y un vendedor que pierde una estrella."*

> Cuidado con el claim de "medidas obligatorias": Vinted tiene campos de medidas por categoría y las fotos son la norma, pero no afirmes "obligatorio" en el escenario. Di: **"estandarizado y presente en la mayoría de los listings"**.

---

## 3. La idea

### 3.1 Experiencia

1. El usuario crea su **cuerpo** una vez: 6 medidas (altura, pecho, cintura, cadera, hombro, entrepierna) + preferencia de ajuste. Se guarda en local.
2. Navega Vinted como siempre.
3. En cada listing aparece un botón: **"Ver cómo te queda"**.
4. Se abre un panel lateral con la prenda puesta sobre **su** cuerpo, en 3D, con materiales realistas.
5. Un mapa de calor muestra dónde aprieta (rojo), dónde queda bien (verde) y dónde sobra (azul).
6. Veredicto en lenguaje humano: *"Te queda bien de pecho y hombros. 4 cm justa de cintura. Talla recomendada: M."*
7. Cambias de cuerpo (o de talla del anuncio) y el veredicto cambia en vivo.

### 3.2 Los tres pilares

**A. Maniquí paramétrico ("tu cuerpo")**
No es un avatar genérico: es un cuerpo generado por matemáticas a partir de tus medidas. Se puede afinar con sliders (`hombro`, `pecho`, `cintura`, `cadera`, `altura`, `postura`). Estética deliberada: **maniquí abstracto, sin cara**, tipo estudio de sastrería. Evita el uncanny valley, protege la privacidad y se ve premium.

El estudio de mercado lo refuerza: la queja nº1 de Doji y Gensmo es **"no me parezco a mí"**, y los tests de ChatGPT Try-On llegan a la misma conclusión. Un maniquí abstracto no promete parecido; promete centímetros. *Accuracy over flattery.*

**B. Prenda procedural ("la ropa")**
La prenda no está modelada a mano: se **genera** a partir de sus medidas planas (axila-axila, largo, cintura, tiro, entrepierna...). Es el corazón del negocio: nadie va a modelar en 3D 500 millones de listings de Vinted. La geometría se calcula.

**C. Motor de ajuste ("el espejo")**
Compara perímetros de prenda vs. cuerpo + holgura de confección por tipo de prenda. Genera mapa de tensión y veredicto. **Es aritmética, no una caja negra**: se puede explicar y defender ante un jurado.

### 3.3 Los materiales

Presets por tejido con parámetros físicos simplificados:

| Tejido | Comportamiento | Cómo se ve |
|---|---|---|
| Punto algodón | Cae, se pega, se estira | `roughness .9`, `sheen .2`, normal suave |
| Felpa | Rígido, grueso, no cae | `sheen .5`, grosor +, arrugas amplias |
| Denim | Muy rígido, marca pliegues | normal de sarga, `roughness .8`, rigidez alta |
| Lino | Arruga mucho, cae | normal de lino, rigidez media |
| Piel | Brillo, estructura | `clearcoat .3`, rigidez alta |

El "rigidez" controla cuánto se separa la prenda del cuerpo en las zonas de holgura. Es el parámetro que hace que un denim no se vea como una camiseta.

---

## 4. Qué es real y qué es visión (ledger obligatorio)

Esto evita el fallo clásico de hackathon: prometer IA que no existe. En el escenario, ser explícito con esto **suma** credibilidad.

| Capacidad | Estado | Nota |
|---|---|---|
| Cuerpo paramétrico desde 6 medidas | **REAL** | Sliders en vivo |
| Prenda procedural desde medidas del listing | **REAL** | 2–3 arquetipos |
| Mapa de tensión + veredicto + talla recomendada | **REAL** | Fórmula explicable |
| Materiales por tejido | **REAL** | Presets PBR |
| Botón + panel en página tipo Vinted | **REAL (mock local)** | Extensión MV3 lista |
| Pipeline: fusión de fuentes + validación + reparación | **REAL** | Determinista, sin LLM |
| Clasificar tipo/tejido desde foto (Jev) | **DEMO (precalculado)** | `choice` + `noul`; no lee cm |
| Lectura de cinta métrica en foto (OCR) | **DEMO (precalculado)** | El número lo da el OCR, no el VLM |
| Orquestador LLM real en vivo | **ROADMAP** | Hoy: `planDeterministic()` |
| Integración en Vinted real | **DEMO grabada** | No en vivo |
| Cuerpo desde fotos / escaneo | **ROADMAP** | Rompe la promesa on-device; requiere consentimiento |
| Simulación de tela física (cloth sim) | **ROADMAP** | Hoy: rigidez + holgura |
| AR en móvil | **ROADMAP** | Mock en slide |

---

## 5. Cómo funciona técnicamente

### 5.1 El truco: un solo modelo de secciones

Cuerpo y prenda comparten la misma representación: **una pila de anillos horizontales**.

```
Cada anillo i: altura y_i, radio X, radio Z, centro (0, y_i, z_i), exponente n
Sección: superelipse  x = rx·sign(cos t)·|cos t|^(2/n)
                      z = rz·sign(sin t)·|sin t|^(2/n)
```

- El cuerpo son ~14 anillos (tobillo → cuello), con radios derivados de las circunferencias: `r = C / (2π)`, corregido por un factor elíptico (profundidad ≈ 0,7 × anchura) y un exponente `n ≈ 2,2–2,6` (un torso no es un círculo).
- La prenda son **los mismos anillos** + holgura `e(y, θ)` + grosor de tejido.
- El veredicto sale de la diferencia de radios. **La tensión es el dato, no un efecto visual.**

Ventajas: cero dependencia de assets, cero artistas 3D, determinista, testeable con unit tests, y escala a cualquier listing. Y es literalmente el pitch: *"3D artists can't model 500M listings. Math can."*

### 5.2 Mapeo de medidas del listing

| Medida del listing | Se convierte en |
|---|---|
| axila–axila (plano) | contorno de pecho = `× 2` |
| cintura (plano) | contorno de cintura = `× 2` |
| largo total | altura del bajo en el cuerpo |
| hombro–hombro | ancho de hombro de la prenda |
| largo de manga | longitud del tubo de manga |
| tiro / entrepierna | colocación de la cintura y el bajo en piernas |
| muslo (plano) | contorno de muslo = `× 2` |

### 5.3 Fórmula del veredicto

```
ease = contorno_prenda − contorno_cuerpo − 2π·grosor
```

Bandas de holgura **óptima** por tipo (cm de contorno):

| Prenda | Ajustado | Óptimo | Holgado |
|---|---|---|---|
| Camiseta | −2 … +3 | +3 … +10 | +10 … +20 |
| Sudadera | +2 … +8 | +8 … +16 | +16 … +28 |
| Vestido | 0 … +4 | +4 … +10 | +10 … +20 |
| Chaqueta | +4 … +10 | +10 … +20 | +20 … +32 |
| Vaquero (rígido) | −1 … +2 | +2 … +6 | +6 … +12 |
| Falda | 0 … +4 | +4 … +10 | +10 … +18 |

```
si ease < banda_ajustado.min  → too_small   (no cierra / no sube)
si ease < banda_optimo.min    → tight
si ease <= banda_optimo.max   → regular
si ease <= banda_holgado.max  → loose
si no                         → too_big
```

`confidence` = proporción de medidas presentes en el listing (0–1) + aviso de las que faltan. **Enseñar las medidas que faltan es una feature, no un fallo.**

### 5.4 Tensión → color

```
τ = (r_cuerpo − r_prenda) / r_cuerpo      // >0 aprieta
τ > 0.02          → rojo
0.00 … 0.02       → ámbar
−0.06 … 0.00      → verde
τ < −0.06         → azul
```

### 5.5 Stack

| Capa | Elección | Por qué |
|---|---|---|
| Viewer | **React + Vite + TS + React Three Fiber + drei** | Iteración rápida, UI y 3D en el mismo árbol, hot reload |
| 3D | **three.js** (`BufferGeometry` construida a mano) | Control total del loft; sin Blender |
| Materiales | `MeshPhysicalMaterial` + HDRI de estudio + normal maps | Look premium con poco esfuerzo |
| Postproceso | `@react-three/postprocessing` (SSAO + bloom sutil) | El "render de estudio" |
| Estado | `zustand` | Sliders → escena sin prop drilling |
| Extensión | **Chrome MV3** + iframe al viewer | Aísla CSS/CSP; no rompe la web anfitriona |
| Backend | **ninguno** | Cero fallos de red en la demo |
| Deck | **Slidev** | Markdown, diffeable, exporta PDF |
| Vídeo | **Remotion** + ffmpeg | Vídeo como código, overlays generados |
| Grabación demo | **Playwright** (`recordVideo`) | Demo determinista, sin temblores |

**Plan B si el 3D se atasca:** GLB pre-hecho (Ready Player Me / MakeHuman) + morph targets. Pero el plan A es procedural porque *es* la diferenciación.

---

## 6. Integración: cómo entra en Vinted y Zara

### 6.1 Tres niveles (de menor a mayor fricción)

1. **Extensión de navegador (demo).** Detecta la página de producto, inyecta el botón, abre un drawer con iframe. Cero cambios en Vinted. Es la demo.
2. **SDK web (producto).** Una línea en la web del marketplace:
   ```html
   <script src="https://cdn.segundapiel.app/widget.js" data-listing="12345"></script>
   ```
   El marketplace pasa las medidas por `data-*` o JSON-LD y nosotros renderizamos el panel.
3. **Integración nativa (visión).** Vinted añade el botón en su ficha de producto y las medidas ya estructuradas alimentan el motor. Para Zara, el catálogo ya tiene tallas y fichas técnicas: más fácil todavía.

### 6.2 Por qué encaja con Vinted específicamente

- Vinted **ya** pide fotos y medidas → no hay que cambiar el comportamiento del vendedor.
- Vinted **no** puede permitirse devoluciones → el coste del error lo paga el comprador → ahí está el valor.
- Un panel 3D aumenta tiempo en página y conversión, y reduce disputas (que cuestan soporte).
- Es un diferenciador frente a Depop, Wallapop y eBay.

### 6.3 Privacidad como feature

El cuerpo se genera y se guarda **en el dispositivo**. No se sube ninguna foto ni medida. Sin cuenta, sin tracking. Esto es argumento de pitch, no nota al pie.

---

## 7. Competencia (y por qué no nos pisan)

### 7.1 Quién está en el mercado (22-oct-2026)

| Player | Qué hace | Por qué no nos cubre |
|---|---|---|
| **Google Shopping / ChatGPT** | Try-on 2D generativo; Google con catálogo enorme y Doppl cerrado el 30-abr-2026; ChatGPT incluido en su plan desde oct-2026 | Dan imagen, no talla; Google dice que no garantiza el ajuste; necesitan foto de la prenda, no medidas planas |
| **Zeekit / Walmart** | Try-on 2D con fotos de catálogo del retailer | Necesita fotos profesionales del producto; no hay catálogo en C2C |
| **Zara Try-On** | Avatar 3D desde foto (cara + cuerpo), activo en España desde dic-2025 | Solo catálogo Zara; no da talla; sube biometría a Inditex; su propio aviso dice que puede no reflejar la realidad |
| **Zalando VFR** | Escaneo con 2 fotos o vídeo → avatar 3D; compara tallas; 1,5 M de clientes y 8% menos de devoluciones por talla en 2025 | Exige escaneo y catálogo propio; avatar no fotorrealista; no cubre C2C |
| **ASOS VTO** | Híbrido 2D, lanzado el 17-feb-2026; ~10.000 productos; 4–7 s; iOS en UK/US | No da talla; geografía limitada; sin métricas públicas de precisión |
| **Amazon VTO** | 2D + AR en EE.UU.; 40 modelos de XS a 4XL | Solo EE.UU. para ropa; biometría facial; no es recomendación de talla |
| **Doji** | Avatar + 2D generativo; iOS-only | No da talla; ~30 min de avatar; a veces cambia complexión y tono; entrena con tus fotos |
| **3DLOOK / YourFit / Virtusize / True Fit** | Escaneo, comparación con prendas propias o datos de compra + recomendación de talla (B2B) | Necesitan fichas técnicas y catálogo; no visualizan listings C2C |
| **Fit Analytics / Snap** | Recomendador de talla estadístico | No visualiza; depende del histórico de la marca |
| **CLO3D / Browzwear / Style3D / Vue.ai** | Herramientas de diseño y simulación de tela | Requieren patrón y formación; un gemelo digital tarda 1–3 semanas |
| **Vinted** | Filtros de talla y fotos | No convierte medidas en geometría |

**El hueco:** ninguno de los anteriores resuelve **C2C, zero-asset, medidas-como-dato**. Todos necesitan un catálogo modelado; nosotros necesitamos una cinta métrica.

**2×2 para el slide:** eje X = *necesita assets 3D del producto* vs. *zero-asset*; eje Y = *B2B marcas* vs. *C2C marketplaces*. Arriba-derecha: solos nosotros.

### 7.2 Lo que el estudio de mercado confirma

- **Consolidación:** Wannaby fue comprada por Perfect Corp; Presize la absorbió Meta; Ready Player Me cerró el 31-ene-2026; Google cerró Doppl el 30-abr-2026 y llevó la tecnología a Search/Shopping; ZERO10 y Wannaby retiraron sus apps consumer; Metail vendió EcoShot.
- **La queja nº1 no es técnica, es de identidad:** "no me parezco a mí" domina las reseñas de 1–2 estrellas. Los modelos generativos embellecen el cuerpo y el usuario lo detecta en segundos.
- **Efecto juguete:** no encontramos ni una reseña que diga "gracias a esto no devolví X". La categoría se usa para explorar, no para decidir una compra.
- **Paywall sorpresa:** el pelotón freemium cobra ~7 USD/semana. No hay evidencia de disposición a pagar por try-on como servicio independiente.
- **El hueco sigue abierto:** no encontramos un probador gratuito, multi-marca, con foto real y talla fiable; y no hay ninguno específico para segunda mano.
- **Demanda latente:** en foros aparece "navegar por tipo de cuerpo", no "probarme esta prenda concreta". Es un ángulo adyacente, no el MVP.

> "This app gives me pictures that look like a 6'5" shredded model. I am 5'10" and fat." — Doji, App Store, 1★

### 7.3 Por qué el foso aguanta

Google compite en imagen y catálogo; ChatGPT, en acceso conversacional; nosotros, en medidas y veredicto. Zalando y 3DLOOK compiten en talla, pero necesitan escaneo y catálogo propio: no escalan a 500 M de listings C2C. Y un modelo 3D de prenda cuesta **100–500 USD por prenda** (500–2.000+ con patrón y simulación), un coste que el C2C no puede pagar.

Detalle y fuentes: anexo §20.

---

## 8. Modelo de negocio e impacto

**Quién paga:**
- **Marketplace (Vinted):** SaaS por sesión de try-on o por listing activo. Se paga con el ahorro en soporte y el aumento de conversión.
- **Vendedor profesional:** función "Pro" para destacar sus listings.
- **Marca (Zara):** licencia por catálogo; el ROI es directo (devolución ≈ 66% del precio del artículo).

**Unit economics de slide (simple y honesto):**
- 1 devolución de moda evitada ≈ 25–35 € de coste para la marca (**estimación propia**; `STATS.md` da ~66% del precio del artículo y ~21% del valor del pedido).
- Si el try-on evita el 10% de las devoluciones de una marca con 100.000 pedidos/año y 25% de tasa de devolución → 2.500 devoluciones menos → **> 60.000 €/año**.
- Para Vinted el ahorro no es logístico: es **disputas, soporte y confianza**.

**Impacto:** cada devolución evitada es un envío de ida + vuelta que no ocurre. Sostenibilidad como consecuencia, no como eslogan.

### 8.1 Benchmark de costes (22-oct-2026)

| Concepto | Coste observado |
|---|---|
| Modelo 3D de prenda para e-commerce | 100–500 USD por prenda; 2–5 días |
| Gemelo digital con patrón y simulación | 500–2.000+ USD por prenda; 1–3 semanas |
| Recomendación de talla (Virtusize, Shopify) | 39 USD/mes |
| Escaneo corporal B2B (3DLOOK) | 499–1.500 USD/mes según volumen |
| AR / try-on B2B (Perfect Corp) | 379 USD/mes (100 SKUs) / 569 USD/mes (300 SKUs) |
| Herramientas de diseño (CLO3D / Browzwear / Style3D) | 50 / 75 / ~30 USD/mes |

**Lectura:** el software es la parte barata; **el coste oculto son los activos 3D**. Nuestro coste marginal por listing tiende a 0 porque la prenda se calcula, no se modela (estimación arquitectónica, no medida). Detalle: §20.5.

---

## 9. Estructura del repo

```
hackerton-22-10/
├── AGENTS.md                  # contrato del equipo/agentes
├── docs/
│   ├── PLAN.md                # este documento
│   ├── STATS.md               # datos + fuentes + cómo citarlos
│   ├── pitch.md               # guion slide a slide + ledger
│   ├── probadores-virtuales-3d.txt # estudio de mercado (corte 22-oct-2026)
│   └── agent-notes/           # descubrimientos entre agentes
│       ├── frontend-style.md
│       ├── 3d-procedural.md
│       ├── vinted-data.md
│       └── demo-script.md
├── packages/
│   └── fit-engine/            # TS puro: medidas → geometría → fit
├── apps/
│   ├── viewer/                # Vite + React + R3F
│   └── extension/             # Chrome MV3
├── demo/
│   └── vinted-mock/           # réplica local de un listing
├── deck/                      # Slidev
└── video/                     # Remotion + assets de vídeo
```

---

## 10. Reparto del equipo (7 personas: 3 implementación + 4 presentación)

**Asignación:** Geometría = **@manumuxoz** · Fit + Viewer = **@jaimepernasperez** · Integración + lead = **@fabiomode2** · Evidencia/Q&A = **@mranomyro**.

**Por qué 3+4:** con María en presentación, el motor y el viewer se reparten en dos personas con un contrato claro (`Ring`), y la presentación gana a la persona que mejor entiende el motor para defender la slide técnica y el Q&A. El Q&A es donde se pierden los hackathons.

### Implementación (3)

| Rol | Archivos que posee | Responsabilidad | Entregable |
|---|---|---|---|
| **Manu — Geometría** | `fit-engine/src/body.ts`, `garment.ts` | Cuerpo paramétrico + prenda procedural. Una sola persona porque **es la misma pipeline de anillos**: elimina el handoff y la fricción de contrato | **T+0:50** cuerpo con 5 sliders · **T+1:30** camiseta puesta |
| **Jaime — Fit + Viewer** | `fit-engine/src/fit.ts`, `apps/viewer/` | Tensión, veredicto, `confidence`; escena R3F, materiales, sliders, heatmap, swap de cuerpo | **T+1:00** `computeFit` contra el fixture · **T+1:45** viewer con prenda |
| **Fabio — Integración + demo + lead** | `demo/vinted-mock/`, `apps/extension/`, `scripts/` | 6 listings, botón, iframe, extensión, build offline, Playwright, backup MP4, demo driver | **T+1:00** mock · **T+2:00** flujo completo · **T+3:10** backup grabado |

**Contrato:** `Ring` en `types.ts` (congelado). Manu produce anillos; Jaime los consume para el fit y los renderiza. Nadie comparte archivo.

**Nadie espera a nadie:** `mock-body.ts` ya está en `main` con un torso y unas piernas hardcodeados. Jaime construye el viewer contra eso desde el minuto 20. Manu lo sustituye por `buildBody()` cuando esté.

### Presentación (4)

| Rol | Archivos que posee | Responsabilidad | Entregable |
|---|---|---|---|
| **Pres 1 — Narrativa/Deck** | `deck/`, `docs/pitch.md` | Guion, slides, timing, negocio | **T+1:30** esqueleto · **T+2:40** deck cerrado |
| **Pres 2 — Vídeo** | `video/` | Footage, Remotion, rough cut, VO, subtítulos | **T+2:50** rough cut · **T+3:20** final |
| **Pres 3 — Marca/UX/Ensayo** | `design/`, `frontend-style.md` | Tokens a T+0:35, mockups Pencil, logo, ensayo, cronómetro | **T+0:50** sistema visual · **T+3:20** ensayo |
| **María — Evidencia y slide técnica** | `docs/STATS.md`, sección técnica de `deck/` | Competencia, datos verificados, "cómo funciona", respuestas del Q&A, backup slides | **T+1:00** research cerrado · **T+2:30** Q&A ensayado |

María es el puente entre los dos equipos: entiende el motor y puede defenderlo. **Nadie más improvisa la slide técnica.**

### Lead = Fabio

- Congela MVP y `types.ts` a T+0:20.
- Integra ramas cada 30–45 min (solo el lead hace merge).
- **Guarda el scope**: dice "no" a todo lo que no esté en el MVP. Las ideas nuevas van a `IDEAS.md`.
- Cronometra: a T+2:50 se para el código.
- **Demo driver**: presenta la demo en el escenario. Nunca la presenta alguien que no la construyó.

> **Regla dura:** el equipo de presentación **no inventa** features. Cada slide pasa por el ledger REAL/DEMO/ROADMAP.

### Convivencia con 3 devs en el mismo repo

- Una rama por persona: `feat/geometry`, `feat/fit-viewer`, `feat/integration`.
- `types.ts` congelado; si hay que cambiarlo, se avisa en voz alta antes de tocar.
- Checkpoint de pie de **60 segundos** a T+1:45 y T+2:50: cada uno dice *hecho / siguiente / bloqueado*. Sin demos, sin discusión.
- El que termina antes **ayuda al cuello de botella**; no abre features nuevas.
- Un solo canal de comunicación. Los bloqueos se dicen en el momento, no a T+3.

---

## 11. Timeline (4 h exactas)

| Hora | Qué pasa | Quién |
|---|---|---|
| **T+0:00–0:15** | Kickoff: nombre, one-liner, MVP, roles, contratos. | Todos |
| **T+0:15–0:35** | Scaffold repo + assets base. Pres: narrativa y fuentes. Vídeo: footage. | Todos |
| **T+0:35–1:45** | Sprint 1. Motor + viewer + mock Vinted en paralelo. Deck esqueleto. | Todos |
| **T+1:45–2:00** | **Checkpoint 1: vertical slice.** Un listing → un cuerpo → una prenda. Demo interna de 60 s. Recortes. | Todos |
| **T+2:00–2:50** | Sprint 2. Heatmap + veredicto + 2ª prenda + swap de cuerpo. Slides cerradas. Rough cut del vídeo. | Todos |
| **T+2:50–3:00** | **Feature freeze.** Solo bugs y pulido. | Lead |
| **T+3:00–3:20** | Build estático + **grabación Playwright** + MP4 de respaldo + PDF del deck. | Fabio / Pres 2 |
| **T+3:20–3:35** | **Ensayo 1** cronometrado + Q&A agresivo. | Todos |
| **T+3:35–3:50** | **Ensayo 2** + ajustes. | Todos |
| **T+3:50–4:00** | Buffer, commit final, entrega. | Lead |

**Hitos innegociables:** vertical slice a T+2:00 · código congelado a T+2:50 · backup grabado a T+3:20.

---

## 12. Alcance

### MVP (tiene que existir sí o sí)

1. Cuerpo paramétrico con **5 sliders** funcionando en vivo.
2. **Una** prenda procedural (camiseta) generada desde medidas del listing.
3. Mapa de tensión + veredicto + talla recomendada + medidas que faltan.
4. Página local tipo Vinted con botón → panel 3D.
5. **Swap de cuerpo** en la demo (mismo listing, dos cuerpos, veredictos distintos).
6. Deck + vídeo + backup.

### Stretch (solo si el MVP está cerrado)

- Segunda y tercera prenda (vestido, vaquero).
- Selector de tejido con cambio de caída.
- Comparador de tallas S/M/L con veredicto por talla.
- Link compartible con el fit calculado.
- Badge "medida detectada en la foto" con datos precalculados (ver `docs/pipeline.md`).

### No-go (explícito, para no distraerse)

- Cloth simulation real.
- Cuerpo desde foto.
- AR móvil.
- Scraping de Vinted en vivo.
- IA generativa de try-on en la demo (latencia, coste y opacidad; no mejora el veredicto).
- Login, backend, base de datos.
- Fotorrealismo de piel/tejido.

---

## 13. Guion de la demo (90 segundos)

| t | Acción | Qué decir |
|---|---|---|
| 0:00 | Página tipo Vinted: "Levi's 501 — W32 L32 — 25 €" | "Este es un anuncio normal de Vinted." |
| 0:12 | Click en **"Ver cómo te queda"** | "Un click." |
| 0:18 | Panel: cuerpo del usuario, prenda apareciendo | "Este soy yo. 1,75, cintura 78." |
| 0:30 | Gira la prenda, se ve el denim | "La prenda se genera a partir de las medidas del anuncio. No hay modelado 3D." |
| 0:42 | Toggle **mapa de calor** | "Verde: bien. Ámbar: 1 cm justo. Rojo: no cierra." |
| 0:52 | Veredicto: "Te queda bien. Talla recomendada: 32." | "Y me dice por qué, con números." |
| 1:02 | **Cambia el cuerpo** a otro perfil | "Mismo anuncio. Otro cuerpo." |
| 1:10 | La cintura se pone roja, veredicto cambia | "Aquí no cierra. Esta prenda no es para mí. Y lo sé antes de pagar." |
| 1:20 | Vuelve a la página de Vinted | "Vinted ya tiene las medidas. Solo faltaba el espejo." |

**Regla:** la demo se ensaya 2 veces y se graba 1. Si en vivo falla, se corta al MP4 sin drama.

---

## 14. Presentación (5 min)

| Slide | Tiempo | Contenido |
|---|---|---|
| 1. Cold open | 0:00–0:20 | Footage real: alguien fotografiando una prenda para venderla. Sin narración. Texto: "22 fotos. 4 medidas. Y aún así, no sabes cómo te queda." |
| 2. El problema | 0:20–0:50 | La política de Vinted: si no te queda, no hay devolución. 19,3% de devoluciones online. 53–67% son talla. |
| 3. El insight | 0:50–1:20 | "El dato ya está en el anuncio." Foto del listing con las medidas resaltadas → flecha → cuerpo 3D. |
| 4. El producto | 1:20–1:40 | 3 pantallas: tu cuerpo · el panel 3D · el veredicto. |
| 5. **Demo en vivo** | 1:40–3:10 | Guion de arriba. |
| 6. Cómo funciona | 3:10–3:40 | Un diagrama: medidas → cuerpo + prenda → tensión → veredicto. "Es geometría, no una caja negra." |
| 7. Por qué escala | 3:40–4:10 | "500M listings. 0 artistas 3D. Matemáticas." + 2×2 de competencia. |
| 8. Negocio + impacto | 4:10–4:40 | ROI por devolución evitada. Privacidad on-device. Menos envíos. |
| 9. Roadmap + cierre | 4:40–5:00 | Foto → cuerpo, cloth sim, AR. Cierre: "Vinted ya tiene las medidas. Tú ya tienes el cuerpo. Solo falta el espejo." |

**Q&A — preparar estas 11:**
1. ¿Esto no es solo un render bonito? → Enseñar la fórmula y el mapa de tensión. Es aritmética.
2. ¿Cómo conseguís la geometría de la prenda sin modelo 3D? → Procedural desde medidas; explicar el loft.
3. ¿Y si el vendedor mide mal? → `confidence` + medidas que faltan; el motor dice cuánto se fía.
4. ¿Por qué Vinted os dejaría? → Extensión primero (cero integración), SDK después, nativo al final.
5. ¿No es caro de escalar? → Cero assets, cero artistas, WebGL en el cliente.
6. ¿Y la privacidad del cuerpo? → Todo on-device, sin cuenta, sin fotos.
7. ¿Esto no lo hace ya Zara, Zalando o ChatGPT? → Zara y ChatGPT dan look, no talla; Zalando da talla pero exige escaneo y catálogo propio. Ninguno usa las medidas planas de un listing C2C. Google declara que su try-on no garantiza el ajuste.
8. ¿Por qué no usáis IA generativa? → Añade latencia, coste y opacidad, y no mejora el veredicto. El foso es la medida de la prenda, no el render.
9. ¿Cuánto reducís las devoluciones? → No damos un % propio. El dato más citado es el claim de Zalando: un 8% menos de devoluciones por talla en 2025 (hasta 40% en los artículos probados en el piloto). Nuestro cálculo de negocio va etiquetado como estimación.
10. ¿No es mejor una foto real de alguien con la prenda? → Para C2C no existe: el vendedor no tiene la prenda en tu talla. Y una foto de otra persona no te dice cómo te queda a ti.
11. ¿Qué pasa con cuerpos diversos? → Es el punto: el maniquí es tuyo, no un ideal. Sin cara, sin juicio estético. Sliders para altura, cadera, pecho, cintura, hombro.

> Las cifras de estas respuestas están desarrolladas en `STATS.md` §2–4. La tabla de `docs/pitch.md` usa las mismas 11 preguntas.

---

## 15. Tecnología para presentación, vídeo y demo (con LLM/opencode)

| Necesidad | Herramienta | Por qué |
|---|---|---|
| **Slides** | **Slidev** (Markdown + Vue) | Se escribe como Markdown → un LLM genera y edita el deck entero. Exporta PDF/PNG. Presenter mode con notas y timer. Diferencias en git. |
| Alternativa simple | **Marp** | Aún más simple, menos control visual. |
| Alternativa diseño | Figma/Canva | Solo si el equipo ya lo domina; peor para iterar con agentes. |
| **Vídeo** | **Remotion** (React → MP4) | Vídeo como código: contadores animados, mockups de móvil, transiciones, subtítulos. Un agente puede escribirlo. |
| Corte y mezcla | **ffmpeg** | Recortes, velocidad, audio, subtítulos, GIFs, compresión. |
| **Grabar la demo** | **Playwright** `recordVideo` | Demo determinista y repetible: mismo click, mismos tiempos, sin temblores ni notificaciones. |
| Captura de pantalla | OBS / Kooha / `wf-recorder` | Footage crudo y grabación de respaldo. |
| Subtítulos | `faster-whisper` | Transcripción automática → subtítulos ES/EN. |
| Voz en off | `edge-tts` (gratis) / ElevenLabs | Si nadie quiere locutar o falta tiempo. |
| **UI mockups** | **Pencil (`.pen`)** | Sí renta: pantallas hi-fi y exports PNG/SVG para slides en minutos. Para la app real, código. |
| Diagramas | **Mermaid** dentro de Slidev / Excalidraw | Arquitectura y 2×2 editables, sin capturas borrosas. |
| 3D en vídeo | **Blender headless** (`bpy`) + `gltf-transform` | Generar/exportar GLB y comprimir. Solo si hace falta. |
| Stat hero (opcional) | **Manim** | Un solo gráfico memorable; alto coste, solo si alguien lo domina. |

**Receta concreta del vídeo (90 s):**
1. Cold open con footage (5 s) + sonido ambiente.
2. Problema con 2 cifras animadas (10 s) — Remotion.
3. Producto: captura real del panel 3D (20 s) — Playwright.
4. Tres beats: "sin modelar", "con tus medidas", "antes de pagar" (15 s).
5. Demo del swap de cuerpo (20 s).
6. Cierre + logo (5 s).
7. Música libre de derechos, subtítulos quemados, export 1080p.

**Regla de oro del vídeo:** el MP4 de respaldo se graba **antes** del primer ensayo, no después.

---

## 16. Colaboración entre agentes (lo que pediste)

Tres capas, de más permanente a más temporal:

1. **`AGENTS.md` raíz** — contrato: misión, propiedad de carpetas, esquemas de datos, convenciones, prohibiciones, Definition of Done. Es lo primero que lee cualquier agente.
2. **`docs/agent-notes/*.md`** — memoria viva del equipo. Descubrimientos que no se deducen del código:
   - `frontend-style.md`: tokens, tipografía, componentes, **qué NO hacer** visualmente.
   - `3d-procedural.md`: la matemática del loft, unidades, ejes, trampas de Three.js (`morphTargetInfluences`, `computeVertexNormals`, `flatShading`, precisión de `Float32Array`).
   - `vinted-data.md`: mapeo de medidas, tabla de holguras, casos raros (medidas planas vs. contorno, prendas elásticas).
   - `demo-script.md`: guion, timings, plan B.
3. **`AGENTS.md` por carpeta** — contexto scoped para que un agente que solo toca `apps/viewer` no cargue todo el proyecto.

**Mecánica:**
- Una rama por persona; el lead integra cada 30–45 min. Nada de merges entre devs.
- **Worktrees** para agentes en paralelo: `git worktree add ../wt-viewer feat/fit-viewer`. Evita que dos agentes se pisen el working tree.
- Commits pequeños con scope: `feat(viewer): heatmap legend`.
- Nota nueva = 5 bullets máximo. Si no cabe, es una decisión, no una nota.
- Decisiones que bloquean a otros → `docs/decisions/NNN-titulo.md` con 3 líneas (contexto, decisión, consecuencia).

**Anti-patrones que hay que prohibir explícitamente:**
- Dos agentes editando `package.json` a la vez. El lead es el único que lo toca.
- "Ya lo arreglo yo" en carpeta ajena.
- Assets de 50 MB en git.
- Slides que prometen cloth sim.

---

## 17. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El 3D parece amateur | Alta | Dirección de arte: maniquí abstracto, estudio neutro, sin caras, sin piel fotorrealista. Mejor "técnico y limpio" que "casi real". |
| Faltan assets 3D | Media | Todo procedural, cero Blender. Plan B: GLB + morph targets. |
| La demo en vivo falla | Media | Build estático + Playwright + MP4 de respaldo + segunda laptop. Sin red. |
| Caos de merges | Alta | Propiedad de carpetas + contratos congelados + lead integra. |
| Scope creep | Muy alta | MVP escrito y visible. El lead dice no. Las ideas nuevas van a un `IDEAS.md`. |
| Stats mal citadas | Media | Solo cifras de `STATS.md`; el anexo §20 remite a él y marca qué es estimación. |
| El jurado pregunta "¿esto es real?" | Alta | Ledger REAL/DEMO/ROADMAP + fórmula en pantalla. |
| El jurado ya conoce Zara/Zalando/ChatGPT | Alta | 2×2 + dato: dan look o talla con catálogo/escaneo; no encontramos quien convierta medidas planas C2C. Google no garantiza el ajuste. |
| Prometer menos devoluciones sin evidencia | Media | No dar un % propio; citar Zalando 8% (2025) y separar el 40% del piloto. |
| Datos de mercado desactualizados | Media | Fecha de corte 22-oct-2026 y fuente en el pie; el anexo §20 las detalla. |

---

## 18. Checklist de entrega

- [ ] `pnpm install && pnpm dev` funciona en frío
- [ ] La demo completa corre en < 60 s sin consola
- [ ] Funciona **sin internet**
- [ ] Deck exportado a PDF + fuente en `deck/`
- [ ] Vídeo 90 s en MP4 (1080p, subtítulos)
- [ ] Backup de la demo grabado
- [ ] `docs/pitch.md` con ledger actualizado
- [ ] Repo con commits legibles y README claro
- [ ] Ensayo 2 hecho y cronometrado

---

## 19. Próximos 15 minutos (una acción por persona)

1. **Fabio (lead)**: contrato `types.ts` + `mock-body.ts` ya congelado en `main`. Abre `main` para todos y crea las ramas.
2. **Manu**: `body.ts` con `buildBody()`. Tres anillos hardcodeados, que se vea algo.
3. **Jaime**: `fit.ts` con la tabla de holguras y `computeFit()` contra el fixture. Y `pnpm create vite` + `<Canvas>` con esfera, luz y HDRI.
4. **Fabio**: mock de un listing de Vinted en HTML/CSS con fotos propias. Sin extensión todavía.
5. **Pres 1**: slides 2 y 3 (problema + insight) con las cifras de `STATS.md`.
6. **Pres 2**: footage descargado y esqueleto de Remotion con un título de prueba.
7. **Pres 3**: tokens en `frontend-style.md` → CSS vars; los publica en el canal. Son la base visual de app y deck.
8. **María**: cierra competencia (2×2) y prepara las 11 respuestas del Q&A.

**A T+0:20 cada uno dice en voz alta: "listo / bloqueado en X".** Si alguien está bloqueado, el lead reasigna, no se espera.

---

## 20. Anexo: estudio de mercado (corte 22-oct-2026)

> Fuente: `docs/probadores-virtuales-3d.txt` (estudio completo, fuentes en su §14). Este anexo resume solo lo que afecta al pitch y a la demo. Las cifras de mercado están desarrolladas en `STATS.md` §2–4; aquí se organizan para la demo y se añade el mapa de competidores.

### 20.1 Mapa consumer a 22-oct-2026

| Servicio | Tecnología | Precio | ¿Da talla? | Estado / limitación |
|---|---|---|---|---|
| Google Shopping | Gen 2D + foto | Gratis | No | Activo; 18 países según su soporte en 2026; Doppl cerró el 30-abr-2026 |
| ChatGPT Try-On | Gen 2D + foto | Incluido en el plan ChatGPT | No | Activo oct-2026; cambia proporciones; no simula tejido |
| Amazon VTO | Gen 2D + AR | Gratis con cuenta | No | Activo EE.UU.; 40 modelos XS-4XL; medidas faciales biométricas |
| ASOS VTO | Gen 2D / híbrido | Gratis | No | 17-feb-2026; ~10.000 productos; 4-7 s; solo iOS UK/US |
| Zalando VFR | Avatar 3D + medidas | Gratis | Sí | 1,5 M clientes; piloto en 14 mercados; 8% menos de devoluciones por talla en 2025 |
| Zara Try-On | Avatar 3D desde foto | Gratis | No (sin talla publicada) | España dic-2025; cobertura 13-mar-2026; cara + cuerpo entero a Inditex |
| Tesco F&F | Gen 2D en tienda | Gratis | No | Piloto 25-sep-2026; 1 tienda (Sandhurst Extra); ~1.500 prendas; sin online |
| Doji | Avatar + gen 2D | Gratis (iOS) | No | iOS-only; inglés; invitación; ~30 min de avatar; entrena con las fotos |
| Gensmo/dreamfits | Avatar + gen 2D (Gensmo) / gen 2D (dreamfits) | ~7 USD/semana o 7 USD/20 generaciones | No | Paywall sorpresa; avatares de 2 tallas; caras deformadas |
| YouCam | AR belleza + gen | Gratis / 5,99 USD/mes (32,99 USD/año) | No | Ropa genérica, no SKUs reales; free limitado |
| DressX | Gen 2D + AI twin | Friend gratis / Member (precio no público) | No | App consumer con última actualización en jun-2024; giro a B2B; catálogo real limitado |
| Snapchat Dress Up | AR en vivo | Gratis | No | Overlay AR, no tela; TrueSize con LiDAR; poca precisión en prendas ajustadas |

### 20.2 Tamaño y adopción

- Grand View Research: 18.100 M USD en 2026 → 46.400 M USD en 2030, CAGR 26,4%. [M]
- Mordor Intelligence: 15.180 M USD en 2025 → 48.100 M USD en 2030, CAGR 25,95%. [M]
- Business Research Company: 12.090 M USD en 2025 → 38.920 M USD en 2030. Market.us: 12.600 M USD en 2024 → 245.900 M USD en 2034, CAGR 34,6% (outlier de definición, tratar con cautela). [M/B]
- Las cifras no son comparables entre sí por definiciones dispares. Lo relevante: crecimiento de ~25-30% anual con una adopción consumer del **1,4%** de adultos de 18-65 años (eMarketer, oct-2025, citado por The Interline). [M]
- Consecuencia para el pitch: no vender "categoría en explosión", sino una capa de decisión barata sobre un mercado que ya existe; el crecimiento no ha llegado al usuario.

### 20.3 Precisión, fit y devoluciones (lo que es verdad)

- Escáner corporal por móvil: RMSE 12,6-19,0 mm y MAE 10,1-16,0 mm en pantorrilla, cadera, cintura y muñeca (estudio 2026); con ~150 fotos, error ~0,5 cm (0,9%) en circunferencias. [A]
- 3DLOOK declara 96-97% de precisión frente a medida manual; es claim de proveedor, no estudio independiente. [M]
- Modelos fit-aware: MAE 0,14-0,35 cm al diferenciar incrementos de talla, solo parte superior y dataset VITON-HD; el dataset FIT (1,13 M de tripletas, 168 cuerpos XS-3XL, 158.483 prendas) es prototipo, no producto. [A]
- Devoluciones: moda online 20-30%; vaqueros hasta 65% en Europa. El fit explica ~50% (hasta 70% en algunas estimaciones). [M]
- "Size flags" ("esta prenda talla pequeña"): ~10% menos devoluciones. Google declara que su try-on "no determina ni garantiza el ajuste real"; Bloomberg (ago-2026) probó Zalando: avatar más grande de lo esperado, jeans colgando raro y duda de qué talla pedir. [A/M]

Conclusión honesta: el try-on visual sirve para estilo y color; para talla hacen falta medidas + ficha técnica + recomendación.

### 20.4 Privacidad y regulación

- Qué pide cada tipo: try-on 2D una foto en nube; avatar 3D varias fotos, medidas o vídeo; escaneo 2 fotos (frontal y lateral) o vídeo con ropa ajustada; AR en vivo cámara, a veces on-device.
- Zara pide foto de cara + cuerpo entero a Inditex. Amazon usa medidas faciales biométricas, borradas en 24 h; las fotos se guardan hasta que las borres. [A]
- Doji guarda las fotos mientras la cuenta esté activa y entrena con ellas; borrado solo a petición. Google declara que no recoge biometría ni entrena con la foto. [A/M]
- GDPR art. 9: el dato biométrico es categoría especial si se usa para identificar de forma única. AI Act art. 50: desde el 2-ago-2026 hay que marcar las imágenes sintéticas de forma legible por máquina, etiquetar deepfakes e informar de que se interactúa con IA. BIPA (Illinois): 15+ demandas colectivas desde 2021; Charlotte Tilbury pagó ~2,9 M USD. [A]

Ventaja estructural de outfit check: si el cuerpo se calcula con 6 medidas y se queda en el dispositivo, no hay foto que borrar, ni biometría que consentir, ni entrenamiento que auditar.

### 20.5 Costes de referencia

| Concepto | Coste observado |
|---|---|
| Modelo 3D de prenda para e-commerce | 100-500 USD por prenda; 2-5 días |
| Gemelo digital con patrón y simulación | 500-2.000+ USD por prenda; 1-3 semanas |
| 3DLOOK | 499-1.500 USD/mes según volumen |
| Virtusize en Shopify | 39 USD/mes |
| Perfect Corp | 379 USD/mes (100 SKUs) / 569 USD/mes (300 SKUs), según comparativas de terceros |
| Banuba TINT | 99/299/799 USD/mes (no-code); Shopify 249/799/1.299 USD/mes; 7 días de prueba |
| CLO3D | 50 USD/mes (25 USD/mes estudiante) |
| Browzwear | 75 USD/mes o 750 USD/año Freelancer |
| Style3D | ~30 USD/mes individual |
| CatVTON | <8 GB VRAM; licencia CC BY-NC-SA 4.0 (no comercial) |
| FASHN VTON v1.5 | Apache-2.0 (uso comercial) |
| API gestionada de VTO | 12-35 USD/mes a bajo volumen; ~800 USD/mes a 50.000 imágenes |

El software es la parte barata; el coste oculto son los activos 3D.

### 20.6 Qué implica para outfit check

- **No competir en realismo; competir en veredicto explicable y holgura en cm.** Google y Zara ya dan imagen gratis; ninguno da holgura en cm por zona.
- **El hueco C2C sigue abierto:** no encontramos ningún VTO que convierta las medidas planas de un listing en geometría. Es el input que ya tenemos y el que no encontramos en ningún VTO.
- **La queja nº1 ("no me parezco a mí") valida el maniquí abstracto:** no hay avatar que pueda fallar en parecerse. "Accuracy over flattery".
- **No meter IA generativa en la demo:** añade latencia (5-20 s), coste (0,02-0,35 USD/imagen) y opacidad; no mejora el veredicto.
- **No prometer un % propio de reducción de devoluciones:** el dato más citado es el 8% de Zalando (2025), claim de la marca; el 40% es de artículos probados en el piloto. Usar el cálculo explícito de §8 y etiquetarlo como estimación.

### 20.7 Fuentes

`docs/probadores-virtuales-3d.txt` §14. URLs clave, literales del txt:

- Google Try-On: https://support.google.com/googleshopping/answer/16253678
- Cierre de Doppl: https://x.com/GoogleLabs/status/2036188820128071786
- ASOS VTO: https://www.asosplc.com/news-and-media/latest-news/asos-launches-hybrid-approach-to-virtual-try-on-giving-customers-a-unique-way-to-shop-with-confidence/
- Zalando VFR: https://corporate.zalando.com/en/technology/how-zalando-uses-technology-help-customers-find-right-size
- Zara Try-On: https://marketing4ecommerce.net/en/zara-try-on/
- NRF + Happy Returns: https://nrf.com/research/2025-retail-returns-landscape
- Coresight: https://coresight.com/research/the-true-cost-of-apparel-returns-alarming-return-rates-require-loss-minimization-solutions/
- TechRadar, test de ChatGPT try-on: https://www.techradar.com/ai-platforms-assistants/chatgpt/i-tried-chatgpts-new-virtual-fitting-room-it-got-the-clothes-right-but-changing-my-body-defeats-the-point
- Bloomberg, probadores y devoluciones: https://www.bloomberg.com/news/articles/2026-08-21/zalando-zara-use-ai-virtual-try-ons-to-tackle-clothing-returns
- The Interline, adopción de VTO (23-mar-2026): https://www.theinterline.com/2026/03/23/virtual-try-on-hasnt-met-the-bar-for-consumer-adoption-can-ai-push-it-over/
- AI Act, art. 50: https://artificialintelligenceact.eu/transparency-rules-article-50/

Las estimaciones de tamaño de mercado provienen de los informes citados en el txt §11.5; el estudio no incluye URL primaria para todas.
