# Viewer 3D — cuerpo + prenda + veredicto

Probador local que carga un maniquí realista, lo deforma con las 6 medidas del
anuncio (`height`, `bust`, `waist`, `hips`, `shoulder`, `inseam`) y calcula la
holgura de la prenda con sus medidas planas.

**WIP:** la prenda 3D ya se construye sobre la malla del cuerpo
(`garment-builder.js`) y se simula al abrir el probador, pero el acabado de
sisa/cuello/espejo de la media malla sigue en revisión. Ver
`docs/agent-notes/cloth-viewer-wip.md`.

## Arrancar

```bash
# Desde la raíz del repo, para que deck, demo y viewer compartan origen.
python3 -m http.server 8080
```

- Demo completa: <http://localhost:8080/demo/vinted-mock/> → abre un anuncio → **Ver cómo te queda**.
- Viewer a pantalla completa: <http://localhost:8080/demo/vinted-mock/viewer3d/?listing=carhartt-hoodie-m>
- La demo ya apunta a `viewer3d/` por defecto. `?viewer=…` sigue permitiendo
  apuntar a un viewer externo.

No hay build, dependencias de npm ni red en tiempo de ejecución. Three.js y los
GLB viven en esta carpeta.

## Qué hace

1. Lee `listing` de `data.js` (`window.LISTINGS`).
2. Infiere `sex` de `listing.category` (`hombre` → male, `mujer` → female).
3. Llama a `buildBody()` del motor paramétrico (bundle `body-engine.js`).
4. Deforma la base mesh con los anillos del motor:
   - escala altura;
   - escala anchura/profundidad del torso por anillo (pecho, cintura, cadera);
   - escala piernas y muslos, con un fade en la cadera;
   - ajusta hombro y grosor de brazos;
   - convierte la cabeza en un elipsoide liso (sin cara, pelo ni ojos);
   - suaviza la malla con Laplaciano en torso, hombros, cintura y caderas;
   - transforma normales para conservar el sombreado suave.
5. Pinta la ropa interior:
   - calzoncillo/boxer briefs en hombre;
   - bragas de talle alto y sujetador en mujer;
   - máscara de fragmento para que el borde sea limpio (no sigue los triángulos);
   - bandas 3D de cintura, bajo pecho y tirantes.
6. Calcula el fit con las medidas planas de la prenda:
   - `ease = contorno_prenda − contorno_cuerpo − 2π·grosor`;
   - bandas por tipo de prenda (camiseta, sudadera, vestido, chaqueta, vaquero, falda);
   - veredicto y holgura por zona.
7. Pinta el veredicto, la confianza, las tallas de maniquí y los sliders de cuerpo.
8. Ofrece una pestaña **Mi maniquí** para editar el cuerpo personal de referencia
   (medidas, sexo, forma y presets) y guardarlo en el dispositivo.

## Controles

- **Arrastrar** en el canvas: orbitar.
- **Rueda / pellizco**: zoom.
- **Frente / 3/4 / Perfil**: vistas de cámara.
- **Tallas de maniquí XS / S / M / L / XL / Plus**: presets con medidas reales; el veredicto y el cuerpo cambian.
- **Ajustar mi cuerpo**: altura, pecho, cintura, cadera y hombro en vivo.
- **Mi cuerpo / Volver a mis medidas**: restaura las medidas del anuncio.
- **Cerrar** (X): en modo `embed=1` la X vive en el drawer padre; en pestaña
  independiente se muestra la X del viewer y vuelve a la demo.

## Mi maniquí

La pestaña **Mi maniquí** es la fachada del cuerpo personal: el mismo maniquí
que se usa para comparar todos los anuncios. No es un formulario decorativo;
los cambios se aplican en vivo al 3D y al veredicto.

- **Sexo / presentación**: mujer, hombre o neutro. Cambia la base mesh y los
  priors de forma; las medidas escritas se conservan.
- **Tallas de referencia**: presets XS–Plus del sexo activo y **Mi cuerpo** para
  volver a la última referencia guardada.
- **Medidas**: altura, pecho, cintura, cadera, hombro y entrepierna. Se
  sincronizan con los sliders del panel de fit.
- **Forma**: proyección de pecho, glúteos, abdomen y caída de hombro.
- **Guardar mi maniquí**: copia el perfil actual a la referencia personal y lo
  guarda en `localStorage` bajo `segunda-piel:personal-mannequin:v1`.
