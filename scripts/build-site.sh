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
  <title>outfit check — Hackathon</title>
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

# --- landing raíz (selector principal) -----------------------------------
cat > dist/index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0b0c0e">
  <title>outfit check — probador 3D</title>
  <meta name="description" content="Probador 3D para moda de segunda mano. Elige presentación, demo o visor.">
  <style>
    :root{color-scheme:dark;--bg:#0b0c0e;--ink:#f4f1ea;--muted:#a7a39a;--dim:#716d66;--line:#2a2b2f;--teal:#6fe3db;--teal-ink:#0b0c0e}
    *{box-sizing:border-box}
    html,body{min-height:100%}
    body{margin:0;background:radial-gradient(900px 520px at 82% -10%,rgba(111,227,219,.13),transparent 62%),radial-gradient(700px 420px at -10% 110%,rgba(111,227,219,.06),transparent 60%),var(--bg);color:var(--ink);font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
    a{color:inherit;text-decoration:none}
    main{width:min(1040px,100%);margin:0 auto;padding:clamp(24px,5vw,56px) 24px 40px;min-height:100vh;display:flex;flex-direction:column}
    .top{display:flex;align-items:center;justify-content:space-between;gap:20px}
    .brand{display:inline-flex;align-items:center;gap:10px;font-weight:650;letter-spacing:-.03em;font-size:18px}
    .brand svg{width:30px;height:30px;color:var(--teal)}
    .tag{font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:var(--dim);text-transform:uppercase}
    .hero{padding:clamp(54px,11vh,112px) 0 clamp(30px,5vh,52px);max-width:780px}
    .kicker{margin:0 0 18px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:var(--teal);text-transform:uppercase}
    h1{margin:0;font-size:clamp(48px,9vw,96px);line-height:.92;letter-spacing:-.06em;font-weight:600}
    h1 em{font-family:Georgia,"Times New Roman",serif;font-weight:400;color:var(--teal)}
    .lede{max-width:540px;margin:24px 0 0;color:var(--muted);font-size:clamp(16px,2vw,19px)}
    .grid{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:12px;margin-top:auto}
    .card{display:flex;flex-direction:column;min-height:210px;padding:20px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.018);transition:border-color .2s,background .2s,transform .2s}
    .card:hover{border-color:#5a5b60;background:rgba(255,255,255,.035);transform:translateY(-2px)}
    .card--primary{background:var(--teal);border-color:var(--teal);color:var(--teal-ink)}
    .card--primary:hover{background:#8aeee7;border-color:#8aeee7}
    .num{font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;opacity:.55}
    .card h2{margin:28px 0 6px;font-size:clamp(21px,2.4vw,27px);letter-spacing:-.035em;line-height:1.05}
    .card p{margin:0;max-width:24ch;color:var(--muted);font-size:14px}
    .card--primary p{color:rgba(11,12,14,.68)}
    .arrow{margin-top:auto;padding-top:24px;font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em}
    .footer{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:28px;color:var(--dim);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}
    .footer a:hover{color:var(--ink)}
    .footer span{margin-left:auto}
    @media(max-width:760px){.grid{grid-template-columns:1fr}.card{min-height:160px}.hero{padding-top:52px}.tag{display:none}.footer span{display:none}}
  </style>
</head>
<body>
<main>
  <header class="top">
    <a class="brand" href="./" aria-label="outfit check">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><ellipse cx="16" cy="10" rx="6" ry="2.2"/><ellipse cx="16" cy="16" rx="8.5" ry="3.1"/><ellipse cx="16" cy="22" rx="5" ry="1.9"/></svg>
      outfit check
    </a>
    <span class="tag">Hackathon · 22/10/2026</span>
  </header>

  <section class="hero">
    <p class="kicker">Probador 3D · moda de segunda mano</p>
    <h1>Pruébate<br><em>antes de comprar.</em></h1>
    <p class="lede">Las medidas ya están en el anuncio. Nosotros las convertimos en tu cuerpo y te decimos cómo te queda.</p>
  </section>

  <nav class="grid" aria-label="Secciones">
    <a class="card card--primary" href="./deck/">
      <span class="num">01</span>
      <h2>Presentación</h2>
      <p>El pitch completo, con la demo integrada.</p>
      <span class="arrow">Ver deck →</span>
    </a>
    <a class="card" href="./demo/vinted-mock/">
      <span class="num">02</span>
      <h2>Demo Vinted</h2>
      <p>Marketplace y probador en acción.</p>
      <span class="arrow">Abrir demo →</span>
    </a>
    <a class="card" href="./viewer/">
      <span class="num">03</span>
      <h2>Visor 3D</h2>
      <p>Maniquí paramétrico y veredicto de fit.</p>
      <span class="arrow">Abrir visor →</span>
    </a>
  </nav>

  <footer class="footer">
    <a href="/preview/">Previews del equipo</a>
    <a href="/reviews/">Reviews</a>
    <span>outfit check · 2026</span>
  </footer>
</main>
</body>
</html>
HTML

echo "✓ dist listo en $ROOT/dist"
