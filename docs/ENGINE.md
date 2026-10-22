# Motor — matemática del cuerpo, la prenda y el fit

> **Alcance.** Este documento explica cómo se pasa de un listing con medidas a un maniquí, una prenda y un veredicto. Es la especificación técnica del prototipo que se enseña, no la del motor ideal. Donde el código simplifica, se dice.

---

## 1. Convenciones que no se tocan

| Convención | Valor | Por qué |
|---|---|---|
| Unidad de datos | **cm** | Es lo que usa una cinta métrica y lo que publica un vendedor |
| Unidad de escena | **metros** (`cm × 0.01`) | Three.js trabaja en metros; evita escalas raras |
| Eje vertical | **Y arriba** | Convención del viewer y del contrato |
| Eje frontal | **Z positivo hacia el frente** | Cámara y prenda miran a +Z |
| Eje lateral | **X derecha** | Sistema diestro |
| Origen | Suelo, entre los pies | Los landmarks verticales se miden desde ahí |
| Ángulos | Radianes | `t` recorre la sección de 0 a 2π |

La conversión se hace en una frontera: `cm()` en el motor y `CM = 0.01` en la prenda. La UI no hace `* 0.01` a mano.

---

## 2. Pipeline en cinco etapas

```
Listing (medidas planas) ─┐
                          ├─► [A] Perfil ─► [B] Cuerpo ─► [C] Prenda
Tu perfil (6 medidas) ────┘                              │
                                                         ▼
                                              [D] Fit por zonas
                                                         │
                                                         ▼
                                              [E] Veredicto + heatmap
```

| Etapa | Implementación | Entrada | Salida |
|---|---|---|---|
| **A. Perfil** | `resolveBodyProfile()` | `BodyProfile` parcial | `ResolvedBodyProfile` + warnings + confianza |
| **B. Cuerpo** | `buildBody()` | Perfil resuelto | Anillos, limbs, landmarks, malla de referencia |
| **C. Prenda** | `buildGarment()` | Listing + cuerpo + fit | Malla, materiales, heatmap |
| **D. Fit** | `computeFit()` (`fit-lite`) | Listing + perfil | Zonas, veredicto, confianza, missing |
| **E. UI** | `updateFit()`, `setHeatmap()` | `FitResult` + prenda | Números, colores y frase |

---

## 3. Etapa A — Perfil

### 3.1. Entrada

```ts
type BodyProfile = Body & {
  sex?: 'male' | 'female' | 'neutral';
  underbust_cm?: number;
  back_width_cm?: number;
  torso_length_cm?: number;
  neck_cm?: number;
  thigh_cm?: number;
  calf_cm?: number;
  upper_arm_cm?: number;
  wrist_cm?: number;
  ankle_cm?: number;
  weight_kg?: number;
  body_fat_pct?: number;
  muscle?: number;          // 0..1
  posture?: number;         // -1..1
  bust_projection?: number; // 0..1
  seat?: number;            // 0..1
  belly?: number;           // 0..1
  shoulder_slope?: number;  // 0..1
};
```

Solo seis medidas son obligatorias en el contrato (`height`, `bust`, `waist`, `hips`, `shoulder`, `inseam`). Todo lo demás es aditivo: si falta, se infiere y se marca como inferido.

### 3.2. Priors por sexo

Cuando falta una medida base, el motor la estima a partir de la altura y el sexo. Estas son las proporciones del código:

| Medida | Femenino | Masculino | Neutro |
|---|---:|---:|---:|
| Pecho | `0.53 · h` | `0.56 · h` | `0.545 · h` |
| Cintura | `0.42 · h` | `0.46 · h` | `0.44 · h` |
| Cadera | `0.55 · h` | `0.52 · h` | `0.535 · h` |
| Hombro | `0.225 · h` | `0.245 · h` | `0.235 · h` |
| Entrepierna | `0.46 · h` | `0.46 · h` | `0.46 · h` |
| Brazo | `0.34 · h` | `0.34 · h` | `0.34 · h` |

