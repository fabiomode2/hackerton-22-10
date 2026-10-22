# Historia de outfit check

> **Qué es este documento.** No es un changelog ni una lista de features. Es la crónica de una ventana de cuatro horas: qué decidimos, qué cambiamos de idea, qué se rompió y por qué el prototipo que se enseña es este y no otro.
>
> Si buscas el estado actual, ve al [README](../README.md). Si buscas el plan original, ve a [PLAN](PLAN.md). Este documento conserva la diferencia entre los dos.

---

## 0. Resumen

| Dato | Valor |
|---|---|
| Fecha | 22 de octubre de 2026 |
| Ventana | 4 horas (arco de commits: 13:06–17:29, 4 h 23 min) |
| Equipo | 7 roles: 3 implementación + 4 presentación |
| Commits | 44 |
| Archivos versionados | 157 al cierre de la ventana |
| Código propio | ~23 000 líneas de código (sin vendor, `dist/` ni vídeo) |
| Ramas | 5 (`main`, `feat/geometry`, `feat/fit-viewer`, `feat/integration`, `feat/presentation-viewer`) |
| Producto | 12 anuncios, 6 tipos de prenda, 7 tejidos, 2 base meshes, 7 sets de texturas PBR |
| Infra | Deploy por poller, previews por rama, revisor auto-merge |
| Backend | 0 |
| Llamadas de red en runtime | 0 |

**La frase que resume el proyecto:** *Vinted ya tiene las medidas. Tú ya tienes el cuerpo. Solo falta el espejo.*

---

## 1. El punto de partida (13:06)

El repo nace con un `Initial commit` y un README de una línea. En los primeros 45 minutos no hay producto: hay **decisiones**.

La idea inicial se llamó **Segunda Piel**. El nombre de trabajo sobrevivió en claves internas (`segunda-piel:personal-mannequin:v1`, `segunda:ready`) y en la infraestructura (`/srv/segunda-piel`), pero el producto que se presenta se llama **outfit check**. El cambio no fue cosmético: "Segunda Piel" sonaba a marca de moda; "outfit check" describe la acción que el usuario hace. La URL, el deck y el CTA se unificaron alrededor de la segunda.

La restricción era dura y honesta:

- **4 horas.**
- **7 personas**, cada una con una habilidad distinta.
- **Sin backend, sin scraper, sin API de Vinted.**
- **La demo tenía que funcionar sin red.**
- **La presentación no podía prometer lo que el código no hacía.**

Esa última regla es la que más cambió el proyecto. No fue una nota al pie: fue un **ledger** que obligaba a etiquetar cada claim como `REAL`, `DEMO` o `ROADMAP`.

---

## 2. La línea de tiempo

| Hora | Qué pasó | Evidencia | Por qué importa |
|---|---|---|---|
| **13:06** | Repo creado | `b24eb5f` | El reloj empieza |
| **13:09** | README con descripción | `21887d0` | Primer contrato público: qué es esto |
| **13:49** | Plan de hackathon y nombre "Segunda Piel" | `ed913a0` | Se escribe el problema antes que el código |
| **13:55** | Reparto de 7 roles y pipeline de deploy | `e6a063b`, `7bb1da6` | La infraestructura se monta el primer día, no el último |
| **14:11** | `types.ts` + `mock-body.ts` congelados | `74d5e78` | **La decisión más importante de la tarde** |
| **14:21** | Primer mock de Vinted: 6 anuncios, botón y drawer | `0a050bc` | Ya hay una superficie de producto |
| **14:31** | `sync-check.sh` y protocolo de sincronización | `5c76bf8` | Tres ramas en paralelo necesitan reglas, no buena voluntad |
| **14:36** | Pipeline inteligente documentado | `02b27ef` | El LLM queda fuera del número desde el diseño |
| **14:39** | Auto-merge con revisor documentado | `6bc13f4` | `main` puede integrar sin que el lead sea un cuello de botella |
| **14:51** | Deck publicado y rename a **outfit check** | `e6a737a` | La marca y la narrativa se alinean |
| **15:07** | Landing con selector de deck, demo y visor | `1f9fc77` | El jurado puede entrar por donde quiera |
| **15:14** | Home móvil con 12 anuncios + visor integrado | `dddd62a` | El flujo completo ya se puede recorrer |
| **15:51** | Motor de cuerpo + base mesh CC0 integrada | `da7b074`, `9836fd4` | La geometría pasa de dibujo a medida |
| **16:15** | Footage y shotlist de vídeo | `49329a1` | La presentación también tiene materia prima |
| **16:42** | Maniquí liso, ropa interior y presets XS–Plus | `d32ef61` | El cuerpo se vuelve usable, no un experimento |
| **16:48** | Panel "Mi maniquí" | `0a6db0a` | El cuerpo es del usuario y persiste |
| **16:50** | Focus de demo a pantalla completa | `fd191f4` | La demo se puede enseñar sin chrome alrededor |
| **16:54** | Handshake temprano, cierre standalone, fuentes | `71a80e4` | La integración por iframe deja de ser frágil |
| **17:04** | Favicon y pulido del probador | `fd3dd97` | Detalles que hacen que parezca producto |
| **17:13** | Prenda 3D + materiales PBR | `88d99ff` | El probador enseña ropa, no solo un maniquí |
| **17:19** | Merge de `feat/cloth-viewer` | `3f3c0b0` | La prenda entra en `main` |
| **17:22** | Rework claro de 5 slides | `e5cccca` | La narrativa se adapta a lo que ya funciona |
| **17:29** | Últimos fixes de deck y viewer | `a7305f5` | Se cierra la ventana con el producto estable |

