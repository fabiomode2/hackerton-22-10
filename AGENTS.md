# AGENTS.md — contrato de colaboración

Proyecto: **outfit check** — probador 3D para moda de segunda mano (Vinted-first).
Ventana: **4 horas**. Este archivo manda sobre la organización del repo. Si algo no está aquí, preguntar al lead antes de inventarlo.

## Reglas de oro

1. **Una carpeta, un dueño.** No editar carpetas de otra persona. Si necesitas un cambio fuera de tu carpeta, pídelo al lead.
2. **Congelar contratos a T+0:20.** Los esquemas JSON de `packages/fit-engine` no cambian después sin avisar a todos.
3. **Real > bonito.** Un vertical slice funcionando vale más que tres features a medias.
4. **Nada de features nuevas después del feature freeze (T+2:50).** Solo bugs, pulido y demo.
5. **La presentación no promete lo que el código no hace.** Todo claim va al ledger `docs/pitch.md` como `REAL`, `DEMO` o `ROADMAP`.
6. **Assets pequeños.** Nada > 5 MB en git. GLB comprimido con `gltf-transform`. HDRIs y vídeos fuera del repo o en `assets/` con `.gitignore` si pesan.

## Mapa de propiedad

Equipo: **7 personas = 3 implementación + 4 presentación.** Lead = Fabio.

### Asignación

| Rol | Persona | Rama |
|---|---|---|
| **Geometría (cuerpo + prenda)** | @manumuxoz | `feat/geometry` |
| **Fit + Viewer** | @jaimepernasperez | `feat/fit-viewer` |
| **Integración + demo + lead** | @fabiomode2 | `feat/integration` |
| **Evidencia + slide técnica + Q&A** | @mranomyro | — (presentación) |

### Propiedad de archivos

| Ruta | Dueño | Contenido | Stack |
|---|---|---|---|
| `packages/fit-engine/src/body.ts` | **Manu** | Cuerpo paramétrico, anillos, sliders ↔ medidas | TS puro |
| `packages/fit-engine/src/garment.ts` | **Manu** | Prenda procedural, mangas, holguras | TS puro |
| `packages/fit-engine/src/fit.ts` | **Jaime** | Tensión, veredicto, `confidence`, medidas que faltan | TS puro |
| `packages/fit-engine/src/types.ts` + `mock-body.ts` | **Fabio** | Contrato congelado + fixture para no bloquear | TS puro |
| `apps/viewer/` | **Jaime** | Escena 3D, materiales, sliders, leyenda, drawer | Vite + React + R3F |
| `demo/vinted-mock/` + `apps/extension/` | **Fabio** | Página Vinted, botón, iframe, SDK, Playwright, build offline | TS + Chrome MV3 |
| `deck/` | **Pres 1** | Presentación | Slidev |
| `video/` | **Pres 2** | Vídeo demo | Remotion + ffmpeg |
| `design/` + `frontend-style.md` | **Pres 3** | Marca, tokens, mockups, ensayo | Pencil + Markdown |
| `docs/STATS.md` + slide técnica | **María** | Datos, competencia, Q&A | Markdown |

**Regla:** Manu y Jaime comparten carpeta pero **nunca el mismo archivo**. Solo Fabio toca `types.ts`. Si hay que cambiar el contrato, se avisa en voz alta antes de editar.

## Contrato de datos (NO cambiar sin avisar)

Unidades: **cm** en los datos, **metros** en la escena (`× 0.01`).
Ejes: **Y** arriba, **Z** frontal, **X** derecha. Origen en el suelo, entre los pies.

```ts
type Body = {
  height_cm: number;      // 150–210
  bust_cm: number;        // contorno de pecho
  waist_cm: number;       // contorno de cintura
  hips_cm: number;        // contorno de cadera
  shoulder_cm: number;    // ancho de hombro, punta a punta
  inseam_cm: number;      // entrepierna → suelo
  arm_cm?: number;        // largo de brazo
};

type Garment = {
  type: 'tshirt' | 'hoodie' | 'dress' | 'jeans' | 'jacket';
  fabric: 'cotton_jersey' | 'fleece' | 'denim' | 'knit' | 'linen' | 'leather';
  measurements: {
    pit_to_pit_cm?: number;   // plano, axila a axila
    length_cm?: number;       // largo total
    shoulder_cm?: number;
    sleeve_cm?: number;
    waist_cm?: number;        // plano
    hips_cm?: number;         // plano
    inseam_cm?: number;
    rise_cm?: number;
    thigh_cm?: number;        // plano
  };
};
```

Resultado del motor:

```ts
type FitResult = {
  verdict: 'too_small' | 'tight' | 'regular' | 'loose' | 'too_big';
  ease_cm: number;            // holgura en el punto crítico (el más negativo)
  confidence: number;         // 0–1, según cuántas medidas traiga el listing
  zones: { name: string; ease_cm: number; tension: number; verdict: string }[];
  missing: string[];          // medidas que faltan
};
```

## Sincronización — regla obligatoria para agentes

