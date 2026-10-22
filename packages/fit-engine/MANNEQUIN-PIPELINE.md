# Maniquí paramétrico — pipeline antropométrica

> **Decisión de producto:** realismo **antropométrico**, no fotorrealismo.
> El maniquí tiene proporciones, landmarks y volúmenes creíbles; sigue sin cara,
> sin piel y sin pelo. Es la estética de estudio de sastrería del `PLAN.md`, pero
> con anatomía suficiente para que la prenda caiga donde tiene que caer.
>
> **Alcance de esta iteración:** diseño + prototipo del solver. No toca viewer,
> prenda ni `types.ts`.

---

## 1. Por qué esta pipeline y no un avatar genérico

Un avatar genérico no sirve para decidir una talla: puede ser bonito y medir
otra cosa. Un modelo estadístico tipo SMPL sería más fiel, pero añade licencia,
peso, runtime y una caja negra que no podemos explicar en el escenario.

La pipeline hace lo contrario: **las medidas mandan**. El sexo, la altura y los
rasgos solo rellenan lo que una cinta métrica no puede medir (posición de la
cadera, pendiente del hombro, proyección del pecho, volumen del glúteo). Cada
valor inferido se marca como inferido y baja la confianza.

La frase que resume el diseño:

> **No modelamos un cuerpo a mano: lo resolvemos.**

Y la que lo defiende ante un jurado:

> **El LLM decide y explica; las medidas las pone el usuario; la geometría la
> valida una resta.**

---

## 2. Pipeline en 7 etapas

```
                    ┌──────────────────────────────┐
  usuario ─────────►│ 0. PERFIL                    │  6 medidas base
  (medidas +        │    BodyProfile               │  + opcionales
   rasgos)          └──────────────┬───────────────┘  + rasgos ("espalda ancha")
                                   │
                    ┌──────────────▼───────────────┐
                    │ 1. INTÉRPRETE                │  LLM o keywords
                    │    texto → ShapeTraits       │  NUNCA inventa cm
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ 2. RESOLUCIÓN ANTROPOMÉTRICA │  priors por sexo/altura
                    │    huecos + validación       │  clamp + avisos
                    └──────────────┬───────────────┘
                                   │  ResolvedBodyProfile
                    ┌──────────────▼───────────────┐
                    │ 3. LANDMARKS                 │  cadera, cintura, busto,
                    │    alturas y ejes            │  hombro, rodilla, tobillo
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ 4. GEOMETRÍA PROCEDURAL      │  superelipses + tubos
                    │    torso, piernas, brazos    │  sin assets
                    └──────────────┬───────────────┘
                                   │  BodyGeometry
                    ┌──────────────▼───────────────┐
                    │ 5. ACOPLE CON PRENDA + FIT   │  BodyRings = contrato
                    │    holgura + heatmap         │  aritmética pura
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ 6. QA + CONFIANZA            │  reproyección < 0.5 cm
                    │    "¿el cuerpo mide lo que   │  avisos + inferred
                    │     dice que mide?"          │
                    └──────────────────────────────┘
```

**Las etapas 2, 3, 4 y 6 son deterministas.** El LLM solo aparece en la 1 (y,
si se quiere, redactando la pregunta de la etapa 2). Nunca está entre la medida
y el veredicto.

---

## 3. Etapa 0 — Perfil de entrada

### 3.1 Medidas base (contrato congelado, no cambia)

| Campo | Qué es | Uso geométrico |
|---|---|---|
| `height_cm` | altura total | escala de todos los landmarks y proporciones |
| `bust_cm` | contorno de pecho | anillo de busto; radio X/Z y proyección |
| `waist_cm` | contorno de cintura | anillo de cintura; mínimo de la silueta |
| `hips_cm` | contorno de cadera | anillo de cadera; máximo inferior |
| `shoulder_cm` | ancho de hombro, punta a punta | anillo de hombro + posición de la articulación |
| `inseam_cm` | entrepierna → suelo | altura del crotch y longitud de pierna |
| `arm_cm` | largo de brazo (hombro → muñeca) | longitud del tubo de brazo |