Medidas opcionales:

| Medida | Femenino | Masculino | Neutro |
|---|---:|---:|---:|
| Bajo pecho | `0.86 · bust` | `0.92 · bust` | `0.89 · bust` |
| Largo de espalda | `0.235 · h` | `0.235 · h` | `0.235 · h` |
| Cuello | `0.18 · h` | `0.19 · h` | `0.185 · h` |
| Muslo | `0.33 · h` | `0.31 · h` | `0.32 · h` |
| Pantorrilla | `0.20 · h` | `0.21 · h` | `0.205 · h` |
| Brazo relajado | `0.165 · h` | `0.175 · h` | `0.17 · h` |
| Muñeca | `0.09 · h` | `0.095 · h` | `0.0925 · h` |
| Tobillo | `0.125 · h` | `0.13 · h` | `0.1275 · h` |

**Regla dura:** si una medida se infiere, se añade a `inferred` y la UI no puede presentarla como "medida por el usuario". La confianza baja en consecuencia.

### 3.3. Validación

Cada medida se limita a `BODY_LIMITS`. Si el valor cae fuera, se clampan y se emite un `BodyWarning` con severidad `warn`. Además hay chequeos de consistencia:

| Chequeo | Condición | Código |
|---|---|---|
| Cintura vs cadera | `waist > hips + 5` | `waist_gt_hips` |
| Pecho vs bajo pecho | `bust < underbust + 1` | `bust_lt_underbust` |
| Entrepierna vs altura | `inseam > 0.55 · h` | `inseam_too_long` |
| Hombro vs altura | `shoulder > 0.36 · h` | `shoulder_too_wide` |
| Cintura vs altura | `waist < 0.30 · h` | `waist_too_small` |
| Largo de espalda | fuera de `[0.18h, 0.34h]` | `torso_length_outlier` |
| IMC implícito | `<14` o `>45` | `bmi_outlier` |

La geometría se genera igual: el aviso no bloquea el render. Es una decisión de producto: es mejor enseñar un cuerpo raro con un aviso que dejar al usuario sin probador.

### 3.4. Confianza del perfil

```
baseCoverage   = suma de pesos de las 6 medidas base presentes
pesos          = height .15 · bust .20 · waist .20 · hips .20 · shoulder .15 · inseam .10
optionalRatio  = medidas opcionales presentes / 9
optionalPenalty = 0.05 · (1 − optionalRatio)
coverage       = clamp(baseCoverage + 0.10 · optionalRatio − optionalPenalty, 0, 1)

consistency    = 1 − min(0.35, 0.06 · nº de warnings no-info)
confidence     = clamp(0.70 · coverage + 0.30 · consistency, 0, 1)
```

Ejemplo: un perfil con las 6 medidas base y sin opcionales tiene `coverage = 0.95`, `consistency = 1`, `confidence = 0.965`. Ese 96,5 % entra en la confianza del fit.

---

## 4. Etapa B — Cuerpo

### 4.1. Landmarks verticales

El motor calcula las alturas que no se pueden medir con una cinta (cadera, hombro, axila) a partir de la altura y de las medidas que sí existen:

```
crotchY    = min(inseam, 0.55 · h)
hipJointY  = crotchY + 0.04 · h
hipY       = max(0.55 · h, hipJointY + 3)
neckBaseY  = 0.835 · h
waistY     = clamp(neckBaseY − torso_length, hipY + 3, 0.66 · h)
bustY      = max(0.71 · h, waistY + 0.08 · h)
underbustY = max(waistY + 0.02 · h, bustY − 0.05 · h)
chestY     = bustY + 0.015 · h
axillaY    = max(0.765 · h, chestY + 0.01 · h)
shoulderY  = max(0.815 · h − 0.02 · h · shoulder_slope, axillaY + 0.01 · h)
chinY      = max(0.87 · h, neckBaseY + 0.02 · h)
kneeY      = 0.285 · h
ankleY     = 0.039 · h
```

