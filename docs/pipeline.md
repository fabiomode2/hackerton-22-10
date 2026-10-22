# Pipeline inteligente: orquestador + herramientas deterministas

> Cómo combinar **fotos + medidas + texto** de un listing en un solo flujo, con un LLM orquestando a Jev y al motor.
> Regla que manda sobre todo lo demás: **el LLM decide y explica. Las herramientas miden. El motor decide si tiene sentido.**

---

## 1. Por qué no "el LLM hace todo"

El impulso natural es: *mando las fotos y las medidas a un LLM y que me devuelva la prenda*. Eso falla por tres motivos:

1. **Alucina números.** Un VLM generativo escribe `52 cm` con una seguridad perfecta aunque no haya forma de medirlo.
2. **No es reproducible.** La misma foto puede dar 52 o 54. En una demo en vivo, eso es una ruleta.
3. **No es auditable.** Si el jurado pregunta "¿por qué dice que aprieta?", "porque lo dijo el modelo" no es una respuesta.

Entonces el reparto es:

| Capa | Quién | Qué produce | ¿Puede equivocarse? |
|---|---|---|---|
| **Decisión** | LLM orquestador | Qué herramienta llamar y en qué orden | Sí, pero se puede *fallback* |
| **Hecho** | Jev, OCR, parser | Tipo, tejido, números, cajas | Poco, y con confianza |
| **Física** | `fit-engine` | Holgura, tensión, veredicto | No: es aritmética |
| **Lenguaje** | LLM explicador | Una frase para el usuario | Sí, pero no afecta al veredicto |

**El veredicto nunca depende de un LLM.** Eso es lo que hace la demo defendible.

---

## 2. El pipeline

```
                    ┌──────────────────────┐
   listing ────────►│ 0. NORMALIZAR        │  texto → candidatos a medida (regex)
   (fotos, texto,   │    (determinista)    │  fotos → índice
    medidas)        └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
   cuerpo ─────────►│ 1. ORQUESTADOR       │  LLM, salida JSON estricta
   (6 medidas)      │    "¿qué me falta?"  │  decide el plan de herramientas
                    └──────────┬───────────┘
                               │ Plan[]
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼──────┐     ┌─────────▼────────┐   ┌─────────▼────────┐
│ jev.classify │     │ jev.has_tape     │   │ ocr.tape         │
│ type/fabric  │     │ noul → bool      │   │ crop → números   │
└───────┬──────┘     └─────────┬────────┘   └─────────┬────────┘
        │  choice              │ noul/box            │ texto
        └──────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │ 2. FUSIONAR          │  precedencia por fuente
                    │    + detectar conflicto│  (determinista)
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ 3. VALIDAR (física)  │  rangos plausibles
                    │    ¿tiene sentido?   │  ──► si no: reparar (máx 2)
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ 4. MOTOR             │  buildGarment + computeFit
                    │    FitResult         │  (aritmética pura)
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ 5. EXPLICADOR        │  LLM: 1 frase + 1 pregunta
                    │    (lenguaje)        │  no puede cambiar el veredicto
                    └──────────┬───────────┘
                               │
                        UI + FitResult
```

**Cinco etapas, tres deterministas (0, 2, 3, 4) y dos con LLM (1, 5).** Los LLM están en los extremos: al principio para decidir, al final para traducir. Nunca en el medio, que es donde están los números.

---

## 3. Etapa 1: el orquestador

### Entrada (pequeña, barata)

```json
{
  "garment_type_hint": "jeans",
  "has_measurements": { "waist_cm": true, "inseam_cm": true, "rise_cm": false },
  "missing": ["rise_cm", "thigh_cm"],
  "photo_count": 3,
  "photo_flags": { "has_tape": "unknown", "is_flat_lay": "unknown" },
  "fabric_hint": "denim",
  "budget": { "max_tool_calls": 4, "max_ms": 2500 }
}
```

### Salida (JSON estricto, sin prosa)

```json
{
  "plan": [
    { "tool": "jev.classify", "args": { "images": [0, 1, 2] }, "why": "type y fabric desconocidos" },
    { "tool": "jev.has_tape", "args": { "image": 1 } },
    { "tool": "ocr.tape", "args": { "image": 1, "target": "rise_cm" }, "why": "falta el tiro" }
  ],
  "ask_user": null,
  "confidence_prior": 0.62
}
```

### Reglas que el orquestador debe respetar

