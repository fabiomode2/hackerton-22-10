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

## 2. El problema (datos verificados, fuentes en `STATS.md`)

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
| Integración en Vinted real | **DEMO grabada** | No en vivo |
| Cuerpo desde fotos / escaneo | **ROADMAP** | Mock en slide |
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

| Player | Qué hace | Por qué no nos cubre |
|---|---|---|
| **Zeekit / Walmart** | Try-on 2D con imágenes de catálogo del retailer | Necesita fotos profesionales del producto; no hay catálogo en C2C |
| **Google Doppl** | Try-on con IA a partir de una foto | Producto cerrado, no integrado en un marketplace, no usa medidas |
| **3DLOOK / YourFit** | Escaneo corporal + recomendación de talla | B2B de marcas; necesita fichas técnicas y catálogo |
| **Fit Analytics / Snap** | Recomendador de talla estadístico | No visualiza; depende de histórico de la marca |
| **Vue.ai / Style3D / CLO** | 3D para diseño y e-commerce | Herramientas de estudio, requieren artista 3D |
| **Vinted** | Filtros de talla y fotos | No convierte medidas en geometría |

**El hueco:** nadie resuelve **C2C, zero-asset, medidas-como-dato**. Todos necesitan un catálogo modelado; nosotros necesitamos una cinta métrica.

**2×2 para el slide:** eje X = *necesita assets 3D del producto* vs. *zero-asset*; eje Y = *B2B marcas* vs. *C2C marketplaces*. Arriba-derecha: solos nosotros.

---

## 8. Modelo de negocio e impacto

**Quién paga:**
- **Marketplace (Vinted):** SaaS por sesión de try-on o por listing activo. Se paga con el ahorro en soporte y el aumento de conversión.
- **Vendedor profesional:** función "Pro" para destacar sus listings.
- **Marca (Zara):** licencia por catálogo; el ROI es directo (devolución ≈ 66% del precio del artículo).

**Unit economics de slide (simple y honesto):**
- 1 devolución de moda evitada ≈ 25–35 € de coste para la marca (rango citado en `STATS.md`).
- Si el try-on evita el 10% de las devoluciones de una marca con 100.000 pedidos/año y 25% de tasa de devolución → 2.500 devoluciones menos → **> 60.000 €/año**.
- Para Vinted el ahorro no es logístico: es **disputas, soporte y confianza**.

**Impacto:** cada devolución evitada es un envío de ida + vuelta que no ocurre. Sostenibilidad como consecuencia, no como eslogan.

---

## 9. Estructura del repo