- **Restablecer**: vuelve a la última referencia guardada (o al cuerpo del
  anuncio si aún no has guardado nada).
- **Ver el fit de esta prenda →**: vuelve a la pestaña de fit.

No hay backend, cuenta ni red. Si se borran los datos del navegador, se pierde
la referencia guardada y el viewer vuelve a usar el cuerpo del anuncio.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | shell del viewer, importmap de Three.js |
| `styles.css` | sistema visual (paper, teal, sheet, sliders) |
| `app.js` | escena Three.js, deformación, fit-lite y UI |
| `body-engine.js` | bundle ESM de `packages/fit-engine/src/body.ts` |
| `assets/female-base.glb` | base mesh femenina CC0 |
| `assets/male-base.glb` | base mesh masculina CC0 |
| `vendor/` | Three.js r186 + GLTFLoader + OrbitControls + RoomEnvironment |

### Regenerar el bundle del motor

Si cambia `packages/fit-engine/src/body.ts`, `body-profile.ts` o `body-intent.ts`:

```bash
npx esbuild packages/fit-engine/src/body.ts \
  --bundle --format=esm --platform=browser --target=es2022 \
  --outfile=demo/vinted-mock/viewer3d/body-engine.js
```

## Assets y licencias

- **Base meshes**: [Innerscene 3D Parts Library](https://www.innerscene.com/tools/library/3d-parts),
  adaptadas de MakeHuman, **CC0**.
  - Female: `female-base-mesh-3d-person-rigged-a-pose-dba97ed5`
  - Male: `male-base-mesh-3d-person-rigged-a-pose-380e6d89`
  - GLB de ~4,3 MB, 107.024 triángulos, 71.695 vértices, 163 huesos, A-pose,
    material clay, sin texturas.
- **Three.js r186**: licencia MIT. Se sirve desde `vendor/`; no se usa CDN.
- **Fotos del mock**: ver `../README.md`.

Cada GLB pesa < 5 MB (regla del repo). No se ha usado el mesh `high-poly` ni
los primitivos pequeños (ojos, dientes, pestañas): el visor conserva el cuerpo
principal para que la cara sea de maniquí, sin texturas.

## Límites conocidos

- **Sin prenda 3D**: el veredicto se calcula con las medidas, no con geometría
  de la prenda. La siguiente iteración es la prenda procedural de `garment.ts`.
- **Deformación aproximada**: la base mesh se escala por anillos; no es una
  simulación de tejido ni un avatar escaneado. En perfiles extremos (plus,
  tallas muy pequeñas) los brazos y la cintura pueden perder detalle.
- **A-pose**: los brazos van abiertos; no hay animación ni pose de prenda.
- **Fit-lite local**: `computeFit()` de `app.js` es una vista previa para la
  demo. El motor definitivo es `packages/fit-engine/src/fit.ts` (Jaime), con el
  contrato congelado de `types.ts`.
- **Cabeza de maniquí**: se proyecta a un elipsoide liso; no tiene cara, pelo,
  ojos ni textura de piel. Es deliberado: el pitch promete maniquí abstracto,
  no fotorrealismo.
- **Ropa interior**: es una máscara de color + bandas 3D, no una prenda
  simulada. En el próximo paso se sustituye por la prenda procedural.
- **Sin red**: todo es local. Las medidas de cuerpo desde fotos son ROADMAP
  (`docs/vision-extraction.md`), no parte de esta demo.
- **Persistencia local**: el maniquí personal vive en `localStorage`; no se
  sincroniza entre dispositivos ni se envía a ningún servidor.

## QA rápido

```bash
node --input-type=module --check < demo/vinted-mock/viewer3d/app.js
```

Comprobado con Chromium headless (Playwright) a 500×900 (iframe del drawer),
390×844 (móvil) y 1000×900 / 1280×900 (standalone): carga de GLB, deformación,
veredicto, presets XS–Plus, sliders, ropa interior, cambio de vistas, cierre
del drawer y ausencia de errores de consola.

## Estado en el ledger

- **REAL**: cuerpo paramétrico desde medidas, base mesh CC0, deformación,
  suavizado, cabeza lisa, ropa interior, presets XS–Plus, cálculo de holgura y
  veredicto.
- **DEMO**: fit-lite local, deformación aproximada, ropa interior de máscara,
  cuerpo + veredicto sin prenda.
- **ROADMAP**: prenda procedural, simulación de tela, extracción de medidas
  desde fotos, avatares escaneados/SMPL.