- **Máximo 4 llamadas** y **2,5 s** de presupuesto. Si se pasa, se corta y se sigue con lo que haya.
- **No inventa medidas.** Si falta algo y no hay forma de obtenerlo, devuelve `ask_user`.
- **No llama a OCR si no hay cinta** (`has_tape` primero). Ahorra tiempo y falsos positivos.
- **Pide solo una cosa al usuario.** Una pregunta, no un formulario.
- **`why` obligatorio en cada paso.** Si no sabe explicar por qué, no lo hace.

### Prompt (base, ~120 tokens)

```
Eres el planificador de un probador virtual. Recibes lo que se sabe de un
listing y decides qué herramientas llamar. Reglas:
- Nunca inventes medidas. Si falta un dato y no hay fuente fiable, pide al usuario.
- Llama a jev.has_tape antes de ocr.tape.
- Máximo 4 herramientas. Si dudas, haz menos.
- Devuelve SOLO JSON válido con el esquema dado.
Herramientas: jev.classify, jev.has_tape, jev.locate_tape, ocr.tape, engine.infer.
```

`temperature: 0`, `max_tokens: 300`, JSON schema en modo estricto.

---

## 4. Etapa 2: fusión y precedencia

Cuando dos fuentes dan el mismo dato, **gana la más fiable**, y si discrepan se marca conflicto.

| Precedencia | Fuente | Peso | Nota |
|---|---|---|---|
| 1 | `seller_stated` | 1.00 | El vendedor lo escribió en el listing |
| 2 | `ocr_tape` | 0.85 | Lectura de la cinta en la foto |
| 3 | `calibrated_photo` | 0.80 | Foto con referencia de escala (ArUco, folio) |
| 4 | `inferred` | 0.45 | Derivado del tipo + tejido (ej. manga desde hombro) |
| 5 | `vlm_estimate` | 0.30 | Estimación visual. **Nunca se muestra como medida** |

### Conflictos

```
si |a − b| ≤ 2 cm      → media ponderada, sin aviso
si 2 < |a − b| ≤ 5 cm  → gana la de mayor peso, se marca "medida dudosa"
si |a − b| > 5 cm      → CONFLICTO DURO: se descarta la de menor peso,
                          se baja la confianza y se avisa en la UI
```

**Nunca se promedian dos medidas que discrepan mucho.** Promediar 42 y 52 da 47, que es falso en ambos casos.

---

## 5. Etapa 3: validación física

Antes de construir la prenda, cada medida pasa por los chequeos de `vinted-data.md`:

- `pit_to_pit × 2` entre 60 y 160 cm
- `waist × 2` entre 50 y 140 cm
- `length` coherente con el tipo (una camiseta no mide 20 ni 120 cm)
- `inseam + rise` coherente con la altura del cuerpo
- medidas que no existen para ese tipo (un vestido no tiene `inseam`)

Si falla → **el orquestador recibe el error y repara** (quita la medida, busca otra fuente o pregunta). Máximo 2 iteraciones. Si sigue fallando, se descarta y se sigue.

Esto es lo que hace que el sistema parezca "inteligente" sin que ningún modelo tenga que ser listo: **detecta que se ha equivocado y se corrige**.

---

## 6. Etapa 4: motor

`buildGarment()` + `computeFit()`. Aritmética pura, cero IA. Ver `AGENTS.md` para el contrato y `3d-procedural.md` para las bandas de holgura.

La salida (`FitResult`) es **la única fuente de verdad** del veredicto.

---

## 7. Etapa 5: el explicador

Aquí es donde un LLM sí aporta valor real y sin riesgo: convertir un `FitResult` en una frase humana y **una** pregunta útil.

**Entrada:**
```json
{ "verdict": "tight", "ease_cm": -1.4, "zone": "waist", "confidence": 0.58, "missing": ["rise_cm"] }
```

**Salida (ejemplos):**
> "Te queda bien de pecho y hombros, pero la cintura va 1,4 cm justa. Con la talla de arriba irías sobrado."

> "Puedo calcularlo, pero me falta el tiro. ¿Lo tienes a mano?"

**Regla:** el explicador **no puede cambiar** `verdict`, `ease_cm` ni `confidence`. Se valida contra el JSON original y, si los toca, se descarta la frase y se usa una plantilla.

**Y siempre hay plantilla.** Si el LLM falla o tarda, la frase sale de un `switch`. La demo no depende del modelo.

---

## 8. Confianza compuesta