> **Nota sobre los tiempos:** la ventana oficial era de 4 horas. El arco de commits dura 4 h 23 min porque incluye merges, revisión y el cierre posterior. No se maquilla: se cuenta.

---

## 3. Las cinco apuestas

### 3.1. Contrato antes que código

A las 14:11, antes de que existiera un solo anillo renderizado, se congelaron `Body`, `Ring`, `Garment` y `FitResult` en `packages/fit-engine/src/types.ts`, junto a un `mock-body.ts` con un torso y unas piernas hardcodeados.

Esto permitió que el viewer se construyera **contra un fixture** desde el minuto 20, sin esperar al motor real. Cuando `buildBody()` llegó, sustituyó al fixture sin cambiar la interfaz. La lección no es "documenta los tipos": es **convierte la interfaz en el punto de paralelización**. Dos personas pueden avanzar si el contrato es estable aunque la implementación no exista.

### 3.2. Dos equipos, dos relojes

El equipo se partió en **3 implementación + 4 presentación**. No fue un reparto de lujo: fue una decisión de riesgo. La presentación tenía su propio deadline (deck cerrado, Q&A ensayado) y no podía esperar al código. La implementación tenía el suyo (vertical slice, feature freeze).

El puente entre ambos fue el **ledger**: la presentación no inventaba features; la implementación no ignoraba la narrativa. La persona de evidencia entendía el motor y podía defenderlo en Q&A. El Q&A es donde se pierden los hackathons.

### 3.3. Estático, offline, sin backend

La tentación era un servidor con API, base de datos y quizá un LLM. Se descartó por una razón de demo: **cada pieza de red es un punto de fallo el día del jurado**.

La demo se sirve como estáticos. Three.js, GLB, HDRI, texturas y fuentes están vendorizados. El cuerpo se guarda en `localStorage`. El único servidor es un `http.server` local o el poller del VPS. Si el Wi-Fi falla, la demo sigue.

### 3.4. Híbrido: base mesh CC0 + geometría paramétrica

El plan original era un cuerpo 100 % procedural con anillos. La matemática era elegante y el pitch era perfecto: *"3D artists can't model 500M listings. Math can."* Pero un cuerpo humano completo hecho solo de anillos, en cuatro horas, no alcanzaba la calidad visual necesaria para una demo de moda.

La decisión fue híbrida:

- **Base mesh CC0** (MakeHuman/Innerscene) para la anatomía.
- **Motor paramétrico** para el perfil, los landmarks, los anillos y la deformación.
- **Prenda procedural** recortada de la malla del cuerpo, separada por holgura y relajada.

Así se conserva la promesa de escalabilidad (la prenda no se modela por listing) sin sacrificar la credibilidad visual del maniquí. El pitch cambia de *"todo es matemática"* a *"la matemática decide la forma; la malla base es infraestructura"*. Es menos poético y más verdadero.

### 3.5. Ledger de verdad

Cada claim se etiquetó como `REAL`, `DEMO` o `ROADMAP`. El ledger no era un ejercicio de transparencia: era una **herramienta de diseño**. Si una feature no se podía enseñar, no se implementaba; si se implementaba a medias, se etiquetaba; si era una idea, iba a la slide de roadmap.

El resultado es un pitch que resiste la pregunta "¿esto es real?". La respuesta no es "sí, claro": es *"mira la fórmula, mira el mapa de tensión, mira el código"*.

---

## 4. Los pivotes

