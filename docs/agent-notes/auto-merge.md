# Auto-merge con revisor

El servicio `segunda-piel-review` revisa los pushes a ramas `feat/*` y puede mergearlos a `main` sin intervención humana.

## Qué revisa

- Diff completo contra `main`, tamaño y archivos tocados.
- Build de la rama y build del resultado mergeado, ambos como usuario sin privilegios.
- Bugs, regresiones, rutas de assets, dependencias y secretos.
- No auto-mergea cambios en `.github/`, `deploy/`, `scripts/` ni `AGENTS.md`.

## Reglas

- Solo ramas `feat/*`. Las ramas `chore/*`, `docs/*` y `fix/*` no se mergean solas.
- Un diff mayor a 2 MB o más de 300 archivos se bloquea: requiere merge manual.
- Si el build o el revisor fallan, `main` no se toca y el preview de la rama sigue disponible.
- Para saltarse el auto-merge, agrega un archivo `.no-automerge` en la raíz de la rama o usa `[no-automerge]` en el mensaje del commit.

## Reportes

Cada revisión deja un reporte en:

`https://hack.cesura.duckdns.org/reviews/`

El reporte incluye veredicto, hallazgos, resultado de build y si se mergeó o quedó en dry-run.
