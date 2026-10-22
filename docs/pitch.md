# Pitch — Segunda Piel

Duración objetivo: **5:00**. Versión corta: **3:00** (marcada con ⚡).

## Ledger de claims (actualizar antes de cada ensayo)

| Claim | Estado | Dónde se ve |
|---|---|---|
| El cuerpo se genera desde 6 medidas | REAL | Demo, sliders |
| La prenda se genera desde las medidas del listing | REAL | Demo |
| Mapa de tensión y veredicto con números | REAL | Demo |
| Materiales por tejido | REAL | Demo (si da tiempo) |
| Funciona dentro de una página tipo Vinted | DEMO | Mock local + extensión |
| Integración nativa en Vinted | ROADMAP | Slide |
| Cuerpo desde fotos | ROADMAP | Slide |
| Simulación de tela real | ROADMAP | Slide |
| AR en el móvil | ROADMAP | Slide |

> Si un claim no está en esta tabla, no se dice en el escenario.

---

## Guion

### Slide 1 — Cold open (0:00–0:20)

**Visual:** footage vertical de alguien fotografiando una prenda en casa para venderla. Sonido ambiente. Sin música.
**Texto en pantalla:** `22 fotos. 4 medidas. Y aún así, no sabes cómo te queda.`
**Narración:** *(silencio)*

⚡ En la versión de 3 min: 10 s.

---

### Slide 2 — El problema (0:20–0:50)

**Visual:** captura de la política de Vinted con la frase subrayada. Al lado, un gráfico simple: 19,3% devoluciones online; 53–67% por talla.
**Narración:**
> "Vinted es honesto: si la prenda no te queda, no hay devolución. No es un bug, es su política. Y en moda, entre el 53 y el 67% de las devoluciones son exactamente eso: talla. En segunda mano, el error no cuesta un envío. Cuesta la prenda entera."

**Pie de slide:** NRF/Happy Returns 2025 · Coresight · Rithum · Vinted Help.

---

### Slide 3 — El insight (0:50–1:20)

**Visual:** el listing real con las medidas resaltadas con un recuadro. Una flecha las lleva a un cuerpo 3D. Transición limpia.
**Narración:**
> "Y aquí está lo raro: el dato para resolverlo ya está en el anuncio. El vendedor ya midió la prenda. Lo que nadie hace es convertir esos centímetros en geometría. Eso es lo que hacemos nosotros."

---

### Slide 4 — El producto (1:20–1:40)

**Visual:** tres pantallas: *tu cuerpo* · *la prenda puesta* · *el veredicto*.
**Narración:**
> "Una vez defines tu cuerpo con seis medidas. En cada anuncio, un botón. Y ves la prenda sobre ti, con su tejido, su caída y un mapa de dónde aprieta y dónde sobra."

---

### Slide 5 — Demo en vivo (1:40–3:10)

Guion exacto en `PLAN.md` §13. **No improvisar.** Dos cuerpos, un listing, dos veredictos.

Frase de salida obligatoria:
> "Mismo anuncio. Otro cuerpo. Otra respuesta."

---

### Slide 6 — Cómo funciona (3:10–3:40)

**Visual:** un solo diagrama:
`medidas del listing → cuerpo paramétrico + prenda procedural → holgura por zona → tensión → veredicto`
**Narración:**
> "No hay una IA adivinando. Hay geometría. Cuerpo y prenda son la misma estructura: secciones horizontales. La diferencia entre las dos es la holgura. Si la holgura es negativa, no cierra. Eso es todo. Y por eso podemos enseñar por qué."

**Frase clave:** *"Es explicable. Para una tienda, eso es auditable."*

---

### Slide 7 — Por qué escala (3:40–4:10)

