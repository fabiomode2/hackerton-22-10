# Medidas por visión (Jev y similares)

> Documento de decisión. Responde a: ¿podemos sacar las medidas de la prenda (y del cuerpo) de las fotos?
> **Veredicto corto: sí para clasificar, no para medir en cm sin una referencia de escala, y no en 4 horas.**
> Leer esto antes de proponer una feature de visión en el hackathon.

---

## 1. Qué es Jev (y qué no)

**Jev** es el modelo "System One" de TypeSafe. No es un LLM: es un **modelo de decisión** que recibe un estado (texto, JSON y, desde el 14/10/2026, imágenes) y devuelve **respuestas tipadas**. No escribe prosa.

| Pregunta | Respuesta |
|---|---|
| ¿Acepta imágenes? | Sí desde **Jev 1.14** (14/10/2026). También 1.13. Es **experimental**. |
| ¿Hay que activar algo? | Sí: header `TypeSafe-Danger-Zone-Images: true`. |
| ¿Qué devuelve? | `choice` (elige de una lista), `noul` (probabilidad 0–1), `score` (nota en una escala), `box` (bounding box). |
| ¿Genera texto? | **No.** Y eso es una feature: no alucina. |
| Límites de imagen | PNG/JPEG, 256–1568 px por lado, 16 MiB por archivo, 32 MiB por request, hasta 4 imágenes. |
| Precio | **$0,042 / 1M tokens de entrada**. La salida es gratis. |
| Estado | "Dreamer-ready", **no producción**. El formato puede cambiar entre versiones. **Pinear la versión** (`jev-1.14.0`), no usar `jev-latest` (que apunta a 1.13). |
| Contexto | 64k por defecto, 262k opt-in (más lento y menos preciso). |

Endpoint: `https://api.typesafe.ai/v1/systemone`.

### Para qué sirve de verdad en nuestro caso

| Tarea | Tipo | ¿Sirve? |
|---|---|---|
| ¿Es camiseta, sudadera, vestido, vaquero o chaqueta? | `choice` | **Sí, y es exactamente lo que necesita el motor** |
| ¿El tejido parece punto, felpa, denim, lino o piel? | `choice` | **Sí** |
| ¿Hay una cinta métrica en la foto? | `noul` | **Sí** (y es la puerta a las medidas reales) |
| Localiza la cinta métrica | `box` | **Sí** → crop para OCR |
| ¿La prenda está plana y bien iluminada? | `score` | **Sí** (control de calidad del listing) |
| ¿Cuánto mide de axila a axila? | — | **No.** No devuelve números libres |

**Conclusión:** Jev es un **clasificador y un enrutador**, no un medidor. Vale oro para rellenar `garment.type` y `garment.fabric` automáticamente y para decidir si una foto merece OCR. No vale para leer "52 cm".

> Ojo con `box`: **siempre devuelve una caja, aunque el objeto no esté**. Hay que emparejarlo con un `noul` de presencia antes de usarlo.

---

## 2. El problema físico: sin escala no hay centímetros

Esto es lo que hay que entender antes de prometer nada.

Una foto es una proyección 2D. Para convertir píxeles a centímetros necesitas **una de estas tres cosas**:

1. **Un objeto de tamaño conocido** en la imagen (cinta métrica, folio A4, moneda, ArUco).
2. **Profundidad** (LiDAR, estereoscopía, depth estimation).
3. **Un prior** (sabes que es una talla M y ajustas).

Sin nada de eso, un VLM puede decirte "parece una M" y estará adivinando. **Un LLM mirando una foto no puede medir.**

### Precisión real publicada

| Método | Error | Fuente |
|---|---|---|
| Foto + LiDAR + keypoints (móvil) | **1,59–2,08%** relativo (~0,8–1,0 cm a 50 cm) | MDPI 2022 |
| Foto plana controlada + segmentación + keypoints | **0,75 cm** vestidos · **1,01 cm** faldas · **1,27 cm** blazers (MAE) | MDPI 2022 |
| Foto + marcador ArUco + red de corrección | **4,07%** relativo medio | FedCSIS 2022 |
| Foto única + Depth Anything V2 + keypoints | **5,08 cm** de error en cintura · **8,74 cm** en costado | Tesis ECU 2024 |
| Medida manual humana (referencia) | hasta **3,02 cm** de error | Literatura del sector |

**Tolerancia del sector: 1–2 cm.** Y ojo: la medición humana ya tiene ~3 cm de error. Eso significa dos cosas:

- **Buena noticia:** no hace falta precisión milimétrica; el listón es bajo.
- **Mala noticia:** si el vendedor mide mal, nuestro motor hereda el error y no hay forma de saberlo.

