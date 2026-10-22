# Decisiones — 12 ADRs de un prototipo de 4 horas

> **Qué es un ADR aquí.** Un registro de una decisión que cambió el rumbo, con el contexto, las alternativas y lo que costó. No es una lista de deseos: algunas decisiones son incómodas y se explican igual.
>
> **Cómo leerlo.** Si vienes del README, empieza por la tabla resumen. Si vienes del código, busca el ADR que explica la parte que te extraña.

---

## Resumen

| ADR | Decisión | Estado | Consecuencia principal |
|---|---|---|---|
| 001 | Contrato congelado antes de implementar | Aceptada | Paralelismo real entre cuerpo, viewer y demo |
| 002 | Viewer estático en JS + Three.js, sin React | Aceptada | Cero build, cero `npm install`, control total |
| 003 | Cuerpo híbrido: base mesh CC0 + deformación paramétrica | Aceptada | Calidad visual sin renunciar a la escalabilidad |
| 004 | Prenda recortada de la malla + solver, no cloth sim | Aceptada | Caída creíble en horas, sin XPBD |
| 005 | `fit-lite` en el viewer, contrato en `packages/fit-engine` | Aceptada con deuda | Veredicto ya; motor definitivo pendiente |
| 006 | Sin backend, sin red, estado en `localStorage` | Aceptada | Privacidad y demo offline; sin sync |
| 007 | LLM fuera del camino numérico | Aceptada | Veredicto determinista y auditable |
| 008 | Deck HTML estático, no Slidev | Aceptada | Control pixel-perfect y demo embebida |
| 009 | Marketplace mock con 12 anuncios | Aceptada | Superficie de producto real, sin API |
| 010 | Ledger REAL / DEMO / ROADMAP | Aceptada | El pitch no puede mentir |
| 011 | Deploy temprano + previews + auto-merge | Aceptada | Integración barata, menos cuello de botella |
| 012 | Sin scraping ni integración nativa con Vinted | Aceptada | Cero riesgo legal/técnico; se cuenta como roadmap |

---

## ADR-001 · Congelar el contrato antes de implementar

**Contexto.** Tres personas iban a construir en paralelo: cuerpo, viewer y demo. Sin una frontera estable, el viewer no podía empezar hasta que el cuerpo existiera, y el cuerpo no podía validarse hasta que el viewer lo renderizara.

**Decisión.** Congelar `Body`, `Ring`, `Garment` y `FitResult` en `packages/fit-engine/src/types.ts` a T+0:20, junto con un `mock-body.ts` con un torso y unas piernas hardcodeados.

**Alternativas.** (a) Empezar por el motor y esperar; (b) construir todo en una sola rama; (c) definir el contrato al final.

**Consecuencias.** El viewer se construyó contra el fixture desde el minuto 20. Cuando `buildBody()` llegó, sustituyó al fixture sin cambiar la interfaz. El coste: el contrato se quedó corto en algunos puntos (`tension`, `sources`) y hubo que documentar la deriva en vez de reescribirlo a mitad de la demo.

**Evidencia.** `packages/fit-engine/src/types.ts`, `mock-body.ts`; commits `74d5e78`, `da7b074`.

---

## ADR-002 · Viewer estático en JavaScript + Three.js, sin React

**Contexto.** El plan original era Vite + React + React Three Fiber + drei + zustand. Es un stack excelente para un producto de semanas. Para una demo de cuatro horas, añade build, dependencias, versiones y un modo de fallo más.

**Decisión.** Viewer en JavaScript con Three.js r186 vendorizado, servido como estático. Sin bundler, sin `package.json`, sin `npm install`.

**Alternativas.** (a) React + R3F; (b) Vite + TS sin React; (c) Three.js desde CDN.

**Consecuencias.** Carga instantánea, control total de la geometría y cero fricción el día del jurado. El coste: la UI se escribe a mano (más código de DOM) y no hay hot reload. La CDN se descartó porque la demo tiene que funcionar sin red.

**Evidencia.** `demo/vinted-mock/viewer3d/index.html`, `vendor/`, `app.js`; `deck/README.md` para el mismo criterio en el deck.

---

## ADR-003 · Cuerpo híbrido: base mesh CC0 + deformación paramétrica

**Contexto.** El plan A era un cuerpo 100 % procedural con anillos. La matemática era elegante y el pitch era perfecto, pero un cuerpo humano completo solo con anillos, en cuatro horas, no alcanzaba la calidad visual que una demo de moda necesita.

**Decisión.** Usar dos base meshes CC0 (MakeHuman/Innerscene) y deformarlas con el perfil, los landmarks y los anillos del motor. La parametricidad vive en los datos y en la deformación; la malla base es infraestructura.

**Alternativas.** (a) Cuerpo 100 % procedural; (b) avatar GLB fijo sin deformación; (c) escaneo/SMPL.

