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
  rm -f dist/deck/index-*-backup.html
else
  mkdir -p dist/deck
  cat > dist/deck/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>outfit check — Presentación</title>
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(800px 500px at 80% 0%,#DDF4EF,transparent 70%),#F7F6F1;color:#0B2B2A;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{max-width:680px;padding:48px 28px}
    h1{font-size:clamp(40px,8vw,84px);line-height:.95;letter-spacing:-.04em;margin:0 0 20px}
    p{color:rgba(11,43,42,.6);margin:0 0 32px}
    nav{display:grid;gap:10px}
    a{display:flex;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid rgba(11,43,42,.14);border-radius:12px;color:#0B2B2A;text-decoration:none;background:rgba(255,255,255,.5)}
    a:hover{border-color:#007782;background:#fff;color:#007782}
    span{color:rgba(11,43,42,.45);font-size:13px}
    code{color:#007782}
  </style>
</head>
<body>
<main>
  <h1>outfit check</h1>
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
elif [[ -d demo/vinted-mock/viewer3d ]]; then
  # Si el viewer vive dentro de la demo, publícalo también en /viewer/.
  mkdir -p dist/viewer
  cp -a demo/vinted-mock/viewer3d/. dist/viewer/
  cp demo/vinted-mock/data.js dist/viewer/data.js
  sed -i 's#src="../data.js"#src="./data.js"#' dist/viewer/index.html
  mkdir -p dist/viewer/fonts
  cp demo/vinted-mock/fonts/inter-latin.woff2 dist/viewer/fonts/
  sed -i 's#../fonts/inter-latin.woff2#./fonts/inter-latin.woff2#' dist/viewer/styles.css
else
  mkdir -p dist/viewer
  cat > dist/viewer/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=../demo/vinted-mock/viewer3d/">
  <title>Visor 3D — outfit check</title>
  <style>
    :root{color-scheme:light}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(800px 500px at 80% 0%,#DDF4EF,transparent 70%),#F7F6F1;color:#0B2B2A;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
    h1{font-size:clamp(36px,7vw,72px);letter-spacing:-.04em;margin:0 0 12px}
    p{color:rgba(11,43,42,.6);margin:0 0 24px}
    a{color:#007782}
  </style>
</head>
<body><main><h1>Visor 3D</h1><p>Abriendo el probador…</p><a href="../demo/vinted-mock/viewer3d/">Abrir el visor →</a></main></body>
</html>
HTML
fi

# --- landing raíz (selector principal) -----------------------------------
# La landing real vive en site/index.html + site/landing.css. Solo si falta
# el HTML se genera una página puente. Los enlaces son relativos para que
# funcione igual en / y en /preview/<slug>/.
if [[ -f site/index.html ]]; then
  cp site/index.html dist/index.html
  if [[ -f site/landing.css ]]; then
    cp site/landing.css dist/landing.css
  else
    echo "⚠ site/landing.css no existe: dist/index.html quedará sin estilos" >&2
  fi
else
  cat > dist/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#F7F6F1">
  <meta name="color-scheme" content="light">
  <title>outfit check — La talla, antes de comprar</title>
  <meta name="description" content="Probador 3D para moda de segunda mano.">
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(800px 500px at 80% 0%,#DDF4EF,transparent 70%),#F7F6F1;color:#0B2B2A;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{max-width:640px;padding:48px 28px}
    .eyebrow{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(11,43,42,.5)}
    h1{font-size:clamp(48px,9vw,82px);line-height:.9;letter-spacing:-.06em;margin:18px 0 16px}
    h1 em{font-family:Georgia,"Times New Roman",serif;font-weight:400;color:#007782}
    p{color:rgba(11,43,42,.6);margin:0 0 30px}
    nav{display:grid;gap:9px}
    a{display:flex;justify-content:space-between;gap:16px;padding:16px 20px;border:1px solid rgba(11,43,42,.14);border-radius:999px;color:#0B2B2A;text-decoration:none;background:rgba(255,255,255,.5)}
    a:hover{border-color:#007782;color:#007782;background:#fff}
    a:first-child{background:#007782;border-color:#007782;color:#fff}
    a:first-child:hover{background:#005B63;border-color:#005B63;color:#fff}
    span{opacity:.6;font-size:12px}
  </style>
</head>
<body>
<main>
  <p class="eyebrow">Probador 3D · moda de segunda mano</p>
  <h1>outfit <em>check</em></h1>
  <p>La talla, antes de comprar.</p>
  <nav aria-label="Secciones">
    <a href="./deck/"><b>Ver presentación</b><span>→</span></a>
    <a href="./demo/vinted-mock/"><b>Demo Vinted</b><span>↗</span></a>
    <a href="./viewer/"><b>Visor 3D</b><span>↗</span></a>
  </nav>
</main>
</body>
</html>
HTML
fi

echo "✓ dist listo en $ROOT/dist"