**Mercari ya construyó exactamente esto** (AR + keypoints de prenda) y necesitó **10.000 imágenes anotadas**. Es un proyecto de meses, no de una tarde.

---

## 3. El atajo que sí existe: la cinta métrica en la foto

En Vinted hay un patrón real y muy común: **el vendedor fotografía la prenda con la cinta métrica encima**. Es la forma en que la gente demuestra que la medida es verdad.

Eso convierte un problema imposible en un problema de **OCR**:

```
foto → ¿hay cinta? (Jev noul) → ¿dónde? (Jev box) → crop → OCR → número
     → validación física → medida con source='ocr_tape'
```

Ventajas:
- Da **números reales**, no estimaciones.
- Es barato y rápido.
- Es demostrable en 4 horas con datos precalculados.
- **Es un argumento de pitch brutal:** *"el vendedor ya fotografía la cinta métrica. Nosotros solo la leemos."*

Riesgos:
- La cinta no siempre se ve entera ni enfocada.
- Hay que saber **qué** se está midiendo (axila-axila vs largo) — eso lo dice la posición de la cinta y el tipo de prenda.
- El OCR de una cinta arrugada es frágil.

**Regla:** el OCR propone, **el motor valida**. Si el resultado no pasa los chequeos de plausibilidad (ver `vinted-data.md`: `pit_to_pit × 2` entre 60 y 160 cm, etc.), se descarta y se pide al usuario.

---

## 4. Medidas del cuerpo desde fotos

| Método | Precisión | Condiciones | ¿4 horas? |
|---|---|---|---|
| 2 fotos (frontal + perfil) + altura conocida + keypoints | **<3% y <1 pulgada** | Ropa ajustada, luz difusa, sin arrugas | No |
| 1 foto + altura + ratios antropométricos | ±5–8 cm | Muy sensible a pose y ropa | No |
| Escaneo LiDAR (iPhone Pro) | ~1 cm | Hardware concreto | No |
| Medidas a mano (lo que hacemos hoy) | ±3 cm | Cinta métrica, 2 minutos | **Sí, ya está** |

**Referencia:** "PS for You" (2021) reporta <3% y <1 pulgada con 2 fotos, y explícitamente dice que los peores casos son **ropa con arrugas y luz dura**. Es decir: funciona en condiciones de estudio, no en el dormitorio de cualquiera.

### El problema de privacidad (importante)

Enviar fotos del cuerpo a una API en la nube **rompe nuestra promesa de "todo on-device"**, que es uno de los argumentos del pitch. Si algún día se hace:

- Consentimiento explícito y borrado inmediato.
- O modelo local (Qwen-VL / InternVL en `llama.cpp`), que en un portátil va lento pero no sale de la máquina.
- O **nunca fotos**: solo medidas numéricas, que es lo que hacemos hoy.

**Decisión para el hackathon: no se toca.** Va al roadmap con esta nota.

---

## 5. Arquitectura recomendada (si se implementa)

```
┌─ listing ─────────────────────────────────────────────┐
│ fotos + texto                                         │
└───────────────┬───────────────────────────────────────┘
                │
        ┌───────▼────────┐
        │  Jev (visión)  │  choice: type, fabric
        │  noul/box/score│  noul: ¿cinta visible?
        └───────┬────────┘  box: crop de la cinta
                │
        ┌───────▼────────┐
        │  OCR (cinta)   │  → número en cm + confianza
        └───────┬────────┘
                │
        ┌───────▼────────────────┐
        │  Validador físico      │  rangos plausibles, coherencia
        │  (fit-engine)          │  entre medidas, tipo de prenda
        └───────┬────────────────┘
                │
        ┌───────▼────────────────┐
        │  Garment + confidence  │  source por medida
        └────────────────────────┘
```

**Tres capas, tres responsabilidades:**

1. **Jev** decide *qué es* (tipo, tejido, si hay cinta). Barato, determinista, no alucina.
2. **OCR** lee *cuánto*. Es donde está el número.
3. **El motor** decide *si el número tiene sentido*. Es la única fuente de verdad.

Nunca al revés. Un VLM "estimando" centímetros es un generador de números plausibles, no una medición.

### Contrato de datos (aditivo, no rompe nada)

```ts
type MeasurementSource = 'seller_stated' | 'ocr_tape' | 'calibrated_photo' | 'vlm_estimate';

type MeasuredValue = {
  value_cm: number;
  source: MeasurementSource;
  confidence: number; // 0–1
};

// Garment.measurements puede llevar, opcionalmente, la procedencia:
type Garment = {
  type: GarmentType;
  fabric: Fabric;
  measurements: GarmentMeasurements;
  sources?: Partial<Record<keyof GarmentMeasurements, MeasurementSource>>;
  extraction?: { model: string; at: string; warnings: string[] };
};
```

