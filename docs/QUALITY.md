# Calidad — qué se verificó, cómo y qué falta

> **Filosofía.** En un hackathon, "calidad" no es cobertura de tests al 100 %. Es la probabilidad de que la demo funcione delante del jurado y de que lo que se cuenta sea verdad. Este documento separa lo comprobado de lo que solo está diseñado.

Fecha de la evidencia: **22/10/2026**.

---

## 1. Dimensiones de calidad

| Dimensión | Pregunta | Estado |
|---|---|---|
| **Corrección numérica** | ¿El motor reproduce las medidas y no genera `NaN`? | Verificado |
| **Reproducibilidad** | ¿La demo arranca en frío, sin red y sin build? | Verificado |
| **Resiliencia** | ¿Qué pasa si falla el 3D, el HDRI, las texturas o el iframe? | Diseñado + probado parcialmente |
| **Rendimiento** | ¿Va fluido en el hardware de la demo? | Presupuestado, no instrumentado |
| **Accesibilidad** | ¿Se puede usar con teclado y lector de pantalla? | Parcial |
| **Privacidad** | ¿Sale algún dato del dispositivo? | Verificado por inspección |
| **Seguridad** | ¿Hay superficies de ataque en el mock? | Limitado y documentado |
| **Honestidad** | ¿Los claims coinciden con el código? | Verificado con ledger |

---

## 2. Matriz de evidencia

| # | Comprobación | Comando / método | Resultado |
|---|---|---|---|
| Q01 | Sintaxis de los JS del marketplace | `node --check demo/vinted-mock/app.js` | **PASS** |
| Q02 | Sintaxis de los datos | `node --check demo/vinted-mock/data.js` | **PASS** |
| Q03 | Sintaxis del drawer | `node --check demo/vinted-mock/viewer.js` | **PASS** |
| Q04 | Sintaxis del viewer (ESM) | `node --input-type=module --check < demo/vinted-mock/viewer3d/app.js` | **PASS** |
| Q05 | Sintaxis de la prenda (ESM) | `node --input-type=module --check < demo/vinted-mock/viewer3d/garment-builder.js` | **PASS** |
| Q06 | Sintaxis del bundle del motor | `node --input-type=module --check < demo/vinted-mock/viewer3d/body-engine.js` | **PASS** |
| Q07 | Verificación numérica del cuerpo | `npx --yes tsx packages/fit-engine/scripts/check-body.ts` | **PASS** — 5 perfiles, circunferencias, landmarks y rasgos |
| Q08 | Build de estáticos | `./scripts/build-site.sh` | **PASS** — exit 0, `dist/` generado |
| Q09 | Demo servida | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/` | **200** |
| Q10 | Viewer servido | `curl .../viewer3d/?listing=carhartt-hoodie-m` | **200** |
| Q11 | Smoke visual desktop | Chromium headless 1280×900, `--virtual-time-budget=8000` | **Renderiza** — captura en `docs/assets/viewer.png` |
| Q12 | Smoke visual móvil | Chromium headless 390×844 | **Renderiza** — captura en `docs/assets/demo-listing.png` |
| Q13 | Deck | Chromium headless 1280×900 | **Renderiza** — slides desde `manifest.js` |
| Q14 | Sin red en el runtime del viewer | `grep -R -e 'fetch(' -e 'XMLHttpRequest' -e 'https://' ...` | **Sin llamadas** en `viewer3d/app.js`, `garment-builder.js`, `body-engine.js` |
| Q15 | Assets locales | Revisión de `viewer3d/index.html`, `vendor/`, `assets/` | **Todos relativos**; sin CDN |
| Q16 | Iframe: ready/close/height | Inspección de `viewer.js` y `app.js` | **Implementado**; timeout de 15 s con fallback |
| Q17 | Persistencia | `savePersonalProfile()` / `loadSavedPersonalProfile()` | **Implementado**; `try/catch` si storage falla |

> **Nota:** Q11–Q13 son smoke tests de renderizado, no una suite E2E. No capturan errores de consola de forma automática ni hacen assertions sobre el DOM. Están para detectar pantallas en blanco y regresiones groseras.

---

## 3. Evidencia reproducible

### 3.1. Sintaxis

```bash
node --check demo/vinted-mock/app.js
node --check demo/vinted-mock/data.js
node --check demo/vinted-mock/viewer.js
node --input-type=module --check < demo/vinted-mock/viewer3d/app.js
node --input-type=module --check < demo/vinted-mock/viewer3d/garment-builder.js
node --input-type=module --check < demo/vinted-mock/viewer3d/body-engine.js
```

Sin salida = éxito. Cualquier error de sintaxis imprime la línea y el token.

### 3.2. Motor de cuerpo

```bash
npx --yes tsx packages/fit-engine/scripts/check-body.ts
```

Salida real (resumida):

```
perfil              conf torso  piernas   brazos cuello        cintura         cadera          pecho  inf  warn
female-165         1.000    26      8/8    14/14      5      70.0→98.8      96.0→90.8     88.0→117.1    0     0
male-180           1.000    26      8/8    14/14      5     84.0→108.3      98.0→99.0    100.0→127.8    0     0
female-plus-170    1.000    26      8/8    14/14      5     95.0→100.9     120.0→93.5    110.0→120.7    0     0
male-small-160     1.000    26      8/8    14/14      5      74.0→96.6      90.0→88.0     88.0→113.6    0     0
neutral-inferred   0.965    26      8/8    14/14      5      76.0→103.2      98.0→94.6     92.0→122.1   10     0