| Plan original | Lo que se shipó | Por qué |
|---|---|---|
| Viewer en **React + Vite + R3F** | **JavaScript + Three.js vendorizado**, sin build | Menos toolchain, carga instantánea, cero `npm install` el día de la demo, control total del loft |
| **Slidev** para el deck | **HTML/CSS/JS estático** 1920×1080 | Control pixel-perfect, demo real embebida, sin build ni dependencia de un tema |
| `apps/viewer/` + `apps/extension/` | `demo/vinted-mock/viewer3d/` + iframe | Una sola carpeta sirve demo, visor y preview; la extensión quedó fuera de alcance |
| `fit.ts` con `computeFit()` | **`fit-lite`** en `viewer3d/app.js` + contrato en `packages/fit-engine` | El viewer necesitaba el veredicto ya; el motor definitivo no llegó a integrarse |
| Cuerpo 100 % procedural | **Base mesh CC0 + deformación paramétrica** | La calidad visual importaba; la malla base es infraestructura, no catálogo |
| Prenda desde anillos del cuerpo | **Recorte de la malla + holgura + solver** | Más rápido y más creíble que loft puro; conserva la generación por medidas |
| LLM orquestador en vivo | **Plan determinista + tipos + documento** | Un LLM en la demo es una ruleta; se enseña el diseño, no se arriesga el número |
| Extensión Chrome MV3 | **Iframe con `postMessage`** | Cero integración, cero permisos, mismo contrato de UI |
| Vídeo Remotion final | **Footage + preview local** | El vídeo no era el entregable crítico; la demo en vivo sí |
| `pnpm dev` | **Servidor estático** (`serve.mjs` / `http.server`) | No hay workspace ni build; el repo se sirve tal cual |

**Lo importante:** ninguno de estos pivotes fue "nos rendimos". Fueron decisiones de asignación de tiempo. Cada una tiene un coste y una consecuencia, y están documentadas en [DECISIONS](DECISIONS.md).

---

## 5. Los tres problemas que enseñaron más

### 5.1. La media malla y el espejo

La base mesh es una **media malla** con corte sagital. Para que el cuerpo se vea completo, el viewer la espeja en Z. Eso funciona para la silueta, pero deja dos problemas:

1. El sombreado de la mitad espejada puede tener normales invertidas.
2. El encaje en el plano `Z = 0` no es perfecto.

La prenda hace el mismo espejo para cubrir pecho y espalda. El resultado se puede orbitar 360°, pero la costura sigue siendo el punto más frágil del visor. Está documentado en `docs/agent-notes/cloth-viewer-wip.md` y en [QUALITY](QUALITY.md).

**Lección:** en 3D, "espejar" no es un `scale.z = -1` y ya. Las normales, el orden de los triángulos y la continuidad de la superficie importan.

### 5.2. La copa de la manga

La manga se recorta de la malla real en A-pose. El largo funciona por proyección sobre el hueso `upperarm01 → wrist`, pero **no hay costura de sisa**. En el hombro se ve como una camiseta de neopreno: el borde del recorte no tiene copa.

La solución correcta es una costura de sisa y una copa con volumen. No había tiempo. Se quedó como WIP, con un remate de rib en el borde. Es honesto: el jurado técnico lo verá, y es mejor que lo vea con una explicación.

**Lección:** recortar una prenda de una malla es fácil; hacer que parezca confeccionada es otro problema. La diferencia está en las costuras.

### 5.3. La camiseta blanca sobre fondo claro

El estudio es claro, la camiseta es blanca rota y la exposición estaba alta. La prenda se comía con el fondo. Se bajó la exposición, se ajustó la luz y se separó el tono del papel.

**Lección:** el look de estudio no es un filtro; es una jerarquía de valores. En una demo de moda, si la prenda no se lee, no hay producto.

---

## 6. Lo que cambió con la investigación del 22 de octubre

La primera narrativa era genérica: "el 19,3 % de las compras online se devuelven". Cierto, pero lejano. La investigación de mercado cambió el foco:

- **20 M de personas en España** tienen problemas para encontrar su talla (estimación de mercado, etiquetada como tal).
- **53–67 %** de las devoluciones de moda son por talla o ajuste.
- En Vinted, el comprador asume el riesgo: **si no te queda, no hay devolución**.

La slide de datos dejó de ser un gráfico de devoluciones y pasó a ser una historia de talla. El deck se rehizo en clave clara, con dos cifras y una nota de fuente. El rename a **outfit check** acompaña ese cambio: ya no es una marca de moda, es una acción.

**Lección:** los datos no hablan solos. La misma cifra puede ser decorativa o demoledora según el marco. El marco correcto era "la talla es el problema", no "las devoluciones son caras".

---

## 7. Lo que aprendimos