### 3.2 Medidas opcionales (aditivas, no rompen el contrato)

| Campo | Qué es | Si falta |
|---|---|---|
| `underbust_cm` | contorno bajo el pecho | `bust × 0.86` (mujer) / `0.92` (hombre) |
| `back_width_cm` | ancho de espalda a la altura de las escápulas | `shoulder × 0.82` |
| `torso_length_cm` | C7 → cintura natural (largo de espalda) | `0.235 × height` |
| `neck_cm` | contorno de cuello | `0.18–0.19 × height` según sexo |
| `thigh_cm` | contorno del muslo alto | `0.31–0.33 × height` |
| `calf_cm` | contorno de pantorrilla | `0.20–0.21 × height` |
| `upper_arm_cm` | contorno del brazo relajado | `0.165–0.175 × height` |
| `wrist_cm` | contorno de muñeca | `0.09–0.095 × height` |
| `ankle_cm` | contorno de tobillo | `0.125–0.13 × height` |

**Sobre "espalda":** se cubren las dos acepciones. `back_width_cm` es el ancho
(escápulas) y `torso_length_cm` es el largo (C7 → cintura). Si el usuario solo
dice "espalda ancha", el intérprete mueve la pendiente de hombro, no inventa un
ancho.

### 3.3 Rasgos cualitativos

Son los que el usuario sí sabe decir sin cinta:

- `muscle` (0–1): complexión atlética.
- `posture` (-1–1): encorvado ↔ arqueado.
- `bust_projection` (0–1): proyección frontal del pecho.
- `seat` (0–1): volumen de glúteos.
- `belly` (0–1): volumen abdominal.
- `shoulder_slope` (0–1): hombro recto ↔ caído.

Y dos datos opcionales que modulan los priors, no las medidas:
`weight_kg`, `body_fat_pct`.

---

## 4. Etapa 1 — Intérprete de rasgos (LLM + fallback)

### 4.1 Qué puede y qué no puede hacer el LLM

| Puede | No puede |
|---|---|
| Convertir "hombros anchos, cintura marcada" en `ShapeTraits` | Escribir `waist_cm: 68` |
| Elegir qué medida preguntar primero | Cambiar una medida declarada |
| Redactar la explicación de la confianza | Tocar `BodyGeometry` o el veredicto |

**Salida estricta** (JSON schema, `temperature: 0`):

```json
{
  "shape": {
    "shoulder_slope": 0.2,
    "muscle": 0.8,
    "posture": -0.6
  },
  "why": ["hombros anchos → línea de hombro más recta"],
  "ask_user": "¿Cuánto mides de espalda, de la base del cuello a la cintura?"
}
```

Si el modelo devuelve una medida en cm, se descarta. Si devuelve un valor fuera
de rango, se ajusta al rango. Si tarda más de 800 ms o falla, se usa el fallback.

### 4.2 Fallback determinista (implementado)

`interpretBodyTraits()` en `src/body-intent.ts` reconoce frases en español e
inglés y devuelve la misma estructura. Ejemplos:

| Frase | Efecto |
|---|---|
| "hombros anchos" / "espalda ancha" | `shoulder_slope: 0.2` |
| "hombros caídos" | `shoulder_slope: 0.8` |
| "complexión atlética" | `muscle: 0.8`, `belly: 0.1` |
| "caderas anchas" / "curvas" | `seat: 0.8`, `bust_projection: 0.65` |
| "pecho grande" | `bust_projection: 0.85` |
| "barriga" | `belly: 0.75` |
| "postura encorvada" | `posture: -0.6` |

Regla de merge: `applyBodyIntent()` **solo rellena campos que el usuario no ha
definido**. Lo explícito siempre gana.

### 4.3 Pregunta activa (opcional, recomendada)