OK: geometría, landmarks y circunferencias verificados.
Rasgos: shoulder_slope=0.20, muscle=0.80, belly=0.10, posture=-0.60 · no reconocidos: me queda todo mal
```

**Qué prueba:** que las circunferencias de cintura, cadera y pecho se reproducen con tolerancia; que los landmarks son coherentes; que no hay `NaN`; que el intérprete de rasgos no pisa lo explícito; que un perfil con medidas inferidas baja la confianza.

### 3.3. Demo y visor

```bash
node demo/vinted-mock/serve.mjs 8080
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8080/viewer3d/?listing=carhartt-hoodie-m"
```

Resultado: `200` y `200`.

### 3.4. Build

```bash
./scripts/build-site.sh
# ✓ dist listo en .../dist
```

Resultado: exit 0; `dist/` contiene `deck/`, `demo/`, `viewer/` e `index.html`. Tamaño aproximado: 66 MB (incluye GLB, texturas y fotos).

### 3.5. Smoke visual

```bash
CHROME="$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
"$CHROME" --headless=new --no-sandbox --disable-gpu \
  --use-gl=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,900 --virtual-time-budget=8000 \
  --screenshot=/tmp/viewer.png \
  "http://127.0.0.1:8080/viewer3d/?listing=carhartt-hoodie-m"
