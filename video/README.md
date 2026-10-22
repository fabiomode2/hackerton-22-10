# Vídeo

Pieza de presentación de **Segunda Piel**. Esta carpeta es del rol de vídeo; el material de entrada está separado de los exports.

## Qué hay

- `footage/` — 24 clips seleccionados + 8 alternativas, en 1080p, con nombres en español.
- `footage/contact-sheet.jpg` — mapa visual de la selección principal.
- `footage/contact-sheet-alternativas.jpg` — mapa de las alternativas.
- `footage/FUENTES.md` — autor, enlace, duración y licencia de cada clip.
- `footage/footage.csv` — la misma tabla en CSV, para importar en una hoja de cálculo.
- `footage/SHOTLIST.md` — secuencia de 75 s, in/out orientativos y receta del overlay de análisis.
- `out/` — exports finales (ignorado por git).
- `out/preview-20s.mp4` — primer corte de referencia del bloque de problema (20 s, vertical, sin audio). Texto y ritmo son provisionales; el 3D va aparte.

## Notas rápidas

- Los MP4 están ignorados por git (`*.mp4`). Para compartirlos, usar almacenamiento externo o un zip fuera del repo.
- Los clips de Pexels **no traen audio útil** (pista muda). El cold open necesita room tone + shutter en edición.
- El visor 3D real todavía no está en esta rama. El plano de 3D hay que grabarlo del viewer cuando esté levantado; no usar el fallback del mock.
- Las capturas `23-ui-vinted-feed` y `24-ui-vinted-detalle` son del mock local, no de la app real de Vinted.

## Reencodificar un clip

```bash
ffmpeg -i entrada.mp4 \
  -vf "scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2" \
  -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p \
  -an -movflags +faststart salida.mp4
```
