# Shot list — vídeo Segunda Piel

Propuesta de pieza de **75 s** (recortable a 30 s para el cold open). Los timecodes de fuente son orientativos: están pensados para cortar antes de que el clip pierda intención.

## Estructura

| Tramo | Clip | In–out fuente | Qué cuenta | Recurso en edición |
|---|---|---|---|---|
| 0:00–0:08 | `01-vender-foto-vestido-casa` | 0:01–0:07 | Alguien fotografía una prenda en casa para venderla. | Sonido ambiente + shutter. Sin música. |
| 0:08–0:10 | `02-vender-inserto-movil-percha` | 0:00–0:02 | El gesto exacto: el móvil encuadra la ropa. | Insert rápido. |
| 0:10–0:16 | `04-vender-revisar-fotos-portatil` + `05-vender-editar-foto-portatil` | 0:00–0:03 cada uno | Del móvil al anuncio: seleccionar y editar fotos. | Corte seco, sin transición. |
| 0:16–0:22 | `06-vender-scroll-app-movil` + `07-vender-live-selling` | 0:03–0:08 / 0:05–0:09 | Publicar y enseñar la prenda. | Si se usa el móvil, enmascarar la pantalla con `23-ui-vinted-feed`. |
| 0:22–0:30 | `10-medir-cintura-vaqueros` + `11-medir-sujetador-online` + `12-medir-espalda-hombre` | 0:02–0:05 cada uno | Las medidas ya existen: cinta métrica, no IA adivinando. | Congelar el último frame de `11` y empezar el overlay de análisis. |
| 0:30–0:36 | Captura del viewer real | — | El cuerpo 3D y la prenda. | **Pendiente de grabar del viewer**. No usar el fallback del mock. |
| 0:36–0:44 | `13-talla-apretado-vaqueros` + `14-talla-grande-nino-chaqueta` | 0:04–0:09 / 0:02–0:06 | El problema en una imagen: aprieta / sobra. | Corte rítmico. Un beat por prenda. |
| 0:44–0:52 | `15-talla-grande-traje-boutique` + `16-talla-grande-chaqueta` + `17-talla-grande-blazers` | 0:10–0:16 / 0:03–0:08 / 0:04–0:09 | La talla no es solo una etiqueta: es geometría. | Alternar vertical y horizontal con punch-in. |
| 0:52–0:58 | `19-probar-probador-espejo` + `20-probar-probador-amiga` + `21-probar-ropa-casa` | 0:03–0:07 cada uno | Probarse sin adivinar. | Subir el teal del veredicto solo en el último frame. |
| 0:58–1:05 | `23-ui-vinted-feed` + `24-ui-vinted-detalle` | 0:01–0:05 / 0:01–0:05 | El producto vive donde ya vive la compra. | UI limpia, sin recortar los bordes. |
| 1:05–1:15 | `22-probar-espejo-fitting` + `01` | 0:03–0:06 | Cierre: el espejo. | Volver al plano del principio, misma luz. |

## Overlay de análisis (0:22–0:36)

1. Congelar `11-medir-sujetador-online` en el frame donde la cinta cruza la prenda.
2. Oscurecer un 25 % y dibujar una línea de escaneo horizontal fina (`#007782`) que baja una vez.
3. Sacar 4–6 callouts en mono (`JetBrains Mono` / `IBM Plex Mono`): `pecho`, `cintura`, `cadera`, `largo`, con su cifra en cm.
4. Cortar al viewer real con la prenda ya puesta. La transición debe ser geometría, no un zoom abstracto.
5. No enseñar el fallback “El probador 3D no está conectado”: grabar el viewer de verdad o no usar el plano.

## Reglas de montaje

- **Vertical primero.** El cold open y las redes van a 9:16. Los clips horizontales (`06`, `07`, `08`, `12`, `17`) se recortan a 9:16 con punch-in, nunca se meten con barras.
- **Sin música en el cold open.** Entra música solo cuando aparece el producto (0:30), si el equipo la quiere.
- **Audio.** Los clips de Pexels tienen la pista muda. Añadir room tone, shutter de móvil y roce de tela. No fingir voces.
- **Color.** No igualar todo a un LUT agresivo: el mock es paper/teal, la ropa ya trae color. Bajar saturación un 5–10 % y mantener negros suaves.
- **Texto sobre imagen.** Usar `--paper` o `--ink` con caja, nunca texto directo sobre una prenda clara.
- **Honestidad.** Las personas de los clips son stock, no usuarios reales de Vinted. No ponerles nombres, precios ni historias inventadas. El único “Vinted” de la pieza es el mock local, que ya está marcado como no afiliado.
- **Talla sin juicio.** En `13-talla-apretado-vaqueros`, cortar al detalle de la cintura/cremallera y emparejarlo con el mapa de tensión. El problema es la prenda, no el cuerpo. Evitar el plano entero como broma.

## Versión 20 s (solo cold open)

| Tramo | Clip | In–out |
|---|---|---|
| 0:00–0:05 | `01-vender-foto-vestido-casa` | 0:01–0:06 |
| 0:05–0:07 | `02-vender-inserto-movil-percha` | 0:00–0:02 |
| 0:07–0:11 | `04-vender-revisar-fotos-portatil` | 0:00–0:04 |
| 0:11–0:14 | `06-vender-scroll-app-movil` | 0:02–0:05 |
| 0:14–0:17 | `10-medir-cintura-vaqueros` | 0:02–0:05 |
| 0:17–0:20 | `14-talla-grande-nino-chaqueta` | 0:02–0:05 |

Texto en pantalla: `22 fotos. 4 medidas. Y aún así, no sabes cómo te queda.`
