# Deck — Segunda Piel

Product deck modular en HTML/CSS/JS, sin build, con la demo móvil y desktop de Vinted embebida.

## Arrancar

```bash
cd /home/fabio/Code/hackerton-22-10
./deck/start.sh
```

El script sirve la raíz del repo para que el deck y los mocks compartan origen. Imprime la URL; si `8080` está ocupado, elige el siguiente puerto libre.

También puedes forzar el puerto:

```bash
PORT=8123 ./deck/start.sh
# http://localhost:8123/deck/
```

> El deck carga las slides con `fetch`, así que tiene que servirse por HTTP. Abrirlo con `file://` no funciona.

## Estructura

```
deck/
├── index.html            ← shell: chrome, stage, overview
├── manifest.js           ← orden y lista de slides
├── css/
│   ├── theme.css         ← colores, fuentes, tamaños, márgenes
│   ├── deck.css          ← base, chrome, layouts
│   ├── charts.css        ← gauge, lollipop, range, cost, dot ring, money
│   └── demo.css          ← demo móvil/desktop + focus
├── js/
│   └── deck.js           ← loader, navegación, charts, demo
├── slides/
│   ├── _template.html    ← plantilla para crear una slide
│   ├── 00-cover.html
│   ├── 01-problem.html
│   ├── 02-returns.html
│   ├── 03-fashion.html
│   ├── 04-fit.html
│   ├── 05-cost.html
│   ├── 06-adoption.html
│   ├── 07-impact-volume.html
│   ├── 08-impact-money.html
│   ├── 09-product.html
│   ├── 10-demo.html
│   └── 11-closing.html
├── assets/               ← imágenes locales
├── fonts/                ← Instrument Serif + Inter + JetBrains Mono
└── start.sh
```

## Crear una slide en 3 pasos

1. Copia `slides/_template.html` a `slides/12-mi-slide.html`.
2. Edita el `<section>`: `data-title`, `data-section`, kicker y contenido.
3. Añádela a `manifest.js`, en el orden que quieras:

```js
{ file: 'slides/12-mi-slide.html', title: 'Mi slide', section: 'SECCIÓN' }
```

Recarga. El contador, la barra de progreso y el índice (`O`) se recalculan solos.

### Quitar / reordenar

Borra o mueve entradas en `manifest.js`. No hay que tocar `index.html` ni `deck.js`.

## Cambiar la estética

Todo lo global está en **`css/theme.css`**:

```css
--bg:#07080A;          /* fondo */
--paper:#F2EFE8;       /* texto principal */
--teal:#16B8B0;        /* marca */
--teal-bright:#6FE3DB; /* acento / charts */
--coral:#FF6B5A;       /* alerta / coste */
--amber:#FFB05C;       /* aviso */
--green:#4ADE9B;       /* positivo */
--blue:#6EA8FF;        /* mercado */
--content-x:120px;     /* margen lateral de todas las slides */
--content-y:88px;      /* margen superior */
--font-display:...;    /* titular */
--font-ui:...;         /* cuerpo */
--font-mono:...;       /* datos */
```

Los charts usan `--chart-main`, `--chart-coral`, etc. Cambia esos tokens y cambian todos los gráficos a la vez.

### Cambiar el fondo de una slide

Añade una clase al `<section>`:

```html
<section class="slide glow-teal ...">
```

Disponibles: `glow-teal`, `glow-coral`, `glow-green`, `glow-blue`, `glow-amber`.

## Charts disponibles

| Chart | Slide de referencia | Cómo se usa |
|---|---|---|
| Gauge 270° | `02-returns.html` | `data-gauge="19.3"` + `.gauge__center` |
| Lollipop / rango | `03-fashion.html` | SVG con `.lollipop__line`, `.lollipop__dot`, `.lollipop__range` |
| Range plot | `04-fit.html` | SVG con `.range__track`, `.range__band`, `.range__marker` |
| Barra de coste | `05-cost.html` | `.cost-bar` + `.cost-bar__fill` |
| Dot ring 100 | `06-adoption.html` | `data-dot-ring="85"` + `.dot-ring__center` |
| Unit chart 4 | `07-impact-volume.html` | 4 `.volume-unit`, una `.on` |
| Donut + money | `08-impact-money.html` | `.impact-donut` + `.money-block` |

Para copiar un chart, copia su bloque HTML y, si añades clases nuevas, su bloque de `charts.css`.

## Demo

La slide `10-demo.html` tiene dos dispositivos:

- **Móvil**: mock original de Vinted (`demo/vinted-mock/`).
- **Desktop**: `demo/vinted-mock/desktop.html`, un marketplace de escritorio con feed, filtros y panel de detalle.

Se cargan de forma diferida al activar la pestaña. El botón **Ampliar demo**, un click en el propio dispositivo o la tecla `D` entran en **focus**: ocultan el resto de la slide y el chrome, ponen fondo negro opaco y escalan la demo al máximo dentro de 1920×1080, centrada. `Esc`, el botón **Salir · Esc** o `D` de nuevo vuelven al deck.

Para apuntar el probador 3D a otro viewer:

```
http://localhost:8123/deck/?viewer=./viewer3d/
```

El CTA del mock abre por defecto el visor local `demo/vinted-mock/viewer3d/`, sin levantar un segundo servidor ni depender de `localhost:5173`.

## Teclas

| Tecla | Acción |
|---|---|
| `→` `↓` `Espacio` `PageDown` | Siguiente |
| `←` `↑` `PageUp` | Anterior |
| `Home` / `End` | Primera / última |
| `O` | Índice de slides |
| `D` | Focus de la demo (si estás en la slide de demo) |
| `Esc` | Salir de focus / índice |
| `F` | Pantalla completa |

`?slide=N` abre una slide concreta. `?viewer=...` cambia el visor 3D embebido.

## Datos

Los datos y fuentes están en `docs/STATS.md` y `docs/pitch.md`. Cada slide de estadística lleva su fuente en `.slide__foot`. Las estimaciones están marcadas como tales.
