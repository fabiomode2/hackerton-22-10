# 3D procedural — notas técnicas

## Convenciones (no cambiar)

- Datos en **cm**, escena en **metros** (`× 0.01`). Un solo helper `cm()` y nadie hace la cuenta a mano.
- **Y** arriba, **Z** frontal, **X** derecha. Origen en el suelo, entre los pies.
- Ángulos en radianes. `t` recorre la sección de 0 a 2π.
- Nombres: `body.rings[i]`, `garment.rings[i]`, `ease_cm`, `tension`.

## La estructura

Cuerpo y prenda son **la misma cosa**: una pila de anillos horizontales.

```
ring = { y, rx, rz, cz, n }
x = rx * sign(cos t) * |cos t|^(2/n)
z = cz + rz * sign(sin t) * |sin t|^(2/n)
```

- `n` controla lo "cuadrado" de la sección: 2 = elipse, 2.4 = torso, 3 = muy cuadrado.
- Anillos del cuerpo (abajo → arriba): tobillo, pantorrilla, rodilla, muslo, cadera, cintura, bajo pecho, pecho, hombro, cuello.
- `r = C / (2π)`, con `rz ≈ 0.72 · rx` para el torso (somos más anchos que profundos).
- La cadera es el máximo de `rx`; la cintura el mínimo. Si el usuario da cintura > cadera, no romper: clampear suavemente.

## La prenda

- Mismos anillos de referencia, con `rx' = rx + ease(y)` y `rz' = rz + ease(y)·0.8`.
- **Holgura negativa permitida** (prendas ajustadas): se renderiza igual, se pinta en rojo.
- Manga: tubo sobre una curva del hombro al puño. No intentar una manga con loft de anillos.
- Bajo: función de vuelo (`flare`) para vestidos y faldas, cuadrática desde la cintura.
- Cuello: anillo extruido, no un toro (el toro se ve de juguete).

## Tensión

```
τ = (r_cuerpo − r_prenda) / r_cuerpo
```

- `τ > 0.02` rojo, `0…0.02` ámbar, `−0.06…0` verde, `< −0.06` azul.
- Se calcula **por vértice** y se pasa como color de vértice (`vertexColors`). No usar un shader custom: no hay tiempo.
- Para que el color no parpadee, suavizar `τ` con un blur de 1 anillo arriba/abajo.

## Trampas de Three.js que nos van a morder

- `BufferGeometry` con `vertexColors` necesita `material.vertexColors = true` y colores en **linear-sRGB**, no en sRGB. Si los verdes salen lavados, es esto.
- `computeVertexNormals()` después de mover vértices, o la luz se queda "pegada" a la forma vieja.
- `flatShading` en el cuerpo lo hace parecer low-poly de PS1. Mantener suave.
- Actualizar `position` en cada frame sin `needsUpdate` no hace nada. Marcar `geometry.attributes.position.needsUpdate = true`.
- `Float32Array` para posiciones; `Uint16Array` para índices solo si < 65k vértices (con 14 anillos × 64 segmentos vamos sobrados).
- El `useMemo` de la geometría debe depender del **hash de las medidas**, no del objeto (si no, recalcula cada render).
- `Canvas` de R3F: `dpr={[1, 2]}` para no reventar móviles.
- `Suspense` obligatorio alrededor de loaders, o el primer frame peta.

## Materiales

- `MeshPhysicalMaterial` con `sheen` para punto y felpa; `clearcoat` bajo para piel.
- Un HDRI de estudio (Poly Haven) es el 80% del look. Sin HDRI, todo parece plastilina.
- Normal maps de tejido: reutilizar 2–3 y rotar UVs para que no se note el patrón repetido.
- El denim necesita un normal de sarga visible a poca distancia y `roughness` alto.

## Rendimiento

- Objetivo: 60 fps en un portátil normal, 30 en móvil.
- Presupuesto: < 60k triángulos, 1 luz con sombra, sin physics.
- Precalcular todo lo posible al cambiar medidas, no en `useFrame`.
- La prenda se reconstruye al cambiar de talla; el cuerpo, al mover un slider. No reconstruir ambos a la vez.

## Lo que NO vamos a hacer (y hay que saber por qué)

- **Cloth simulation**: XPBD/Verlet en 4 h con colisiones contra un cuerpo paramétrico es un agujero negro. La holgura + rigidez por tejido da el 85% del resultado visual.
- **Escaneo corporal desde foto**: requiere un modelo de reconstrucción y calibración. Es roadmap, no demo.
- **Skinned mesh / rig**: no hace falta si el cuerpo es estático y se regenera. Ahorra horas.