```

Resultado: captura generada; el visor carga el GLB, deforma, calcula fit y pinta la prenda. La captura del README se generó así.

---

## 4. Qué no está probado

| Área | Qué falta | Riesgo |
|---|---|---|
| **Navegadores** | Firefox, Safari, iOS Safari | Medio: WebGL, `ResizeObserver`, `localStorage` y `postMessage` pueden comportarse distinto |
| **Dispositivos** | Móviles de gama baja, tablets | Medio: el GLB y las texturas pesan; el solver puede ir lento |
| **Rendimiento** | FPS, memoria, time to interactive | Medio: no hay números, solo presupuesto |
| **Accesibilidad** | Auditoría con lector de pantalla, contraste, foco | Medio: hay ARIA y teclado, pero no una auditoría formal |
| **E2E** | Flujos automatizados con Playwright | Alto: una regresión de UI puede pasar desapercibida |
| **Datos remotos** | Listings reales, medidas sucias, HTML malicioso | Alto si se conecta a un marketplace real |
| **Cuerpos extremos** | Perfiles fuera de rango, medidas contradictorias | Medio: el motor avisa, pero la malla puede deformarse raro |
| **Sesiones largas** | Memoria, disposición de geometrías, fugas | Medio: hay `dispose()`, pero no un test de estrés |
| **Licencias** | Revisión legal de assets y fuentes | Bajo para el hackathon; alto para producto |
| **Integración Vinted** | API, permisos, términos | No aplica: es roadmap |

---

## 5. Criterios de aceptación

### Para considerar un claim `REAL`

- [ ] Está implementado en código versionado.
- [ ] Se puede reproducir con un comando o una interacción de la demo.
- [ ] Tiene una sección de límites en `CLAIMS.md`.
- [ ] No depende de red, de un LLM o de datos no versionados.
- [ ] Si falla, hay un fallback visible.

### Para considerar la demo "lista para jurado"

- [ ] `node demo/vinted-mock/serve.mjs 8080` arranca sin errores.
- [ ] El feed carga 12 anuncios y las imágenes.
- [ ] El CTA abre el drawer y el visor hace `segunda:ready`.
- [ ] El veredicto se pinta con zona, holgura y confianza.
- [ ] Cambiar de preset cambia el cuerpo, la prenda y el veredicto.
- [ ] El heatmap se activa y se desactiva.
- [ ] "Mi maniquí" guarda y recupera el perfil.
- [ ] Escape cierra el drawer.
- [ ] El deck carga las slides y la demo embebida.
- [ ] Con la red apagada, todo lo anterior sigue funcionando.
- [ ] Hay capturas/deck como plan B si el 3D falla.

---

## 6. Deuda técnica priorizada

| Prioridad | Deuda | Por qué importa | Siguiente paso |
|---|---|---|---|
| **P0** | `fit-lite` no implementa `tension` ni `confidence_parts` | El contrato dice una cosa y el viewer hace otra | Implementar `fit.ts` y sustituir |
| **P0** | Sombreado de la media malla espejada | Se ve una costura en la prenda y el cuerpo | Recalcular normales/winding al espejar |
| **P1** | Sisa/cuello sin costura real | El hombro parece neopreno | Copa de manga + armhole seam |
| **P1** | `missing` incompleto | La confianza puede parecer mejor de lo que es | Derivar de las medidas requeridas por tipo |
| **P2** | `postMessage` con `'*'` | Riesgo al integrar fuera del mock | Restringir a `location.origin` |
| **P2** | Sin E2E | Regresiones de UI | Playwright con 3 flujos |
| **P2** | Sin medición de FPS/memoria | No se puede afirmar rendimiento | Benchmark + `performance.now()` |
| **P3** | `serve.mjs` sin cabeceras | Solo demo local | No exponerlo a internet |

---

## 7. Checklist de demo (imprimir o tener a mano)

```
[ ] Servidor: node demo/vinted-mock/serve.mjs 8080
[ ] Feed: 12 anuncios, imágenes cargadas
[ ] Ficha: CTA visible y fijo
[ ] Drawer: abre, handshake, sin pantalla en blanco
[ ] 3D: maniquí + prenda + veredicto
[ ] Preset XS → Plus: el cuerpo y el veredicto cambian
[ ] Heatmap: on/off
[ ] Mi maniquí: guardar, recargar, persiste
[ ] Escape: cierra
[ ] Deck: slides, demo embebida, focus
[ ] Red apagada: repetir 3–9
[ ] Plan B: capturas + deck + vídeo local si existe
```

---

## 8. Lo que este documento no promete

- No promete que el 3D se vea igual en todos los dispositivos.
- No promete que el solver sea físicamente correcto.
- No promete que el fit acierte con medidas mal tomadas.
- No promete que la demo aguante un escrutinio de producción.
- No promete que el ledger esté completo para siempre: es una foto del 22/10/2026.

**Lo que sí promete:** que lo que está marcado como `REAL` se puede reproducir, y que lo que no, está marcado como `DEMO` o `ROADMAP`.

---

<div align="center">
<sub>La calidad no es que no haya deuda. Es saber cuál tienes, cuánto pesa y qué se rompe si la ignoras.</sub>
</div>