Si faltan medidas, no se enseña un formulario: se hace **una** pregunta. La
prioridad depende de la prenda y de la sensibilidad del veredicto:

| Prenda | Primera medida a preguntar |
|---|---|
| Camiseta / sudadera | pecho, hombro, cintura |
| Vaquero / falda | cintura, cadera, entrepierna |
| Vestido | pecho, cintura, cadera |
| Chaqueta | pecho, hombro, largo de espalda |

El LLM solo redacta la pregunta; la elige una tabla determinista.

---

## 5. Etapa 2 — Resolución antropométrica

`resolveBodyProfile()` convierte un perfil parcial en uno completo.

### 5.1 Priors por sexo

El sexo **no cambia las medidas declaradas**. Solo cambia la forma cuando falta
un dato o cuando hay que repartir profundidad:

| Prior | Mujer | Hombre | Neutro |
|---|---|---|---|
| Profundidad/anchura de cadera | 0.82 | 0.76 | 0.79 |
| Profundidad/anchura de cintura | 0.70 | 0.74 | 0.72 |
| Profundidad/anchura de busto | 0.80 + proyección×0.08 | 0.74 | 0.77 |
| Contorno de muslo por altura | 0.33H | 0.31H | 0.32H |
| Contorno de pantorrilla por altura | 0.20H | 0.21H | 0.205H |
| Contorno de brazo (`upper_arm`) por altura | 0.165H | 0.175H | 0.17H |
| Contorno de cuello por altura | 0.18H | 0.19H | 0.185H |
| Largo de brazo (hombro→muñeca) | 0.34H | 0.34H | 0.34H |
| Separación de caderas | 0.050H | 0.046H | 0.048H |

El preset `male | female | neutral` se elige en la UI; después cada slider y
cada medida mandan. Un hombre con cadera 110 se genera con cadera 110, no con
la cadera del prior.

### 5.2 Validación

Cada medida se clampa a un rango plausible y se avisa:

| Regla | Acción |
|---|---|
| `height` 150–210, `bust` 60–180, `waist` 45–160, `hips` 65–190 | clamp + aviso |
| `waist > hips + 5` | aviso: revisar medidas; se genera igual |
| `bust < underbust + 1` | aviso: pecho/bajo pecho incoherentes |
| `inseam > 0.55 × height` | aviso: entrepierna demasiado larga |
| `shoulder > 0.36 × height` | aviso: hombro demasiado ancho |
| `waist < 0.30 × height` | aviso: cintura demasiado pequeña |
| `torso_length` fuera de 0.18–0.34H | aviso |
| IMC implícito < 14 o > 45 | aviso |
| `back_width` no cabe en el contorno de pecho | se recorta y se avisa |

Nada de esto lanza una excepción: el cuerpo se genera y la UI enseña el aviso.
Un maniquí que dice "no estoy seguro" es más útil que uno que falla.

### 5.3 Confianza

```
baseCoverage   = suma de pesos de las 6 medidas base presentes
                 (height .15, bust .20, waist .20, hips .20, shoulder .15, inseam .10)
optionalRatio  = opcionales presentes / 9
coverage       = clamp(baseCoverage + 0.10·optionalRatio − 0.05·(1−optionalRatio), 0, 1)
consistency    = 1 − min(0.35, avisos_no_info × 0.06)
confidence     = 0.70·coverage + 0.30·consistency
```

Se enseña siempre. `< 0.50` → "faltan datos"; `0.50–0.75` → "orientativo";
`≥ 0.75` → "cálculo fiable". Las medidas inferidas van en `inferred[]` y se
muestran como estimadas, nunca como declaradas.

---

## 6. Etapa 3 — Landmarks

Las alturas salen de la altura, la entrepierna y el largo de espalda. Las
proporciones solo rellenan lo que no se mide con cinta:

| Landmark | Fórmula | Ejemplo 175 cm |
|---|---|---|
| Suelo | 0 | 0 |
| Tobillo | `0.039H` | 6.8 cm |
| Rodilla | `0.285H` | 49.9 cm |
| Crotch | `min(inseam, 0.55H)` | 80.0 cm |
| Cadera (máx.) | `max(0.55H, crotch + 0.04H + 3)` | 96.3 cm |
| Cintura | `neck_base − torso_length` | 105.0 cm |
| Bajo pecho | `bust − 0.05H` | 115.5 cm |
| Busto | `max(0.71H, waist + 0.08H)` | 124.3 cm |
| Pecho | `bust + 0.015H` | 126.9 cm |
| Axila | `max(0.765H, chest + 0.01H)` | 133.9 cm |
| Hombro | `0.815H − 0.02H·shoulder_slope` | 141.4 cm |
| Base del cuello | `0.835H` | 146.1 cm |
| Barbilla | `max(0.87H, neck_base + 0.02H)` | 152.3 cm |
| Coronilla | `H` | 175.0 cm |

Si el orden se rompe (por una medida extrema), se clampea la cintura y se
empuja el resto. El check numérico lo detecta.

> Si `inseam > 0.55H`, la geometría lo regulariza y avisa
> (`inseam_regularized`). El perfil conserva el dato original; el landmark usa
> el valor efectivo para que la cadera quede por encima del crotch.

---

## 7. Etapa 4 — Geometría procedural

### 7.1 La primitiva: superelipse

Cada anillo es una superelipse:

```
x = rx · sign(cos t) · |cos t|^(2/n)
z = cz + rz · sign(sin t) · |sin t|^(2/n)
```

- `n = 2` → elipse.
- `n = 2.2–2.35` → torso.
- `n = 2.5` → hombro ancho y plano.
- `n = 2.0` → brazos y piernas.

Para un contorno `C` y una relación de profundidad `k = rz/rx`, se resuelve
`rx` por bisección con el perímetro numérico de la superelipse. Así **el anillo
mide exactamente lo que dice medir**, no una aproximación circular.

### 7.2 Torso

- 7 anillos clave: cadera baja, cadera, cintura, bajo pecho, busto, pecho, axila.
- 3 anillos interpolados entre cada par (26 anillos en total).
- Transición axila → hombro → base del cuello: 3 + 1 + 2 + 1 anillos.
- `cz` desplaza el centro de la sección para modelar glúteo (atrás), barriga
  (adelante), pecho (adelante) y postura. La circunferencia no cambia.
- `back_width_cm` fija la anchura del anillo de pecho; si no cabe en el
  contorno, se recorta y se avisa.

### 7.3 Piernas

Dos tubos con anillos horizontales:

- 8 anillos: muslo alto, muslo, muslo medio, sobre rodilla, rodilla,
  pantorrilla, bajo pantorrilla, tobillo.
- Cadera → rodilla → tobillo con una ligera convergencia (rodillas y tobillos
  más juntos que las caderas).
- La rodilla tiene un sesgo frontal (rótula); la pantorrilla, un sesgo posterior
  (gemelo).
- La cadera del tubo se solapa con el torso: no hay costura visible.

### 7.4 Brazos

- 14 anillos sobre una curva hombro → codo → muñeca en **A-pose** (28°).
- Anillos orientados perpendicularmente a la tangente del brazo, no horizontales.
- Perfil de contorno: deltoides (×1.12), bíceps (×1.0), codo (×0.86),
  antebrazo (×0.84), muñeca.
- La mano es un mitten elipsoidal orientado con el antebrazo. Sin dedos.

### 7.5 Cabeza, cuello, pies y manos

- **Cabeza:** elipsoide liso, sin cara. `rx = 0.045H`, `rz = 0.055H`, alto =
  barbilla → coronilla. Es decisión de producto, no un fallo.
