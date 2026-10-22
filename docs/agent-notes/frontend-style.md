# Frontend style — outfit check

> Dirección de arte: **estudio de sastrería técnico**, no "app de IA".
> Precisión, papel, tinta, una sola luz. Nada de degradados morados, glassmorphism ni blobs 3D.

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#111110` | Texto principal, fondos de slide |
| `--paper` | `#F6F4EF` | Fondo claro |
| `--studio` | `#E7E4DE` | Fondo del visor 3D (neutro cálido) |
| `--accent` | `#007782` | Acento (teal Vinted), botón primario |
| `--accent-ink` | `#005A62` | Hover |
| `--muted` | `#6B6862` | Texto secundario |
| `--line` | `rgba(17,17,16,.12)` | Bordes |

### Semántica del fit (solo para el heatmap y el veredicto)

| Estado | Hex | Significado |
|---|---|---|
| `too-small` | `#D93A2B` | No cierra / aprieta |
| `tight` | `#E8892B` | Justo |
| `regular` | `#2F9E6B` | Bien |
| `loose` | `#4A7DBF` | Holgado |

**Regla:** estos 4 colores no se usan para nada más. El acento de marca es teal; el fit es un semáforo aparte.

## Tipografía

- **Display / titulares:** `Instrument Serif` (Google Fonts). Da aire editorial de moda, no de startup.
- **UI / cuerpo:** `Inter` (variable). Pesos 400/500/600.
- **Números y medidas:** `JetBrains Mono` o `IBM Plex Mono`. Los centímetros siempre en mono: refuerza "esto es un dato".
- Escala: 12 / 14 / 16 / 20 / 28 / 40 / 64 / 96.
- Titulares con `letter-spacing: -0.02em`. Cuerpo `line-height: 1.5`.

## Espaciado y forma

- Base 4 px. Escala 4/8/12/16/24/32/48/64.
- Radios: 8 px en controles, 16 px en paneles, `999px` en pills.
- Sombras: una sola, suave y amplia (`0 24px 60px rgba(0,0,0,.10)`). Nada de stacks de sombras.
- Bordes de 1 px con `--line`, nunca grises puros.

## Componentes

- **Botón primario:** fondo `--accent`, texto blanco, alto 40 px, radio 8, sin sombra.
- **Botón "Ver cómo te queda":** pill, icono de maniquí a la izquierda, 44 px de alto. Es el héroe de la demo.
- **Panel lateral:** 420 px de ancho en desktop, 100% en móvil, fondo `--paper`, borde izquierdo de 1 px, sin blur.
- **Slider:** track de 2 px, thumb de 16 px, valor siempre visible en mono.
- **Badge de veredicto:** pill con el color semántico + texto en `--ink`, no blanco (contraste).
- **Leyenda del heatmap:** 4 chips con etiqueta (`aprieta / justo / bien / sobra`). Nunca un gradiente sin leyenda.

## Visor 3D

- Fondo `--studio`, suelo con sombra de contacto suave, sin horizonte.
- Luz: key suave arriba-izquierda, fill frío tenue, rim light sutil. HDRI de estudio.
- Cámara: 50 mm equivalente, altura del pecho, órbita limitada (sin volar por debajo del suelo).
- **Maniquí sin cara.** Cabeza abstracta lisa. Es decisión de producto, no un fallo.
- Sin postproceso agresivo: SSAO sutil + `toneMapping: ACESFilmic`. Nada de bloom fuerte.

## Qué NO hacer (lista negra)

- Degradado morado/azul "IA".
- Glassmorphism y blur por todas partes.
- Emojis en la UI.
- Iconos de 3 estilos distintos. Usar **Lucide** y no mezclar.
- Fotos de stock sonriendo.
- Sombras duras o bordes negros.
- Texto sobre imagen sin contraste.
- Más de 2 tipografías.
- Animaciones de más de 300 ms.
- Confeti.

## Movimiento

- Entrada del panel: 240 ms, `cubic-bezier(.2,.8,.2,1)`, translateX + fade.
- La prenda aparece con un fade de 400 ms; nunca "pop".
- Los sliders actualizan la geometría sin transición (debe sentirse inmediato).
- El cambio de cuerpo en la demo: cross-fade de 200 ms. Es el beat emocional, que se note pero no se dramatice.
