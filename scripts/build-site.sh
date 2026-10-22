#!/usr/bin/env bash
# build-site.sh — construye los estáticos publicables del repo.
# Uso: ./scripts/build-site.sh
# Salida: dist/  (deck/, demo/, viewer/ si existe, index.html)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

rm -rf dist
mkdir -p dist

# --- deck (Slides estáticas o HTML plano) ----------------------------------
if [[ -d deck ]]; then
  cp -a deck dist/deck
else
  mkdir -p dist/deck
  cat > dist/deck/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Segunda Piel — Hackathon</title>
  <style>
    :root{color-scheme:dark}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0f;color:#f4f1ea;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
    main{max-width:680px;padding:48px 28px}
    h1{font-size:clamp(40px,8vw,84px);line-height:.95;letter-spacing:-.04em;margin:0 0 20px}
    p{color:#a7a39a;margin:0 0 32px}
    nav{display:grid;gap:10px}
    a{display:flex;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid #2c2c30;border-radius:12px;color:#f4f1ea;text-decoration:none}
    a:hover{border-color:#f4f1ea;background:#17171a}
    span{color:#7c7870;font-size:13px}
    code{color:#cfcbc2}
  </style>
</head>
<body>
<main>
  <h1>Segunda Piel</h1>
  <p>Probador 3D para moda de segunda mano. La presentación aún no está en el repo: esta es una página puente generada por el deploy.</p>
  <nav>
    <a href="/demo/vinted-mock/">Demo Vinted <span>mock interactivo →</span></a>
    <a href="/viewer/">Visor 3D <span>pendiente de build →</span></a>
    <a href="/preview/">Previews por rama <span>equipo →</span></a>
  </nav>
</main>
</body>
</html>
HTML
fi

# --- demo estático ---------------------------------------------------------
if [[ -d demo ]]; then
  cp -a demo dist/demo
fi

# --- viewer (Vite + React + R3F) ------------------------------------------
# Cuando exista apps/viewer/package.json se construye. Si apps/viewer/dist ya
# viene construido, se usa tal cual (útil en el VPS sin red).
VIEWER="apps/viewer"
if [[ -f "$VIEWER/package.json" ]]; then
  if [[ -d "$VIEWER/dist" ]]; then
    echo "· viewer: usando $VIEWER/dist existente"
  else
    echo "· viewer: instalando y construyendo"
    (
      cd "$VIEWER"
      if [[ -f pnpm-lock.yaml ]]; then
        pnpm install --frozen-lockfile
      else
        pnpm install
      fi
      if [[ -n "${PUBLIC_BASE:-}" ]]; then
        pnpm exec vite build --base="${PUBLIC_BASE%/}/"
      else
        pnpm exec vite build --base="/viewer/"
      fi
    )
  fi
  mkdir -p dist/viewer
  cp -a "$VIEWER/dist/." dist/viewer/
else
  mkdir -p dist/viewer
  cat > dist/viewer/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=../demo/vinted-mock/viewer3d/">
  <title>Visor 3D — Segunda Piel</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0f;color:#f4f1ea;font:16px/1.6 ui-sans-serif,system-ui;text-align:center}
    h1{font-size:clamp(36px,7vw,72px);letter-spacing:-.04em;margin:0 0 12px}
    p{color:#a7a39a;margin:0 0 24px}
    a{color:#f4f1ea}
  </style>
</head>
<body><main><h1>Visor 3D</h1><p>Abriendo el probador…</p><a href="../demo/vinted-mock/viewer3d/">Abrir el visor →</a></main></body>
</html>
HTML
fi

# --- landing raíz (por si se sirve / directamente) ------------------------
cat > dist/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Segunda Piel — Deploy</title>
  <meta http-equiv="refresh" content="0;url=./deck/">
  <style>body{background:#0d0d0f;color:#f4f1ea;font:16px ui-sans-serif,system-ui;display:grid;place-items:center;height:100vh;margin:0}a{color:#f4f1ea}</style>
</head>
<body><p>Redirigiendo a <a href="/deck/">/deck/</a>…</p></body>
</html>
HTML

echo "✓ dist listo en $ROOT/dist"