La entrepierna tiene un guardrail: si supera el 55 % de la altura, la geometría usa `0.55h` para que la cadera quede por encima del crotch. El perfil conserva el dato original y emite un aviso.

### 4.2. Anillos del torso

El torso se representa como una pila de anillos horizontales. Cada anillo tiene:

```ts
type Ring = {
  y: number;   // altura en cm
  rx: number;  // semieje X
  rz: number;  // semieje Z
  cz: number;  // desplazamiento frontal (barriga, glúteo)
  n: number;   // exponente de la superelipse
};
```

La sección se dibuja como una **superelipse**:

```
x = rx · sign(cos t) · |cos t|^(2/n)
z = cz + rz · sign(sin t) · |sin t|^(2/n)
```

- `n = 2` → elipse.
- `n ≈ 2.2–2.4` → torso humano.
- `n ≥ 3` → sección muy cuadrada.

El perímetro no tiene una fórmula cerrada cómoda; se integra numéricamente con **96 muestras**:

```
perimeter ≈ Σ |P(t_i) − P(t_{i−1})|
```

Para construir un anillo a partir de un contorno `C` y una relación de profundidad `ratio`, se resuelve `rx` por **bisección** (48 iteraciones), con `rz = rx · ratio`. Así se garantiza que el anillo reproduzca la circunferencia medida.

Los anillos clave del torso son:

| Región | Circunferencia | `ratio` (aprox.) | `n` |
|---|---|---|---|
| Cadera baja | `hips · 0.98` | `0.76–0.86` según sexo/glúteo | 2.2 |
| Cadera | `hips` | idem | 2.2 |
| Cintura | `waist` | `0.70–0.78` según sexo/abdomen | 2.2 |
| Bajo pecho | `underbust` | 0.735 | 2.25 |
| Pecho | `bust` | `0.74–0.88` según sexo/proyección | `2.15–2.35` |
| Pecho alto | `bust · 0.98` | 0.75 | 2.35 |
| Axila | `bust · 0.94` | 0.72 | 2.3 |

Se interpolan 3 muestras entre claves con `smoothstep`, lo que produce ~26 anillos en los perfiles de prueba. Los anillos se validan: orden creciente de `y`, radios positivos y circunferencia reproducida con tolerancia `max(0.5 cm, 0.5 %)`.

### 4.3. Piernas, brazos, cabeza, pies y manos

- **Piernas:** 8 anillos por pierna. El centro sigue una curva de cadera → rodilla → tobillo; el muslo y la pantorrilla usan las circunferencias del perfil. La pierna se renderiza dos veces con offset en X.
- **Brazos:** 14 anillos por brazo. El eje va del hombro al codo y de ahí a la muñeca, con un ángulo de 28° respecto a la vertical (A-pose). Las circunferencias interpolan brazo relajado → codo → muñeca.
- **Cuello:** 5 anillos.
- **Cabeza:** elipsoide liso, sin cara, pelo ni ojos. Es una decisión de producto y privacidad.
- **Pies y manos:** primitivas paramétricas; no hay dedos ni anatomía fina.

### 4.4. Validación de la geometría

`validateGeometry()` comprueba:

- `Number.isFinite` en todos los componentes.
- `rx > 0`, `rz > 0`.
- Anillos ordenados por `y`.
- Torso con anillos suficientes.
- Piernas y brazos con al menos 4 anillos.
- Circunferencia reproducida dentro de tolerancia.
- Sin `NaN` en ninguna parte.

Si falla, lanza un error descriptivo. El viewer lo captura y muestra el estado de error con **Reintentar**.

### 4.5. Determinismo

`buildBody()` no usa `Math.random`, no mide tiempo, no toca red ni DOM. Mismo perfil → misma geometría. Es la base para que el veredicto sea reproducible.

---

## 5. Etapa C — Prenda

La prenda no está modelada a mano. Se construye **sobre la malla del cuerpo**:

```
malla del cuerpo
  → recorte de la superficie (torso, mangas, piernas)
  → separación por holgura (clearance)
  → solver de caída (gravedad + distancias + colisión)
  → pliegues analíticos
  → remates y detalles
  → material PBR
```

### 5.1. Holgura → separación radial

El fit devuelve holgura en **cm de contorno**. Para separar la malla, se convierte a radio:

```
radial(cm) = max(0.0025, (cm · 0.01) / (2π)) + grosor + 0.0015
```

El `grosor` sale de `FABRIC_THICKNESS_CM`:

| Tejido | Grosor (cm) |
|---|---:|
| Punto de algodón | 0.15 |
| Felpa | 0.35 |
| Denim | 0.35 |
| Punto | 0.25 |
| Lino | 0.18 |
| Piel | 0.40 |
| Satén | 0.12 |

La holgura se interpola verticalmente entre landmarks (tobillo, crotch, cadera, cintura, pecho, hombro) con los valores de `fit.zones`. Si falta una zona, se usa un fallback por tipo: camiseta 6.5, sudadera 12, chaqueta 15, vestido 7, vaquero 4, falda 7 cm. En las mangas, la holgura se multiplica por 0.72 para que no queden como un globo.

### 5.2. Recorte de la superficie

**Tops (camiseta, sudadera, chaqueta):**

- Se conservan los vértices entre el bajo (`hemY`) y el cuello (`neckCutY`).
- Se usan los grupos de huesos de la base mesh: torso, brazo izquierdo, brazo derecho.
- La manga se corta por la fracción de longitud `sleeve_cm / armLength`, proyectando el vértice sobre el eje hombro → muñeca.
- El cuello se recorta con un radio mínimo y una ligera caída frontal.
- La chaqueta se abre por el frente (`|x| < 1.8 cm`, `z > 0`).

**Vestidos y faldas:**

- Se construye un panel con 44 anillos y 128 segmentos.
- La cintura queda fija; el bajo se abre con una función de vuelo (`flare` 1.32 en vestido, 1.38 en falda, 1.18 en satén).
- La falda añade 22 pliegues senoidales.
- El vestido añade tirantes y una manga corta abullonada si el listing declara manga.

**Vaqueros:**

- Se recorta la pelvis + las dos piernas de la malla completa.
- La cintura se coloca en `crotchY + rise`, clampada alrededor de la cintura.
- El bajo se coloca con `crotchY − inseam · 0.92`, con un mínimo en el tobillo.
- Se añaden cinturilla, trabillas, bolsillos traseros, bragueta y botón.

### 5.3. Solver de caída

`relax()` no es un simulador de tela. Es una relajación iterativa:

1. **Gravedad:** cada vértice libre baja `gravity` en Y.
2. **Anclaje suave:** se mezcla una fracción pequeña con la posición de reposo para evitar deriva.
3. **Restricciones de distancia:** Gauss-Seidel sobre las aristas de la malla; cada arista intenta recuperar su longitud de reposo.
4. **Colisión direccional:** un vértice no puede quedar por debajo de `sourcePos + normal · clearance · 0.82`. Empuja a lo largo de la normal de la superficie.
5. **Pins:** hombros y cinturilla se mantienen cerca de su posición de reposo.

Parámetros típicos:

| Prenda | Gravedad | Rigidez | Iteraciones |
|---|---:|---:|---:|
| Camiseta | 0.0007 | 0.78 | 20 |
| Sudadera / chaqueta | 0.0009 | 0.78 (piel 0.92) | 20 |
| Vaquero | 0.0007 | 0.90 (denim) | 18 |
| Vestido / falda | — | — | Panel analítico, sin solver |

**Lo que no hace:** no hay autocolisión, no hay bending, no hay masa, no hay tiempo. Es una aproximación geométrica que produce caída y pliegues, no una simulación física.

### 5.4. Pliegues

Después de relajar, se añaden pliegues analíticos con una suma de senos en función de `θ` (ángulo alrededor del cuerpo) y `y`:

```
wave = sin(θ·k1 + y·k2 + seed) · a1
     + sin(θ·k3 − y·k4 + c) · a2
     + sin(y·k5 + θ·k6) · a3
```

La amplitud depende del tejido: felpa 0.8 cm, denim 0.45 cm, resto 0.4–0.45 cm; el satén usa una frecuencia más suave. El `seed` sale de la longitud del `id` del listing, no de `Math.random`: es determinista.

### 5.5. Remates y detalles

| Prenda | Detalles |
|---|---|
| Camiseta | Cuello de canalé, puños, bajo |
| Sudadera | Capucha, bolsillo canguro, puños, bajo |
| Chaqueta | Cremallera (piel) o botones, solapa, bajo |
| Vaquero | Cinturilla, trabillas, bolsillos, bragueta, botón |
| Vestido | Tirantes, cinturilla, manga corta abullonada, escote |
| Falda | Cinturilla, pliegues, vuelo |

Los remates son tubos sobre el borde del recorte (`addLoopRib`), no costuras reales. Es la deuda visual más visible de la prenda.

### 5.6. Materiales PBR

Cada tejido tiene una receta de `MeshPhysicalMaterial`:

| Tejido | Roughness | Sheen | Normal scale | Textura |
|---|---:|---:|---:|---|
| Punto de algodón | 0.90 | 0.34 | 0.55 | `cotton_jersey` |
| Felpa | 0.97 | 0.90 | 0.85 | `knitted_fleece` |
| Denim | 0.86 | 0.16 | 0.80 | `denim_fabric_03` |
| Lino | 0.92 | 0.30 | 0.55 | `rough_linen` |
| Punto | 0.90 | 0.56 | 0.90 | `jersey_melange` |
| Piel | 0.52 | 0.10 | 0.75 | `brown_leather` + clearcoat 0.35 |
| Satén | 0.28 | 0.68 | 0.20 | `crepe_satin` |

Las UVs son cilíndricas: `u = (atan2(x, z) + π) / 2π`, `v = (y − hemY) / (neckY − hemY)`. El color base se toma de `LISTING_STYLE` para que cada anuncio tenga su tono.

### 5.7. Media malla y espejo

La base mesh es una media malla con corte sagital. El viewer:

1. Construye el cuerpo y la prenda en la mitad visible.
2. Clona el grupo y lo espeja con `scale.z = -1`.
3. Mantiene el original y el espejo bajo un `root`.

Esto permite orbitar 360°, pero el sombreado de la mitad espejada y el encaje en `Z = 0` siguen en revisión. Es la deuda P0 de [QUALITY](QUALITY.md).

---

## 6. Etapa D — Fit

### 6.1. Fórmula

```
ease = contorno_prenda − contorno_cuerpo − 2π · grosor
```

- `contorno_prenda` se obtiene de las medidas planas del listing: `× 2` para axila-axila, cintura, cadera, muslo y bajo.
- `contorno_cuerpo` sale del perfil resuelto.
- `2π · grosor` descuenta el espesor del tejido.

**Unidades:** todo en cm de contorno. `ease > 0` significa que sobra tela; `ease < 0`, que aprieta.

### 6.2. Bandas por tipo

| Prenda | `too_small` | `tight` | `regular` | `loose` | `too_big` |
|---|---:|---:|---:|---:|---:|
| Camiseta | `< −2` | `−2…3` | `3…10` | `10…20` | `> 20` |
| Sudadera | `< 2` | `2…8` | `8…16` | `16…28` | `> 28` |
| Vestido | `< 0` | `0…4` | `4…10` | `10…20` | `> 20` |
| Chaqueta | `< 4` | `4…10` | `10…20` | `20…32` | `> 32` |
| Vaquero | `< −1` | `−1…2` | `2…6` | `6…12` | `> 12` |
| Falda | `< 0` | `0…4` | `4…10` | `10…18` | `> 18` |

La implementación usa `classifyEase(ease, band)`:

```
if ease < band.tooSmall  → 'too_small'
if ease < band.tight     → 'tight'
if ease <= band.regular  → 'regular'
if ease <= band.loose    → 'loose'
else                     → 'too_big'
```

### 6.3. Zonas por tipo

| Tipo | Zonas que calcula |
|---|---|
| Camiseta / sudadera / chaqueta | Pecho (`pit_to_pit × 2`) |
| Vestido | Pecho, cintura, cadera |
| Vaquero | Cintura, muslo, cadera |
| Falda | Cintura, cadera |

Si una medida falta, la zona se descarta (`Number.isFinite`). El veredicto usa la **zona crítica**: la que tiene el `ease_cm` más negativo. No se promedian zonas.

### 6.4. Confianza del fit

```
coverage   = clamp(zonas_medidas / zonas_requeridas, 0, 1)
confidence = clamp(0.42 + 0.30 · coverage + 0.18 · body.confidence
                   + 0.10 · min(zonas_medidas / 3, 1), 0, 1)
```

- `zonas_requeridas` es 2 para vestido y 1 para el resto (una simplificación).
- `body.confidence` viene del perfil (0–1).
- El resultado se muestra como porcentaje en la UI.

**Ejemplo Carhartt:** 1 zona medida, `coverage = 1`, `body.confidence ≈ 0.965`:

```
0.42 + 0.30 + 0.18·0.965 + 0.10·(1/3) ≈ 0.927 → 93 %
```

Ese es el 93 % que se ve en la captura del README.

### 6.5. Medidas faltantes

`missing` se construye por tipo:

- Tops: si falta `pit_to_pit_cm` → "axila a axila".
- Vestido / vaquero / falda: si falta `waist_cm` → "cintura".
- Vestido: si falta `pit_to_pit_cm` → "pecho".

No es una lista exhaustiva de todas las medidas opcionales; es una señal para el usuario. Está en deuda P1.

### 6.6. Dos ejemplos resueltos

**Sudadera Carhartt (felpa):**

```
pit_to_pit = 56 cm → contorno = 112 cm
bust_cuerpo = 92 cm
grosor = 0.35 cm → 2π·0.35 = 2.199 cm
ease = 112 − 92 − 2.199 = 17.8 cm
banda hoodie: 16…28 → loose
```

**Levi's 501 (denim):**

```
waist = 41 cm → contorno = 82 cm
waist_cuerpo = 78 cm
grosor = 0.35 cm → 2.199 cm
ease = 82 − 78 − 2.199 = 1.8 cm
banda jeans: 2…6 → tight (por debajo de 2)
```

La diferencia entre "holgado" y "justo" no es una opinión: es una resta.

### 6.7. `fit-lite` vs contrato

El contrato `FitZone` incluye `tension`; el `fit-lite` **no la calcula**. Tampoco rellena `confidence_parts` ni usa `sources`. Es una vista previa funcional, no el motor definitivo. La deuda está registrada en [CLAIMS](CLAIMS.md), [DECISIONS](DECISIONS.md) y [QUALITY](QUALITY.md).

---

## 7. Etapa E — Heatmap

El mapa de tensión no es una simulación por vértice. Es una **visualización por zonas**:

1. Se clona la geometría de la prenda.
2. Para cada vértice, se busca la zona cuyo landmark vertical está más cerca: pecho → `chestY`, cintura → `waistY`, cadera → `hipY`, muslo → `crotchY − 0.08`.
3. Se pinta el color del veredicto de esa zona.

Colores:

| Veredicto | Color |
|---|---|
| `too_small` | `#b3261e` |
| `tight` | `#a15c00` |
| `regular` | `#007782` |
| `loose` | `#2f5d8a` |
| `too_big` | `#5b5b57` |

La malla del heatmap usa `vertexColors`, opacidad 0.5, `depthWrite: false` y `polygonOffset` para no pelear con la prenda. No hay gradiente continuo ni tensión por vértice: es un mapa de zonas, y así se dice en el ledger.

---

## 8. Determinismo y robustez