```
coverage      = medidas_presentes / medidas_necesarias
source_quality = media de los pesos de las fuentes usadas
consistency    = 1.0 sin conflicto · 0.7 conflicto blando · 0.4 conflicto duro

confidence = 0.45·coverage + 0.35·source_quality + 0.20·consistency
```

| Rango | UI | Acción |
|---|---|---|
| ≥ 0,75 | "Cálculo fiable" | Veredicto normal |
| 0,50–0,75 | "Orientativo" | Mostrar qué falta |
| < 0,50 | "Faltan datos" | **Preguntar una medida** antes de dar veredicto |

Enseñar la confianza es una **feature**, no una disculpa. Un sistema que dice "no lo sé" es más creíble que uno que acierta por casualidad.

---

## 9. El fallback sin LLM (obligatorio)

Esto es lo que salva la demo. El orquestador tiene que ser **sustituible por 15 líneas de TypeScript**:

```ts
function planDeterministic(l: Listing): Plan {
  const need = REQUIRED[l.garment.type];
  const missing = need.filter((k) => l.garment.measurements[k] == null);
  const plan: Plan = [];

  if (!l.garment.fabric) plan.push({ tool: 'jev.classify', args: { images: ALL } });
  if (missing.length > 0 && l.photos.length > 0) plan.push({ tool: 'jev.has_tape', args: { image: 0 } });
  // el resultado de has_tape decide si se encola ocr.tape

  return plan;
}
```

**Regla:** si el LLM tarda más de 800 ms, devuelve algo que no valida, o falla la red → se usa esta función y nadie nota nada.

Y en el pitch se dice tal cual: *"el planificador es determinista por defecto; el LLM es una mejora, no un requisito"*. Eso es madurez de ingeniería, y los jurados técnicos lo valoran más que un chatbot.

---

## 10. Qué implementar en estas 4 horas

| Pieza | Tiempo | ¿Hacerlo? |
|---|---|---|
| `planDeterministic()` + tipos del `Plan` | 30 min | **Sí** — es el esqueleto y desbloquea todo |
| Fusión con precedencia + conflictos | 25 min | **Sí** — es lógica pura, testeable |
| Validación física (rangos) | 20 min | **Sí** — ya está medio escrito en `vinted-data.md` |
| Plantillas de explicación | 15 min | **Sí** |
| Orquestador LLM real | 45 min | Solo si el resto está cerrado |
| Jev / OCR en vivo | 1 h+ | **No.** Precalcular |
| Explicador LLM real | 30 min | **No.** Plantillas + un ejemplo grabado |

**Lo que se enseña en el escenario:** el pipeline completo con el plan determinista y los datos precalculados. El orquestador LLM, en una slide, con el JSON real de entrada y salida. Eso es honesto y se ve igual de potente.

---

## 11. Cómo contarlo en el pitch

**Frase clave:**

> "Un LLM no mide ropa. Un LLM **decide qué hacer** cuando falta un dato. Las medidas las lee una herramienta, la física la valida el motor, y el modelo solo traduce el resultado a una frase. Por eso el veredicto es siempre el mismo, aunque cambie el modelo."

Y el remate, señalando el diagrama:

> "Si mañana cambiamos Jev por otro, o el LLM por un árbol de decisión, **el veredicto no cambia**. Eso es lo que hace esto integrable en producción y no un juguete."

**Q&A anticipado:**

| Pregunta | Respuesta |
|---|---|
| ¿Y si el LLM se equivoca? | Se equivoca en el plan, no en el número. Y hay fallback determinista. |
| ¿Cuánto cuesta? | 3–4 llamadas cortas por listing. Jev a $0,042/1M. Céntimos por mil anuncios. |
| ¿Latencia? | Objetivo 2,5 s. Y en la demo, precalculado: 0 ms. |
| ¿Por qué no un solo modelo grande? | Porque no es auditable. Si aprieta 2 cm, queremos poder señalar la resta. |
| ¿Esto no es overengineering para 4 h? | El plan determinista son 30 líneas. El LLM es una capa opcional encima. |

---

## 12. Anti-patrones

- Meter el LLM entre la medida y el veredicto.
- Dejar que el explicador reescriba `verdict` o `ease_cm`.
- Promediar medidas que discrepan 10 cm.
- Llamar a OCR sin comprobar antes que hay cinta.
- Presentar una estimación visual como medida.
- Depender de la red en la demo.
- Un pipeline de 6 llamadas encadenadas: latencia y puntos de fallo se multiplican.