1. **La demo es un producto, no un test.** Hay que construir la superficie (feed, ficha, CTA, drawer) y el fallback antes que la feature estrella. Sin superficie, no hay demo.
2. **Los contratos congelados son paralelización.** El mayor acelerador no fue una herramienta: fue `types.ts` + `mock-body.ts` a T+0:20.
3. **La determinación gana a la inteligencia.** Un LLM en el camino del número habría hecho la demo más impresionante y menos defendible. El veredicto es aritmética; el LLM decide y explica.
4. **La calidad visual es una decisión de alcance.** El híbrido base mesh + paramétrico no era el plan más elegante, pero era el que se podía enseñar con orgullo en cuatro horas.
5. **El deploy temprano reduce el riesgo de integración.** Tener previews por rama desde el primer día convirtió los merges en algo aburrido, que es exactamente lo que se quiere.
6. **El ledger evita el drift del pitch.** La presentación no podía prometer cloth sim; el ledger lo impedía. La honestidad se diseñó, no se improvisó.
7. **La documentación es parte del entregable.** Este documento no se escribió "después"; se escribió porque el proyecto necesitaba una memoria para el jurado y para el siguiente equipo.
8. **Lo que no se hizo también es una decisión.** Cloth sim, AR, extensión, visión en vivo y backend quedaron fuera por una razón. Saber decirlo es parte de la madurez.

---

## 8. Lo que no se hizo (y por qué)

| No-go | Por qué |
|---|---|
| **Cloth simulation real (XPBD)** | En 4 h, con colisiones contra un cuerpo paramétrico, es un agujero negro. La relajación + pliegues analíticos da el 80 % del look |
| **Cuerpo desde fotos** | Sin escala no hay centímetros; además rompe la promesa on-device. Documentado en `vision-extraction.md` |
| **AR en móvil** | Otro runtime, otro presupuesto, otra demo. Roadmap |
| **Extensión Chrome MV3** | El iframe prueba la integración con cero permisos y cero fricción. La extensión no cambia la historia |
| **Integración nativa con Vinted** | No hay API ni partnership; prometerlo sería el clásico humo de hackathon |
| **Backend / cuentas / DB** | Cada servicio es un punto de fallo y un problema de privacidad. `localStorage` basta para la promesa |
| **Vídeo final de 90 s** | Había footage y un preview; el entregable crítico era la demo en vivo. Se decidió no fingir un vídeo que no estaba cerrado |
| **Motor de fit completo en `fit.ts`** | El viewer necesitaba un veredicto ya; se implementó `fit-lite` y se mantuvo el contrato para la siguiente iteración |

---

## 9. Estado al cerrar

### Producto

- **12 anuncios** en un marketplace local tipo Vinted, con feed, filtros, búsqueda, favoritos, ficha, carrusel y drawer.
- **Visor 3D** con maniquí paramétrico, base mesh CC0, ropa interior, presets XS–Plus, panel "Mi maniquí" y persistencia local.
- **Prenda 3D** para 6 tipos, con holgura por zona, solver de caída, remates y materiales PBR.
- **Veredicto** con holgura, zona crítica, confianza y medidas faltantes.
- **Deck** de slides HTML con la demo real embebida.
- **Deploy** con producción y previews por rama.

### Calidad

- Verificación numérica del motor de cuerpo con 5 perfiles (incluido un perfil con medidas inferidas).
- `node --check` en todos los JS de la demo.
- Smoke tests headless en Chromium a 1280×900 y 390×844.
- Sin peticiones de red en el runtime del viewer.
- Ledger de claims con evidencia y límites.

### Lo que falta para que sea producto

1. **`computeFit()` definitivo** en `packages/fit-engine/src/fit.ts`, con tests y reemplazo de `fit-lite`.
2. **Terminar la prenda**: costura de sisa, cuello, sombreado de la media malla espejada, solapa/forro.
3. **Extracción de medidas**: OCR de cinta + Jev como clasificador, con `source` y `confidence` visibles.
4. **Orquestador LLM** con `planDeterministic()` como fallback y el explicador sin poder tocar el veredicto.
5. **Extensión / SDK**: el mismo contrato de UI, primero iframe, luego una línea de script.
6. **Suite E2E** con Playwright y presupuesto de rendimiento medido.

---

## 10. Apéndice: reconstruir la historia

La historia está en el grafo, no en este documento. Para verificarla:

```bash
# Cronología completa, con ramas y merges
git log --graph --oneline --all --decorate

# Commits con fecha y asunto
TZ=Europe/Madrid git log --all --format='%cd | %h | %s' --date=format:'%H:%M'

# Qué cambió un commit concreto
git show --stat 74d5e78
git show --stat 88d99ff

# Qué archivos tocó cada rama
git diff --stat main...feat/geometry
git diff --stat main...feat/presentation-viewer
```

**Cómo leerlo:** los commits `auto-merge: ...` son integraciones del revisor; los `Merge branch ...` son merges de ramas; los `fix(...)` de las 17:00 son pulido de demo, no features nuevas. La ventana de features se cerró antes; lo que queda después es estabilización.

---

<div align="center">
<sub>La historia no se escribe para justificar lo que hay. Se escribe para que el siguiente equipo no tenga que redescubrirlo.</sub>
</div>
