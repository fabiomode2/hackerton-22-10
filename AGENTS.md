# AGENTS.md — contrato de colaboración

Proyecto: **Segunda Piel** — probador 3D para moda de segunda mano (Vinted-first).
Ventana: **4 horas**. Este archivo manda sobre la organización del repo. Si algo no está aquí, preguntar al lead antes de inventarlo.

## Reglas de oro

1. **Una carpeta, un dueño.** No editar carpetas de otra persona. Si necesitas un cambio fuera de tu carpeta, pídelo al lead.
2. **Congelar contratos a T+0:20.** Los esquemas JSON de `packages/fit-engine` no cambian después sin avisar a todos.
3. **Real > bonito.** Un vertical slice funcionando vale más que tres features a medias.
4. **Nada de features nuevas después del feature freeze (T+2:50).** Solo bugs, pulido y demo.
5. **La presentación no promete lo que el código no hace.** Todo claim va al ledger `docs/pitch.md` como `REAL`, `DEMO` o `ROADMAP`.
6. **Assets pequeños.** Nada > 5 MB en git. GLB comprimido con `gltf-transform`. HDRIs y vídeos fuera del repo o en `assets/` con `.gitignore` si pesan.

## Mapa de propiedad

| Carpeta | Dueño | Contenido | Stack |
|---|---|---|---|
| `packages/fit-engine/` | Dev 1 | Medidas → cuerpo paramétrico → prenda → tensión → veredicto | TypeScript puro, sin DOM |
| `apps/viewer/` | Dev 2 | Escena 3D, materiales, sliders, leyenda, drawer | Vite + React + R3F |
| `apps/extension/` + `demo/vinted-mock/` | Dev 3 | Página Vinted clonada, botón, iframe, SDK, grabación | TS + Chrome MV3 + Playwright |
| `deck/` | Pres 1 | Presentación | Slidev |
| `video/` | Pres 2 | Vídeo demo | Remotion + ffmpeg |
| `docs/` | Pres 3 / lead | Pitch, stats, notas de agentes, marca | Markdown |
| `AGENTS.md`, `package.json`, `pnpm-workspace.yaml` | Lead | Contratos e integración | — |

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
  verdict: 'tight' | 'snug' | 'regular' | 'loose' | 'too_small' | 'too_big';
  ease_cm: number;            // holgura real en el punto crítico
  confidence: 0..1;           // según cuántas medidas haya
  zones: { name: string; ease_cm: number; tension: number }[];
  missing: string[];          // medidas que faltan
};
```

## Convenciones

- **Commits:** `feat(viewer): ...`, `fix(fit-engine): ...`, `docs(deck): ...`, `chore: ...`
- **Ramas:** una por persona (`feat/viewer`, `feat/engine`, `feat/integration`, `feat/deck`, `feat/video`). El lead integra cada 30–45 min.
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

## Definition of Done

- `pnpm dev` arranca en frío, sin pasos manuales, sin red.
- La demo completa (listing → botón → drawer → veredicto → cambio de cuerpo) corre en < 60 s sin tocar la consola.
- El deck abre desde el PDF exportado y desde Slidev.
- Hay un MP4 de respaldo de la demo grabado antes del ensayo.
- `docs/pitch.md` marca cada claim como REAL / DEMO / ROADMAP.