**Visual:** cifra gigante `0` artistas 3D + 2×2 de competencia.
**Narración:**
> "Zeekit, Doppl, 3DLOOK: todos necesitan fotos de catálogo o un modelo 3D del producto. Funcionan para Zara. No funcionan para 500 millones de anuncios de personas vendiendo su ropa en su dormitorio. Nosotros no modelamos la prenda: la calculamos a partir de una cinta métrica. Ese es el foso."

---

### Slide 8 — Negocio e impacto (4:10–4:40)

**Visual:** una cuenta simple. `25% devoluciones · 100.000 pedidos · 10% evitadas · ~30 €/devolución`.
**Narración:**
> "Para una marca, cada devolución de moda cuesta hasta dos tercios del precio del artículo. Para Vinted el ahorro es otro: menos disputas, menos soporte, más confianza. Y cada devolución que no ocurre es un envío de ida y vuelta que no existe. El cuerpo se queda en el dispositivo: no subimos fotos ni medidas."

---

### Slide 9 — Roadmap y cierre (4:40–5:00)

**Visual:** tres pasos: `foto → cuerpo` · `tela real` · `AR`. Luego, logo y una línea.
**Narración:**
> "Hoy: seis medidas y una cinta. Después: una foto, simulación de tela y AR. Pero el problema se resuelve hoy con lo que Vinted ya tiene."
>
> **"Vinted ya tiene las medidas. Tú ya tienes el cuerpo. Solo falta el espejo."**

---

## Q&A preparado

| Pregunta | Respuesta (30 s) |
|---|---|
| ¿Esto no es solo un render bonito? | Enseñar la fórmula y el mapa de tensión. "El color es la diferencia entre dos radios. Si te digo que aprieta 2 cm, es que aprieta 2 cm." |
| ¿Cómo conseguís la geometría de la prenda sin modelo 3D? | De sus medidas planas. Anillos horizontales con holgura y un tubo para la manga. Sin Blender. |
| ¿Y si el vendedor mide mal? | El motor devuelve `confidence` y lista las medidas que faltan. El usuario ve cuánto nos fiamos del dato. |
| ¿Por qué Vinted os dejaría? | Empezamos con extensión: cero integración, cero riesgo. Luego SDK de una línea. Luego nativo. |
| ¿No es caro de escalar? | WebGL en el cliente, sin assets, sin artistas. El coste marginal por listing tiende a 0. |
| ¿Y la privacidad del cuerpo? | Todo on-device. Sin cuenta, sin fotos, sin tracking. |
| ¿Esto no lo hace ya Zara, Zalando o ChatGPT? | Zara y ChatGPT dan look, no talla; Zalando da talla pero exige escaneo y catálogo propio. Ninguno usa las medidas planas de un listing C2C. Google declara que su try-on no garantiza el ajuste. |
| ¿Por qué no usáis IA generativa? | Añade latencia, coste y opacidad, y no mejora el veredicto. El foso es la medida de la prenda, no el render. |
| ¿Cuánto reducís las devoluciones? | No damos un % propio. El dato más citado es el claim de Zalando: un 8% menos de devoluciones por talla en 2025 (hasta 40% en los artículos probados en el piloto). Nuestro cálculo va etiquetado como estimación. |
| ¿No es mejor una foto real de alguien con la prenda? | Para C2C no existe: el vendedor no tiene la prenda en tu talla. Y una foto de otra persona no te dice cómo te queda a ti. |
| ¿Qué pasa con cuerpos diversos? | Es el punto: el maniquí es tuyo, no un ideal. Sin cara, sin juicio estético. Sliders para altura, cadera, pecho, cintura, hombro. |

---

## Notas de puesta en escena

- **No leer las slides.** El deck es apoyo, no guion.
- La demo empieza con la página de Vinted, nunca con la app.
- Un solo presentador para la demo. Otro para la narrativa. No alternar cada frase.
- El cierre se dice mirando al jurado, sin click.
- Si algo falla: "esto es lo que pasa cuando lo haces en cuatro horas" + cortar al vídeo. Humor, no pánico.
- Cronómetro visible para el presentador, no para el público.