**Regla dura:** una medida estimada **nunca** se presenta como declarada. La UI muestra el origen y el `confidence` baja. Mezclar ambos sin avisar es mentir al usuario y al jurado.

---

## 6. Qué hacer en estas 4 horas

| Opción | Coste | Valor | ¿Hacerlo? |
|---|---|---|---|
| Clasificar `type` + `fabric` de los 6 listings **antes** de la demo y guardarlo en el JSON | 20 min | Alto (el motor necesita esos campos) | **Sí, si sobra tiempo** |
| Leer una cinta métrica de 1–2 fotos y mostrar "medida detectada" | 40 min | Muy alto para el pitch | **Solo precalculado** |
| Pipeline de visión en vivo durante la demo | 2 h+ | Riesgo alto, sin red | **No** |
| Medidas de cuerpo desde foto | 4 h+ | Ninguno para el MVP | **No** |
| Entrenar un modelo | — | — | **No** |

**Recomendación:** si se hace algo, que sea **precalculado y etiquetado como DEMO**. Se ejecuta el pipeline una vez, se guarda el JSON, y en el escenario se dice: *"esto lo hemos precalculado; en producción corre en el servidor del marketplace"*.

---

## 7. Cómo contarlo en el pitch

**No decir:** "usamos IA para medir la ropa desde una foto". Es falso, se cae en el Q&A.

**Decir:**

> "Hay dos caminos. El barato: el vendedor ya fotografía la cinta métrica — solo hay que leerla. El caro: reconstruir la prenda desde una foto, que necesita LiDAR o un modelo entrenado con miles de imágenes. Nosotros empezamos por el barato porque el dato ya está ahí. Y para lo que no está en el texto, un modelo de decisión como Jev nos dice el tipo y el tejido sin alucinar, porque no genera texto: elige entre opciones."

**Si preguntan por qué no usamos IA generativa:** *"Porque un modelo que escribe puede inventarse 52 cm. Uno que elige entre opciones, no. Y para un veredicto de talla, preferimos no inventar."*

Eso convierte una limitación en una decisión de ingeniería. Y es verdad.

---

## 8. Alternativas a Jev (y cuándo usar cada una)

| Modelo | Tipo | Fuerte | Débil |
|---|---|---|---|
| **Jev 1.14** | Decisión tipada | Determinista, baratísimo ($0,042/1M), rápido | No genera texto; experimental |
| **Gemini 2.5 Flash/Pro** | VLM generativo | OCR excelente, JSON schema, barato | Alucina números; hay que validar |
| **GPT-4o / GPT-5 visión** | VLM generativo | Muy bueno en lectura de texto | Coste y latencia |
| **Qwen2.5-VL / Qwen3-VL** | VLM open weights | Local, sin enviar fotos fuera | Requiere GPU decente |
| **InternVL3** | VLM open | Buen OCR, open | Pesado |
| **Florence-2** (Microsoft) | Visión especializada | Detección + OCR, muy pequeño | Menos "razonamiento" |
| **PaddleOCR / EasyOCR** | OCR clásico | Rápido, gratis, local | No entiende contexto |
| **MediaPipe BlazePose** | Pose | Keypoints de cuerpo en tiempo real, local | No da medidas absolutas |
| **Depth Anything V2** | Profundidad | Monocular, open | Error alto en tela |

**Para el hackathon:** nada de esto en runtime. Si acaso, `PaddleOCR` local para la cinta y Jev para clasificar, **precalculado**.

---

## 9. Errores que no se deben cometer

- Pedirle a un VLM "dame las medidas en cm" y creérselo. Inventará números con formato perfecto.
- Mezclar medidas declaradas por el vendedor con estimaciones sin marcar el origen.
- Prometer "medidas desde foto" en el escenario sin tenerlo.
- Meter una llamada a API en la demo en vivo (sin red, sin latencia controlada).
- Cambiar `jev-latest` por `jev-1.14.0` sin pinear y que el formato cambie el día del hackathon.
- Usar `box` sin `noul`: devuelve caja siempre, incluso cuando no hay nada.
- Ignorar el coste de privacidad de subir fotos de cuerpos reales.

---

## 10. Resumen para el equipo

1. **Jev sí acepta imágenes, pero no mide.** Clasifica y localiza. Útil para `type`/`fabric` y para decidir si hay cinta.
2. **Sin escala no hay centímetros.** Es física, no una limitación de modelo.
3. **La cinta métrica en la foto es el atajo real** y encaja perfecto con Vinted.
4. **Cuerpo desde foto: roadmap**, y con un problema de privacidad que hay que resolver antes.
5. **En 4 horas: nada de visión en vivo.** Si acaso, precalculado y etiquetado como DEMO.