**Este repo lo están tocando 3 personas a la vez, cada una en su rama, y el lead mergea a `main` cada 30–45 min. Si no compruebas el remoto, estás trabajando sobre código viejo.**

### Al empezar cada tarea (sin excepción)

```bash
git fetch origin --prune
git status -sb
```

- Si `status -sb` dice `[behind N]` → **el pull no es opcional**. Hazlo antes de escribir una sola línea.
- Si dice `[diverged]` → **para y avisa**. No hagas `merge` a ciegas ni `reset`.
- Si tu rama no tiene upstream → `git push -u origin HEAD`.

### Durante la tarea (cada 15–20 min o al cambiar de archivo)

```bash
./scripts/sync-check.sh
```

El script hace `fetch`, compara con el remoto y devuelve un código de salida:

| Exit | Significado | Qué hace el agente |
|---|---|---|
| `0` | Al día | Seguir |
| `10` | Tu rama va por detrás | `git pull --rebase` y seguir |
| `20` | `main` avanzó (hay merges nuevos) | Rebase sobre `origin/main` o pedir merge al lead |
| `30` | Divergencia / conflicto | **Parar**. Avisar al lead. No forzar nunca |
| `40` | Hay cambios sin commitear | Commit o stash antes de tocar el remoto |

### Antes de cualquier commit

1. `git fetch origin`
2. Comprobar si `origin/main` tiene commits que no tienes.
3. Si los tiene y tocas archivos compartidos (`types.ts`, `package.json`, `pnpm-workspace.yaml`) → **rebase primero**.
4. Nunca `git push --force` sobre una rama compartida. Solo el lead puede forzar, y solo sobre su propia rama.

### Qué se considera "algo importante" que hay que detectar

Un agente debe **parar y leer** si al hacer fetch ve:

- Un commit en `main` que toca `packages/fit-engine/src/types.ts` → el contrato cambió.
- Un commit que toca `package.json` o `pnpm-workspace.yaml` → dependencias nuevas, hay que reinstalar.
- Un commit que añade o renombra algo en `apps/viewer/src/` → la escena cambió.
- Un commit con `BREAKING` o `!` en el asunto.
- Cualquier commit de otra persona en **tu** rama → alguien se equivocó de rama.

En esos casos: `git log -p <rango> -- <archivo>` y avisar en el canal antes de seguir. **No asumir que el cambio es compatible.**

### Prohibido

- `git pull` sin `--rebase` en una rama con commits propios (crea merges basura).
- `git reset --hard` sobre trabajo ajeno.
- Trabajar 40 minutos sin un solo `fetch`.
- Ignorar un `[behind]` porque "luego lo miro".

## Convenciones

- **Commits:** `feat(viewer): ...`, `fix(fit-engine): ...`, `docs(deck): ...`, `chore: ...`
- **Ramas:** una por persona (`feat/geometry`, `feat/fit-viewer`, `feat/integration`, `feat/deck`, `feat/video`). El lead integra cada 30–45 min.
- **Nombres de archivos:** `kebab-case`. Componentes React: `PascalCase`.
- **Idioma:** UI en español (es-ES), código e identificadores en inglés, docs en español.
- **Sin backend.** Todo local, sin red en la demo. Si algo necesita red, se precalcula.
- **Sin scraping en vivo.** La demo corre contra `demo/vinted-mock/`.

## Notas entre agentes

Cada descubrimiento no obvio va a `docs/agent-notes/`. Formato: máximo 5 bullets, con `Qué probé / Qué funcionó / Qué NO / Gotcha / Siguiente`.

- `frontend-style.md` — tokens, tipografía, componentes, qué NO hacer visualmente.
- `3d-procedural.md` — matemáticas del cuerpo/prenda, unidades, convenciones, trampas de Three.js.
- `vinted-data.md` — cómo se mapean las medidas de un listing al motor.
- `demo-script.md` — guion y plan B de la demo.

Si tu discovery salva 10 minutos a otra persona, escríbelo. Si no, no llenes el repo.

## Visión / extracción de medidas desde fotos

**Leer `docs/vision-extraction.md` antes de proponer cualquier feature de "medir la prenda con IA".**

Resumen ejecutivo, para que nadie reinvente esto ni prometa de más:

1. **Jev** (TypeSafe, 1.14+) acepta imágenes desde el 14/10/2026, pero **no genera texto**: solo `choice`, `noul`, `score` y `box`. Sirve para clasificar tipo de prenda y tejido, y para detectar si hay cinta métrica. **No sirve para leer centímetros.**
2. **Sin referencia de escala no se pueden sacar cm de una foto.** Es física. Los papers que lo consiguen usan LiDAR, ArUco o fotos de estudio controladas.
3. **El atajo real:** muchos listings fotografían la cinta métrica sobre la prenda → `¿hay cinta? (noul) → ¿dónde? (box) → OCR → validar en el motor`.
4. **Medidas de cuerpo desde fotos: ROADMAP**, no MVP, y con un problema de privacidad que rompe la promesa on-device.
5. **En estas 4 horas no se implementa visión en vivo.** Si se hace algo, se precalcula y se etiqueta como `DEMO` en el ledger.