**Consecuencias.** Se conserva la promesa de escalabilidad (la prenda se genera, no se modela) y se gana calidad visual. El coste: el pitch cambia de "todo es matemática" a "la matemática decide la forma"; hay una base mesh que explicar y una licencia que citar (CC0).

**Evidencia.** `viewer3d/app.js` → `loadModel()`, `deform()`; `assets/*.glb`; `viewer3d/README.md`.

---

## ADR-004 · Prenda recortada de la malla + solver, no cloth sim

**Contexto.** La prenda podía construirse de tres formas: (a) loft de anillos puro; (b) recorte de la malla del cuerpo + holgura; (c) simulación de tela real.

**Decisión.** Recortar la superficie del cuerpo, separarla con la holgura del fit y relajarla con un solver de distancias + gravedad + colisión direccional. Añadir pliegues analíticos y remates. No XPBD, no autocolisión.

**Alternativas.** (a) Loft puro; (b) cloth sim; (c) GLB modelados por tipo.

**Consecuencias.** La prenda se adapta a cualquier cuerpo y tipo, y se ve "puesta" en minutos. El coste: la sisa y el cuello no son costuras reales; la media malla espejada deja una costura visible. Es la deuda visual P0/P1 del proyecto.

**Evidencia.** `garment-builder.js` → `buildGarment()`, `buildTopPatch()`, `relax()`, `addFabricFolds()`; `docs/agent-notes/cloth-viewer-wip.md`.

---

## ADR-005 · `fit-lite` en el viewer, contrato en `packages/fit-engine`

**Contexto.** El contrato `FitResult` y el motor de cuerpo estaban en TypeScript puro. El viewer necesitaba un veredicto para poder enseñar la prenda y el heatmap. Integrar el motor completo en el viewer exigía un bundle, pruebas y tiempo que no había.

**Decisión.** Implementar `computeFit()` dentro de `viewer3d/app.js` como `fit-lite`, usando las bandas y grosores del contrato. Mantener `packages/fit-engine` como fuente del contrato y del cuerpo. Documentar la deuda.

**Alternativas.** (a) Esperar al motor completo; (b) duplicar el motor en JS sin contrato; (c) calcular el veredicto en el servidor (no hay servidor).

**Consecuencias.** El veredicto existe y es correcto para la demo. El coste: hay dos implementaciones de las bandas (`types.ts` y `app.js`), `fit-lite` no calcula `tension` y `confidence_parts`, y el `computeFit()` definitivo sigue pendiente. Es una deuda P0 consciente.

**Evidencia.** `viewer3d/app.js` → `FIT_BANDS`, `computeFit()`; `types.ts` → `FitResult`, `FitZone`; `index.ts` anuncia `fit.ts` como pendiente.

---

## ADR-006 · Sin backend, sin red, estado en `localStorage`

**Contexto.** Un backend habría permitido cuentas, sincronización y datos reales. También habría añadido un servidor, una base de datos, autenticación, latencia y un punto de fallo en la demo.

**Decisión.** Todo on-device: el cuerpo se guarda en `localStorage`; el marketplace y el visor se sirven como estáticos; no hay llamadas de red en runtime.

**Alternativas.** (a) API con DB; (b) Firebase/Supabase; (c) servidor local con SQLite.

**Consecuencias.** Privacidad fuerte, demo offline y cero coste operativo. El coste: no hay sincronización entre dispositivos, no hay cuentas y el estado se pierde al borrar datos del navegador. Es una decisión de producto, no una limitación accidental.

**Evidencia.** `app.js` → `savePersonalProfile()`, `loadSavedPersonalProfile()`; `serve.mjs`; `viewer3d/README.md`.

---

## ADR-007 · El LLM decide y explica, nunca mide

**Contexto.** La tentación era mandar fotos + medidas a un LLM y que devolviera la prenda y el veredicto. Eso habría sido más "IA" y menos defendible: los números cambian entre ejecuciones, no son auditables y alucinan centímetros.

**Decisión.** El LLM, si existe, decide qué herramienta llamar y traduce el resultado a una frase. Las medidas las leen herramientas deterministas; el veredicto lo calcula el motor. `planDeterministic()` es obligatorio y el explicador no puede tocar `verdict`, `ease_cm` ni `confidence`.

**Alternativas.** (a) LLM end-to-end; (b) solo reglas, sin LLM; (c) LLM solo para el texto.

**Consecuencias.** El veredicto es reproducible y auditable. El coste: menos "magia" en la demo y más trabajo de diseño de pipeline. El orquestador real queda como roadmap; se enseña el diseño y los tipos, no se arriesga el número.

**Evidencia.** `docs/pipeline.md`; `types.ts` → `Plan`, `PlanStep`, `PipelineTool`, `SOURCE_WEIGHT`; `docs/CLAIMS.md`.

---

## ADR-008 · Deck HTML estático, no Slidev

**Contexto.** Slidev es ideal para escribir slides en Markdown y exportar PDF. Pero la demo necesitaba un iframe real, control pixel-perfect y un focus a pantalla completa sin pelear con el tema.