- **Cuello:** 5 anillos entre la base y la barbilla, con un ligero estrechamiento.
- **Pies:** elipsoides achatados desde el tobillo hasta el suelo, con el talón
  detrás y la punta delante. Sin dedos.
- **Manos:** mitten elipsoidal. Sin dedos.

### 7.6 Lo que no se hace (y por qué)

- **Cloth simulation:** no cabe en 4 h y no mejora el veredicto. La holgura por
  anillos ya da el 85% del resultado visual.
- **Piel, poros, pelo, cara:** rompen la estética del plan y entran en uncanny
  valley. El realismo que vendemos es antropométrico.
- **Skinned mesh / rig:** el cuerpo es estático y se regenera. Un esqueleto de
  render añadiría horas sin mejorar la talla.
- **SMPL/SMPL-X:** licencia, peso y runtime. Es una buena línea de roadmap, no
  una decisión de hackathon.

---

## 8. Etapa 5 — Acople con la prenda y el fit

El contrato no cambia: **el torso sigue siendo `Ring[]`**. La prenda se genera
con los mismos anillos y la misma aritmética de holgura.

```
BodyGeometry.torso : BodyRing[]   // Ring + cx + region + circumference_cm
BodyGeometry.legs  : BodyLimb[]   // PathRing[] (centro + ejes locales)
BodyGeometry.arms  : BodyLimb[]   // PathRing[] (centro + ejes locales)
```

- **Camiseta / sudadera / chaqueta / vestido:** usan `torso` y `arms`.
- **Vaquero / falda:** usan `torso`, `legs` y los landmarks de cintura/cadera.
- **Heatmap:** se calcula por anillo zonal (busto, cintura, cadera, hombro,
  muslo) y se pinta sobre la prenda. No necesita la malla de render.
- **Colisión:** no hay simulación. La prenda se separa del cuerpo por
  `ease(y)`; si `ease < 0`, se pinta en rojo y se avisa. Es suficiente para el
  veredicto.

Ventaja: el cuerpo puede mejorar su malla de render sin tocar el motor de fit.
La fuente de verdad de la talla son los anillos, no los triángulos.

### 8.1 Conexión con `docs/pipeline.md`

| Pipeline de prenda | Pipeline de cuerpo |
|---|---|
| `Listing` + fotos → `Garment` | `BodyProfile` → `BodyGeometry` |
| LLM orquestador decide qué herramienta llamar | LLM intérprete decide rasgos y pregunta |
| `confidence` de medidas de prenda | `confidence` de medidas de cuerpo |
| `computeFit(garment, body.torso)` | consume `BodyGeometry.torso` |

`computeFit` no cambia: sigue recibiendo `Body`/`Ring[]` y `Garment`. La
confianza final puede ser `min(confidence_body, confidence_garment)` o una
media ponderada; la UI debe enseñar las dos por separado. El cuerpo nunca sale
del dispositivo; el listing sí puede precalcularse.

---

## 9. Etapa 6 — QA y confianza

### 9.1 Reproyección

Para cada anillo clave se recalcula el perímetro de la superelipse y se compara
con la medida de entrada. El check falla si la desviación supera **0.5 cm o el
0.5%** (lo que sea mayor). En el prototipo, los 5 perfiles pasan con error
prácticamente nulo.

### 9.2 Perfiles dorados

`scripts/check-body.ts` prueba:

| Perfil | Por qué |
|---|---|
| `female-165` | referencia mujer talla media |
| `male-180` | referencia hombre alto |
| `female-plus-170` | talla grande, cadera 120 |
| `male-small-160` | hombre pequeño, hombro 40 |
| `neutral-inferred` | solo 6 medidas base; prueba priors y `inferred` |

Además comprueba que el intérprete de rasgos no pisa lo explícito y que un
perfil sin medidas opcionales baja la confianza. También se prueban perfiles
extremos (entrepierna larga, cintura > cadera, espalda ancha, IMC alto, medidas
fuera de rango) para garantizar que el solver avisa y no lanza excepciones.