| Riesgo | Mitigación |
|---|---|
| Medida absurda | `BODY_LIMITS` + clamp + warning |
| Perfil incompleto | Priors + `inferred` + confianza más baja |
| Anillo desordenado | `validateGeometry()` lanza |
| Circunferencia mal reproducida | Bisección + tolerancia + error |
| `NaN` | `assertFinite()` |
| Prenda no construible | `buildGarment()` devuelve `null`; se oculta y se avisa |
| Texturas ausentes | Material sin mapas |
| Storage bloqueado | `try/catch`; la sesión sigue |
| Red | No se usa; todo local |

**Semilla determinista:** los pliegues usan `seed = (listing.id?.length || 3) * 0.37` y constantes fijas. No hay `Math.random` en el motor ni en la prenda.

---

## 9. Complejidad y rendimiento

| Pieza | Orden de magnitud |
|---|---|
| Torso | ~26 anillos × 96 muestras |
| Piernas | 2 × 8 anillos |
| Brazos | 2 × 14 anillos |
| Prenda | ~10k vértices en el ejemplo Carhartt; se muestra en la UI |
| Solver | 18–20 iteraciones × aristas |
| Heatmap | 1 malla clonada + color por vértice |
| Base mesh | 107 024 triángulos, 71 695 vértices, 163 huesos |

El coste real está en el solver y en la reconstrucción de la prenda; por eso hay `requestAnimationFrame` para el cuerpo y 150 ms de debounce para la prenda.

---

## 10. Verificación

```bash
# 1. Verificación numérica del motor de cuerpo
npx --yes tsx packages/fit-engine/scripts/check-body.ts
```

Salida esperada (resumida):

```
perfil              conf torso  piernas   brazos cuello ...
female-165         1.000    26      8/8    14/14      5 ...
male-180           1.000    26      8/8    14/14      5 ...
female-plus-170    1.000    26      8/8    14/14      5 ...
male-small-160     1.000    26      8/8    14/14      5 ...
neutral-inferred   0.965    26      8/8    14/14      5 ...
OK: geometría, landmarks y circunferencias verificados.
```

```bash
# 2. Sintaxis del viewer y la prenda
node --input-type=module --check < demo/vinted-mock/viewer3d/app.js
node --input-type=module --check < demo/vinted-mock/viewer3d/garment-builder.js

# 3. Demo
node demo/vinted-mock/serve.mjs 8080
```

El detalle de la matriz de pruebas está en [QUALITY](QUALITY.md).

---

## 11. Limitaciones

1. La malla base es CC0 y se deforma; no es un cuerpo escaneado.
2. La prenda se recorta de la malla; no hay costuras reales ni patrón 2D.
3. El solver no es XPBD: no hay autocolisión, bending ni masa.
4. El heatmap es por zonas, no por tensión por vértice.
5. `fit-lite` no implementa `tension` ni `confidence_parts`.
6. No hay medición de error contra una prenda real; la validación es geométrica y numérica, no empírica.

---

## 12. Glosario

| Término | Significado |
|---|---|
| **Ring** | Anillo horizontal de la pila que forma cuerpo o prenda |
| **Superelipse** | Sección con exponente `n`; permite pasar de elipse a torso cuadrado |
| **Landmark** | Altura o punto anatómico de referencia (pecho, cintura, cadera...) |
| **Ease / holgura** | Diferencia entre contorno de prenda y de cuerpo, menos grosor |
| **Tensión** | Medida normalizada de cuánto aprieta; en el contrato, no en `fit-lite` |
| **Clearance** | Separación radial entre cuerpo y prenda en la escena |
| **Fit-lite** | Cálculo de fit de la demo, en `viewer3d/app.js` |
| **Heatmap** | Mapa de colores por zona de veredicto |
| **WIP** | Implementado, con acabados en revisión |
| **Ledger** | Registro de claims con estado y evidencia |

---

<div align="center">
<sub>La geometría no es una caja negra. Si el veredicto dice que aprieta 1,8 cm, hay una resta que lo demuestra.</sub>
</div>