```
hackerton-22-10/
├── AGENTS.md                  # contrato del equipo/agentes
├── docs/
│   ├── PLAN.md                # este documento
│   ├── STATS.md               # datos + fuentes + cómo citarlos
│   ├── pitch.md               # guion slide a slide + ledger
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

## 10. Reparto del equipo (7 personas: 4 implementación + 3 presentación)

**Por qué 4+3 y no 3+4:** el 3D es el único camino crítico y el único que puede hundir la demo. La presentación se puede escribir sin el código (problema, datos, competencia, negocio) y Pres 3 absorbe marca + ensayo. Con 3 devs, el motor y el viewer se convierten en cuello de botella.

### Implementación (4)

| Rol | Archivos que posee | Responsabilidad | Entregable |
|---|---|---|---|
| **Dev 1 — Cuerpo** | `fit-engine/src/body.ts` | Cuerpo paramétrico desde 6 medidas, `Ring[]`, `cm()`, sliders ↔ medidas | **T+0:50** cuerpo renderizable con 5 sliders |
| **Dev 2 — Prenda + fit** | `fit-engine/src/garment.ts`, `fit.ts` | Prenda procedural, mangas, holguras, tensión, veredicto, `confidence` | **T+1:30** camiseta puesta · **T+2:20** heatmap + veredicto |
| **Dev 3 — Viewer** | `apps/viewer/` | Escena R3F, cámara, luces, materiales, drawer, sliders UI, leyenda, swap de cuerpo | **T+1:40** vertical slice visible |
| **Dev 4 — Integración + demo ops (tú)** | `demo/vinted-mock/`, `apps/extension/`, `scripts/` | Mock Vinted, extensión/SDK, build offline, Playwright, backup MP4, demo driver | **T+1:00** página + botón · **T+2:30** flujo completo · **T+3:10** backup grabado |

**Dev 1 y Dev 2 comparten carpeta pero no archivos.** El único archivo compartido es `src/types.ts`, que escribe y congela el lead a T+0:20. `Ring` es el contrato:

```ts
type Ring = { y: number; rx: number; rz: number; cz: number; n: number };
buildBody(body: Body): Ring[];
buildGarment(bodyRings: Ring[], garment: Garment, body: Body): Ring[];
computeFit(body: Body, garment: Garment): FitResult;
```

**Nadie espera a nadie:** el lead escribe `fit-engine/src/mock-body.ts` con anillos hardcodeados a T+0:20. Dev 3 y Dev 4 construyen contra eso desde el minuto 20.

### Presentación (3)

| Rol | Archivos que posee | Responsabilidad | Entregable |
|---|---|---|---|
| **Pres 1 — Narrativa/Deck** | `deck/`, `docs/pitch.md` | Guion, slides, datos, competencia, negocio, timing | **T+1:30** esqueleto completo · **T+2:40** deck cerrado |
| **Pres 2 — Vídeo** | `video/` | Footage, Remotion, rough cut con placeholders, VO, subtítulos | **T+2:50** rough cut · **T+3:20** final + backup |
| **Pres 3 — Marca/UX/Pitch** | `docs/agent-notes/frontend-style.md`, `design/` | Tokens a T+0:35, mockups Pencil, logo, ensayo, Q&A, cronómetro | **T+0:50** sistema visual · **T+1:30** 3 mockups · **T+3:20** ensayo |

**Pres 3 define los tokens a T+0:35 y los consumen Dev 3 y Pres 1.** Un solo sistema visual para app y deck: si el panel 3D y las slides no parecen el mismo producto, la demo pierde.

### Lead = Dev 4 (tú)

No hay rol "flotante" con 7 personas: el lead tiene que producir. La integración es el rol natural de pegamento.

- Congela MVP y `types.ts` a T+0:20.
- Integra ramas cada 30–45 min (solo el lead hace merge).
- **Guarda el scope**: dice "no" a todo lo que no esté en el MVP. Las ideas nuevas van a `IDEAS.md`.
- Cronometra: a T+2:50 se para el código.
- **Demo driver**: presenta la demo en el escenario. Nunca la presenta alguien que no la construyó.

### Si preferís 3 implementación + 4 presentación

Entonces Dev 1 asume cuerpo + prenda + fit (un solo dueño del motor) y el 4º de presentación hace **datos/Q&A/logística**: verificar fuentes, preparar respuestas, backup slides, tiempos y entrega. Es viable, pero el motor pasa a ser un cuello de botella de una sola persona y el riesgo de no llegar al vertical slice sube mucho. **No lo recomiendo.**

> **Regla dura:** el equipo de presentación **no inventa** features. Cada slide pasa por el ledger REAL/DEMO/ROADMAP.

### Convivencia con 4 devs en el mismo repo

- Una rama por persona. Nadie hace merge de la rama de otro.
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
| **T+3:00–3:20** | Build estático + **grabación Playwright** + MP4 de respaldo + PDF del deck. | Dev 3 / Pres 2 |
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

### No-go (explícito, para no distraerse)

- Cloth simulation real.
- Cuerpo desde foto.
- AR móvil.
- Scraping de Vinted en vivo.
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

**Q&A — preparar estas 6:**
1. ¿Esto no es solo un render bonito? → Enseñar la fórmula y el mapa de tensión. Es aritmética.
2. ¿Cómo conseguís la geometría de la prenda sin modelo 3D? → Procedural desde medidas; explicar el loft.
3. ¿Y si el vendedor mide mal? → `confidence` + medidas que faltan; el motor dice cuánto se fía.
4. ¿Por qué Vinted os dejaría? → Extensión primero (cero integración), SDK después, nativo al final.
5. ¿No es caro? → Cero assets, cero artistas, WebGL en el cliente.
6. ¿Y la privacidad del cuerpo? → Todo on-device, sin cuenta, sin fotos.

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
- **Worktrees** para agentes en paralelo: `git worktree add ../wt-viewer feat/viewer`. Evita que dos agentes se pisen el working tree.
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
| Stats mal citadas | Media | Solo las 5 de `STATS.md`, con fuente en el pie del slide. |
| El jurado pregunta "¿esto es real?" | Alta | Ledger REAL/DEMO/ROADMAP + fórmula en pantalla. |

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

1. **Lead** (Dev 4): crea `fit-engine/src/types.ts` + `mock-body.ts` y los congela. Abre `main` para todos.
2. **Dev 1**: `body.ts` con `Ring` y `buildBody()`. Tres anillos hardcodeados, que se vea algo.
3. **Dev 2**: escribe la tabla de holguras en `fit.ts` y `computeFit()` contra el mock. Sin esperar geometría.
4. **Dev 3**: `pnpm create vite`, un `<Canvas>` con una esfera, una luz y un HDRI. Que arranque en frío.
5. **Dev 4**: clona un listing de Vinted en HTML/CSS con fotos propias. Sin extensión todavía.
6. **Pres 1**: slides 2 y 3 (problema + insight) con las cifras de `STATS.md`.
7. **Pres 2**: footage descargado y esqueleto de Remotion con un título de prueba.
8. **Pres 3**: tokens en `frontend-style.md` → CSS vars; los publica en el canal. Son la base visual de app y deck.

**A T+0:20 cada uno dice en voz alta: "listo / bloqueado en X".** Si alguien está bloqueado, el lead reasigna, no se espera.