### 9.3 Rendimiento

- ~26 anillos de torso + 8×2 piernas + 14×2 brazos + 5 cuello ≈ 75 anillos.
- 64 segmentos por anillo ≈ 4.800 vértices, ~9.600 triángulos.
- Todo es matemática pura: < 5 ms en un portátil normal.
- Cache por hash de medidas; debounce de sliders a 16 ms.
- La malla de render se reconstruye solo cuando cambia el perfil, no en
  `useFrame`.

---

## 10. Contrato de datos y compatibilidad

### 10.1 Lo que NO se toca

`src/types.ts` es del lead y sigue congelado. `Body` mantiene sus 6 medidas y
`arm_cm` opcional. `mock-body.ts` sigue siendo el fixture del viewer.

### 10.2 Lo que se añade (aditivo)

```ts
// src/body-profile.ts
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
  muscle?: number;
  posture?: number;
  bust_projection?: number;
  seat?: number;
  belly?: number;
  shoulder_slope?: number;
};

// src/body.ts
buildBody(profile: BodyProfile): BodyGeometry
```

`BodyGeometry` contiene `torso`, `legs`, `arms`, `neck`, `head`, `feet`,
`hands`, `landmarks`, `warnings`, `inferred`, `confidence` y `meta`.

**Propuesta al lead:** si el equipo quiere que las medidas opcionales viajen en
el contrato congelado, se añaden como opcionales a `Body` en `types.ts`. Hasta
entonces, `BodyProfile` las declara sin romper nada.

---

## 11. Ledger: qué es real, qué es demo y qué es roadmap

| Capacidad | Estado | Nota |
|---|---|---|
| Perfil 6 medidas + opcionales | **REAL** | `resolveBodyProfile()` |
| Priors por sexo y altura | **REAL** | tablas de §5.1 |
| Validación + clamp + avisos | **REAL** | `warnings[]` |
| Confianza con medidas inferidas | **REAL** | `confidence`, `inferred[]` |
| Landmarks y geometría procedural | **REAL** | `buildBody()` |
| Torso, piernas, brazos, cuello, cabeza, pies, manos | **REAL** | ~75 anillos |
| Intérprete de rasgos determinista | **REAL** | `interpretBodyTraits()` |
| Intérprete LLM de rasgos | **DEMO** | mismo JSON; fallback siempre |
| Sliders de forma en vivo | **DEMO** | viewer, no incluido aquí |
| Materiales de estudio / HDRI | **DEMO** | capa de render |
| Malla base CC0 + deformación runtime | **REAL (prototipo)** | viewer3d: Innerscene/MakeHuman |
| Morph targets pre-bakeados | **ROADMAP** | Blender / MakeHuman |
| SMPL / SMPL-X | **ROADMAP** | licencia y runtime |
| Cuerpo desde foto/escaneo | **ROADMAP** | privacidad + 4 h |
| Cloth simulation | **ROADMAP** | no MVP |

### Escalera de realismo

| Nivel | Qué es | Cuándo |
|---|---|---|
| L0 | maniquí abstracto de anillos | plan original |
| **L1** | **antropométrico creíble (esta pipeline)** | **ahora** |
| **L1.5** | **malla base CC0 + deformación runtime (prototipo viewer)** | **ahora, demo** |
| L2 | malla base + morph targets pre-bakeados | stretch |
| L3 | modelo estadístico (SMPL/STAR) | roadmap |
| L4 | escaneo / generativo | roadmap |

No saltamos de L1 a L4: cada nivel añade assets, licencias o privacidad. El
pitch debe decir en qué nivel estamos.

---

## 12. Plan de 4 horas

