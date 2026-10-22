# Deck — outfit check

Deck horizontal 1920×1080, sin build, con tema claro inspirado en Vinted, fondo animado y la demo real embebida.

## Arrancar

```bash
cd /home/fabio/Code/hackerton-22-10
PORT=8123 ./deck/start.sh
# http://localhost:8123/deck/
```

> Las slides se cargan con `fetch`: hace falta HTTP, no `file://`.

## Estructura

```
deck/
├── index.html             ← shell: fondo animado, chrome y overview
├── manifest.js            ← las 5 slides, en orden
├── css/
│   ├── theme.css          ← fuentes y tokens base
│   ├── deck.css           ← stage 16:9, chrome y animaciones
│   ├── demo.css           ← comportamiento de la demo y focus
│   ├── vinted.css         ← tema claro Vinted + fondo animado
│   ├── vinted-cover.css   ← portada + problema
│   ├── vinted-stats.css   ← las dos slides de dinero
│   ├── vinted-demo.css    ← demo en vivo
│   └── vinted-final.css   ← ajustes de integración
├── slides/
│   ├── 20-cover.html
│   ├── 21-problem.html
│   ├── 22-demo.html
│   ├── 23-cost.html
│   └── 24-volume.html
├── assets/
├── fonts/
└── start.sh
```

Las slides antiguas siguen en `slides/` como archivo, pero no se cargan: **el orden real está en `manifest.js`**.

## Las 5 slides

1. **Portada** — wordmark, móvil rotado y demo real.
2. **Problema** — talla y devolución, con la foto y la etiqueta.
3. **Demo** — móvil/desktop en vivo; click o `Ampliar demo` para focus.
4. **Coste** — 25–35 € por devolución; 66 % del precio.
5. **Escala** — 750.000 € al año en 100.000 pedidos (estimación transparente).

## Cambiar el tema

El tema global está en **`css/vinted.css`**:

```css
--bg:#F7F6F1;
--paper:#0B2B2A;
--teal:#007782;
--teal-bright:#00B3A6;
--mint:#DDF4EF;
--coral:#FF6F5E;
--content-x:96px;
```

El fondo animado son tres blobs + ondas SVG en `index.html`, animados desde `vinted.css`. Los ajustes finos de composición están en `vinted-final.css`.

## Quitar o reordenar slides

Edita solo `manifest.js`:

```js
slides: [
  { file: 'slides/20-cover.html',   title: 'Outfit Check', section: 'INTRO' },
  { file: 'slides/21-problem.html', title: 'La talla',     section: 'PROBLEMA' },
  { file: 'slides/22-demo.html',    title: 'Demo en vivo', section: 'DEMO' },
  { file: 'slides/23-cost.html',    title: 'El coste',     section: 'DINERO' },
  { file: 'slides/24-volume.html',  title: 'La escala',    section: 'DINERO' }
]
```

El contador, la barra y el índice (`O`) se recalculan solos. Para una slide nueva, copia una existente y añádela al manifest.

## Demo

`22-demo.html` mantiene los hooks del motor:

- `data-demo="true"` en la slide.
- `data-demo-tab="phone|desktop"`.
- `data-device="phone|desktop"`.
- `iframe[data-src]` para carga diferida.
- `data-demo-focus` para ampliar; `data-demo-external` para abrir aparte.

**Focus**: oculta copy, tabs, chrome, fondo y grain; deja solo la demo centrada y escalada al máximo dentro de 1920×1080. `Esc`, el botón **Salir** o `D` vuelven al deck. En focus el overlay de click se desactiva para poder interactuar con el iframe.

Para apuntar el probador a otro viewer:

```
http://localhost:8123/deck/?viewer=./viewer3d/
```

## Teclas (no se muestran en pantalla)

| Tecla | Acción |
|---|---|
| `→` `↓` `Espacio` `PageDown` | Siguiente |
| `←` `↑` `PageUp` | Anterior |
| `O` | Índice |
| `D` | Focus de demo |
| `Esc` | Salir de focus / índice |
| `F` | Pantalla completa |

`?slide=N` abre una slide concreta. `?viewer=...` cambia el visor 3D embebido.

## Datos

Fuentes en `docs/STATS.md` y `docs/pitch.md`. Cada slide de dinero lleva su fuente o la marca de estimación en la nota inferior.