**Decisión.** Deck propio en HTML/CSS/JS, 1920×1080, con `manifest.js`, navegación por teclado, índice, focus de demo y demo embebida.

**Alternativas.** (a) Slidev; (b) Marp; (c) Figma/Canva.

**Consecuencias.** Control total del diseño y de la demo; sin build ni dependencia de un tema. El coste: más código propio y menos ecosistema; el deck no exporta PDF por sí solo.

**Evidencia.** `deck/index.html`, `deck/manifest.js`, `deck/css/`, `deck/js/deck.js`.

---

## ADR-009 · Marketplace mock con 12 anuncios

**Contexto.** La demo necesitaba una superficie creíble: feed, ficha, medidas, CTA y drawer. Scrapear Vinted en vivo era frágil, legalmente discutible y un punto de fallo.

**Decisión.** Un marketplace local tipo Vinted con 12 anuncios (2 por tipo), fotos locales, vendedores ficticios, filtros, búsqueda, favoritos y ficha. La integración es un iframe con `postMessage`.

**Alternativas.** (a) Scraping en vivo; (b) una sola página de producto; (c) API real de Vinted (no existe pública).

**Consecuencias.** La demo es reproducible y se ve como un producto. El coste: no es Vinted real; hay que decirlo. El mock es el escenario, no la integración.

**Evidencia.** `demo/vinted-mock/data.js`, `app.js`, `viewer.js`; `demo/vinted-mock/README.md`.

---

## ADR-010 · Ledger REAL / DEMO / ROADMAP

**Contexto.** El fallo clásico de hackathon es prometer una IA que no existe. En un escenario con jurado técnico, eso se detecta en la primera pregunta.

**Decisión.** Cada claim del producto se etiqueta como `REAL`, `DEMO` o `ROADMAP` en un ledger canónico, con evidencia y límite. La presentación no puede contradecirlo.

**Alternativas.** (a) Confiar en la honestidad del equipo; (b) un documento de features sin estados; (c) no documentar y improvisar Q&A.

**Consecuencias.** El pitch resiste la pregunta "¿esto es real?". El coste: hay que dedicar tiempo a escribir y actualizar el ledger; algunas features se ven menos impresionantes porque se etiquetan como demo.

**Evidencia.** `docs/CLAIMS.md`, `docs/pitch.md`; README "Qué es real".

---

## ADR-011 · Deploy temprano + previews + auto-merge

**Contexto.** Con tres ramas y un lead integrando, el merge podía convertirse en el cuello de botella. Además, el jurado necesitaba una URL, no una captura local.

**Decisión.** Publicar estáticos desde el primer día: `main` → producción, cualquier rama → preview. Un poller en el VPS hace `git fetch` cada 20 s. Un revisor auto-mergea ramas `feat/*` si pasan build y revisión.

**Alternativas.** (a) Deploy manual al final; (b) solo GitHub Pages; (c) integrar todo en `main` sin ramas.

**Consecuencias.** Cada push tiene URL y los merges son aburridos. El coste: infraestructura que mantener y una regla estricta de no tocar `releases/`, `previews/` ni `current`. El auto-merge no es una feature de producto; es una herramienta de equipo.

**Evidencia.** `deploy/README.md`, `scripts/build-site.sh`, `.github/workflows/`, `docs/agent-notes/auto-merge.md`.

---

## ADR-012 · Sin scraping ni integración nativa con Vinted

**Contexto.** La forma "obvia" de demostrar integración es scrapear Vinted o fingir una API. Las dos son malas ideas: una es frágil y legalmente gris; la otra es humo.

**Decisión.** No hay scraping ni API. La demo corre contra un mock local. La integración se cuenta como roadmap en tres niveles: extensión, SDK, nativo.

**Alternativas.** (a) Scraping en vivo; (b) API simulada; (c) integración nativa ficticia.

**Consecuencias.** Cero riesgo técnico/legal y una demo reproducible. El coste: el claim "funciona en Vinted" es `DEMO`, no `REAL`, y así se dice.

**Evidencia.** `AGENTS.md` ("sin scraping en vivo"); `docs/PLAN.md` §6; `docs/CLAIMS.md` P23/P24.

---

## Cierre

Estas doce decisiones no son independientes. El contrato congelado (001) permitió el viewer estático (002); el cuerpo híbrido (003) hizo posible la prenda recortada (004); el `fit-lite` (005) permitió enseñar el veredicto antes de tener el motor completo; el ledger (010) impidió que el pitch vendiera lo que el código no hacía.

**La decisión más importante no está en la lista:** aceptar que un prototipo de cuatro horas no es un producto, y diseñar la demo para que sea honesta en lugar de perfecta.

---

<div align="center">
<sub>Si una decisión no tiene alternativa, no es una decisión: es una imposición. Todas las de esta lista tenían una y se pagó un precio por elegir.</sub>
</div>