| Hora | Entregable | Cómo |
|---|---|---|
| T+0:20 | Contrato `BodyProfile` aditivo | este documento + `body-profile.ts` |
| T+0:50 | Torso + piernas con 6 medidas | `buildBody()` |
| T+1:10 | Viewer consume `torso` | sustituir `MOCK_TORSO_RINGS` |
| T+1:30 | Brazos + cuello + cabeza + pies | misma pipeline |
| T+2:00 | Sliders de sexo/forma + confianza | `zustand` + panel |
| T+2:30 | Golden profiles + heatmap | `check-body.ts` + fit |
| T+2:50 | Feature freeze | solo bugs |

**Si el tiempo aprieta:** torso + piernas + cabeza. Los brazos se pueden dejar
como cápsulas simples; no afectan al veredicto de una camiseta.

**Lo que no se hace en 4 h:** malla base, SMPL, dedos, cara, cloth sim.

---

## 13. Cómo contarlo en el pitch

**Frase de producto:**

> "El maniquí no es un avatar genérico: es tu cuerpo resuelto a partir de tus
> medidas. El sexo y la altura solo rellenan lo que la cinta no puede medir.
> Y cada centímetro inferido se marca como inferido."

**Frase técnica:**

> "La cintura no la dibuja una IA: es un anillo cuya circunferencia se resuelve
> por bisección y se reproyecta para comprobar que mide lo que dice. Si se
> desvía 0.5 cm, el check falla."

### Q&A anticipado

| Pregunta | Respuesta |
|---|---|
| ¿Esto es realista? | Antropométricamente, sí: proporciones, landmarks y volúmenes. No prometemos piel ni cara; prometemos centímetros. |
| ¿Por qué no un avatar generativo? | Porque embellece y no es auditable. Aquí la geometría sale de una resta que podemos enseñar. |
| ¿Cómo sabéis que la cintura mide 70? | El anillo se resuelve contra el contorno y se reproyecta; el check falla si se desvía más de 0.5 cm. |
| ¿Y si el usuario no sabe sus medidas? | Priors + una sola pregunta. Lo inferido se marca y baja la confianza. |
| ¿Por qué no SMPL? | Licencia, peso y runtime. Y no necesitamos una malla estadística para un veredicto de holgura. |
| ¿Cuerpos diversos? | El maniquí es el usuario, no un ideal. Los sliders cubren forma, no solo talla. |
| ¿Esto sustituye a la prenda procedural? | No: la alimenta. El torso sigue siendo `Ring[]`; la prenda se calcula igual. |

---

## 14. Archivos y verificación

```
packages/fit-engine/
├── MANNEQUIN-PIPELINE.md      # este documento
├── src/
│   ├── body-profile.ts        # perfil, priors, validación, confianza
│   ├── body-intent.ts         # rasgos → ShapeTraits (fallback determinista)
│   ├── body.ts                # landmarks + geometría procedural
│   └── index.ts               # exports
└── scripts/
    ├── check-body.ts          # 5 perfiles + reproyección + rasgos
    └── render-body-preview.ts # render de QA (SVG → PNG)
```

Ejecutar:

```bash
npx tsx packages/fit-engine/scripts/check-body.ts
```

Salida esperada (resumen):

```
perfil              conf torso  piernas   brazos cuello        cintura         cadera          pecho  inf  warn
female-165         1.000    26      8/8    14/14      5      70.0→98.8      96.0→90.8     88.0→117.1    0     0
male-180           1.000    26      8/8    14/14      5     84.0→108.3      98.0→99.0    100.0→127.8    0     0
female-plus-170    1.000    26      8/8    14/14      5      95.0→100.9     120.0→93.5    110.0→120.7    0     0
male-small-160     1.000    26      8/8    14/14      5      74.0→96.6      90.0→88.0     88.0→113.6    0     0
neutral-inferred   0.965    26      8/8    14/14      5      76.0→103.2     98.0→94.6     92.0→122.1   10     0
```

(La columna `→` es `medida declarada → altura del landmark`.)

### Ver el maniquí sin montar el viewer

`render-body-preview.ts` dibuja el cuerpo directamente desde `BodyGeometry`,
sin R3F ni assets. Sirve para QA visual y para slides.