**Regla dura:** una medida estimada **nunca** se presenta como declarada por el vendedor. Siempre con `source` y `confidence` visibles en la UI.

## Pipeline inteligente (orquestador + herramientas)

**Leer `docs/pipeline.md`. Resumen de lo que no se negocia:**

```
listing + fotos + cuerpo
   → [0] normalizar (determinista)
   → [1] LLM orquestador: decide qué herramientas llamar (JSON estricto)
   → [2] herramientas: jev.classify / jev.has_tape / jev.locate_tape / ocr.tape
   → [3] fusión con precedencia + detección de conflicto
   → [4] validación física + reparación (máx 2 vueltas)
   → [5] motor: aritmética pura → FitResult
   → [6] LLM explicador: 1 frase + 1 pregunta (no puede tocar el veredicto)
```

**Las cuatro reglas:**

1. **El LLM decide y explica. Nunca mide.** Si un modelo genera el número, la demo es una ruleta.
2. **El veredicto sale solo del motor.** Ni el orquestador ni el explicador pueden cambiarlo.
3. **Tiene que existir `planDeterministic()`** (`docs/pipeline.md` §9). Si el LLM falla o tarda > 800 ms, se usa y nadie lo nota. Sin fallback no hay demo.
4. **Precedencia de fuentes:** `seller_stated` (1.0) > `ocr_tape` (0.85) > `calibrated_photo` (0.8) > `inferred` (0.45) > `vlm_estimate` (0.3). Nunca promediar medidas que discrepan > 5 cm.

**En estas 4 horas:** plan determinista + fusión + validación + plantillas de texto. El orquestador LLM, en una slide con el JSON real. Visión en vivo, no.

## Definition of Done

- `pnpm dev` arranca en frío, sin pasos manuales, sin red.
- La demo completa (listing → botón → drawer → veredicto → cambio de cuerpo) corre en < 60 s sin tocar la consola.
- El deck abre desde el PDF exportado y desde Slidev.
- Hay un MP4 de respaldo de la demo grabado antes del ensayo.
- `docs/pitch.md` marca cada claim como REAL / DEMO / ROADMAP.

## Publicar

### Auto-deploy: GitHub es la única fuente

Cada `git push` a una rama distinta de `main` publica un preview automático en el siguiente ciclo del poller (**≈20 s, más lo que tarde la build**). No hace falta SSH al VPS, ni ejecutar comandos de deploy, ni mergear a `main` para ver el cambio.

| Rama | Destino |
|---|---|
| `main` | Producción |
| Cualquier otra rama | Preview de esa rama |

- El preview se reemplaza entero en cada push (swap atómico).
- Borrar la rama en GitHub borra su preview.
- GitHub Actions **no** está deployando: no hay secretos configurados. El deployer activo es el poller del VPS. No configures Actions y poller a la vez.
- No edites nada dentro de `releases/`, `previews/` o `current`: son del deployer y se sobrescriben.
- No necesitas acceso al VPS. No pidas SSH ni credenciales; si el preview falla, se investiga desde GitHub y los logs del deployer.

### URLs

| Qué | URL |
|---|---|
| Producción | `https://hack.cesura.duckdns.org/` (redirige a `/deck/`) |
| Deck | `https://hack.cesura.duckdns.org/deck/` |
| Demo Vinted | `https://hack.cesura.duckdns.org/demo/vinted-mock/` |
| Viewer | `https://hack.cesura.duckdns.org/viewer/` (redirige al visor `demo/vinted-mock/viewer3d/`) |
| Viewer directo | `https://hack.cesura.duckdns.org/demo/vinted-mock/viewer3d/?listing=carhartt-hoodie-m` |
| Índice de previews | `https://hack.cesura.duckdns.org/preview/` |
| Preview de tu rama | `https://hack.cesura.duckdns.org/preview/<slug>/` |

Slug: minúsculas, `/` → `-`, cualquier carácter fuera de `[a-z0-9-]` → `-`, y se colapsan los guiones repetidos.
Ejemplo: `feat/fit-viewer` → `https://hack.cesura.duckdns.org/preview/feat-fit-viewer/`.

Los assets del viewer `viewer3d/` usan rutas relativas; funciona igual en `/demo/vinted-mock/viewer3d/` y en `/preview/<slug>/demo/vinted-mock/viewer3d/`. No hardcodees `localhost` ni rutas absolutas.

### Flujo obligatorio del agente

1. `git fetch origin --prune`
2. `./scripts/sync-check.sh`
3. `git add -A && git commit -m "tipo(scope): ..."`
4. `git push -u origin HEAD`
5. Esperar a que el poller reconstruya y abrir `https://hack.cesura.duckdns.org/preview/<slug>/`.
6. Verificar que carga la página y el asset principal. Si sigue en 404 después de 60 s, confirmar que el push llegó a GitHub y que el slug es correcto; **no entrar al VPS**.

**Regla:** nadie hace push directo a `main` salvo el lead. Todo lo demás entra por rama + preview. La URL de preview es lo que se comparte en el canal; no una captura local.