```bash
VIEW=front npx tsx packages/fit-engine/scripts/render-body-preview.ts
VIEW=three-quarter npx tsx packages/fit-engine/scripts/render-body-preview.ts
VIEW=side npx tsx packages/fit-engine/scripts/render-body-preview.ts
```

Genera `out/body-preview-<vista>.svg`. Para PNG:

```bash
python3 -c "import cairosvg; cairosvg.svg2png(url='packages/fit-engine/out/body-preview-front.svg', write_to='packages/fit-engine/out/body-preview-front.png', output_width=1650, output_height=1050)"
```

`out/` está en `.gitignore`: los SVG/PNG son artefactos de QA, no fuente.

### Prototipo integrado en el clon de Vinted (cuerpo + veredicto)

`demo/vinted-mock/viewer3d/` es la integración real dentro del clon. Carga una
base mesh CC0 (Innerscene / MakeHuman, 107k triángulos, 163 huesos) y la deforma
en runtime con los anillos de `buildBody()`:

- el cuerpo del anuncio conserva la anatomía de la malla y solo se escala en
  altura; al cambiar una medida, un preset o un slider se aplica la deformación
  por anillos: torso, piernas, hombro y brazos, con fade en la cadera;
- cabeza proyectada a un elipsoide liso (sin cara, pelo ni ojos); el suavizado
  laplaciano se limita al torso porque encogía brazos y piernas;
- normales transformadas por la inversa de la escala para conservar el
  sombreado suave (recalcular normales sobre las costuras UV sacaba una línea
  dura en el pecho);
- fusión del cuerpo con las primitivas de manos y pies; se descartan areolas,
  ojos, dientes, boca y cabeza `high-poly`. Los recortes del pecho se cierran
  con abanicos de triángulos y se aplana el relieve del pezón;
- maniquí liso: sin ropa interior, genitales, cara ni pelo;
- presets XS–Plus y sliders de 6 medidas dentro de **Ajustar mi cuerpo**; el
  veredicto se recalcula con cada cambio;
- tarjeta principal con solo veredicto + talla; holgura, zonas, confianza,
  medidas que faltan y fuente se trasladan al desplegable **Especificaciones**;
- `body-engine.js` es el bundle ESM de `src/body.ts`; se regenera con esbuild;
- el veredicto del viewer es un **fit-lite** local para la demo. El motor
  definitivo es `src/fit.ts` (Jaime). La prenda 3D de la demo vive en
  `demo/vinted-mock/viewer3d/garment-builder.js`.

La base mesh se eligió por licencia CC0, calidad anatómica y peso < 5 MB por
archivo. La deformación es aproximada: no es un avatar escaneado ni morph
targets pre-bakeados. Es un prototipo para validar cuerpo + veredicto, no la
sustitución de la pipeline procedural.

---

## 15. Decisiones abiertas para el lead

1. **Contrato:** ¿las medidas opcionales se quedan en `BodyProfile` o se añaden
   como opcionales a `Body` en `types.ts`? La opción segura es `BodyProfile`.
2. **Viewer:** ¿sustituimos `MOCK_TORSO_RINGS` por `buildBody().torso` en el
   vertical slice o solo en el stretch? El contrato es el mismo; el riesgo es
   de tiempo, no de tipos.
3. **Material:** recomendación de maniquí de estudio en arcilla mate, no piel.
   El realismo antropométrico ya se lee en la silueta; la piel añade uncanny.
4. **Malla base:** se ha integrado una base mesh CC0 en `viewer3d/` como
   prototipo de demo, con deformación runtime aproximada. No sustituye la
   pipeline procedural L1; sirve para validar cuerpo + veredicto. Para
   producción, pre-bake de morph targets o SMPL.
5. **LLM:** usarlo solo para rasgos y pregunta activa. El fallback determinista
   es obligatorio y ya está implementado.
