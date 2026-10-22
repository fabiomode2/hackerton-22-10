# outfit check — memoria del proyecto

**Probador 3D para moda de segunda mano.** Convierte las medidas que el vendedor ya publica en un maniquí con tu cuerpo y un veredicto de talla antes de comprar.

Hackathon · 22/10/2026 · 7 personas · 4 horas

> Documento de apoyo al jurado. Explica qué hace el producto, cómo se calcula el veredicto y qué parte del discurso está implementada, demostrada o es hoja de ruta. Las cifras y sus fuentes completas están en `docs/STATS.md`.

---

## 1. El problema

Vinted no cubre la devolución por ajuste: su política solo considera «significantly not as described» la talla incorrecta —cuando el vendedor etiquetó mal—, no el «no me queda». En segunda mano, el error de talla no cuesta un envío: cuesta la prenda.

El patrón es general. En moda online se devuelve el 25–30 % de los pedidos; entre el 53 % y el 67 % de esas devoluciones son por talla o ajuste. Procesar una devolución de apparel cuesta alrededor del 66 % del precio del artículo.

La consecuencia útil para el producto es esta: **el dato que resuelve el problema ya está en el anuncio**. El vendedor mide la prenda con cinta métrica y publica axila a axila, largo, cintura o tiro. Lo que nadie hace es convertir esos centímetros en geometría.

## 2. El producto

1. El comprador define su cuerpo una vez: altura, pecho, cintura, cadera, hombro y entrepierna. Puede afinar la forma con presets y sliders. El perfil se guarda en el dispositivo.
2. En la ficha del anuncio aparece **«Ver cómo te queda»**.
3. Se abre un panel con un maniquí abstracto —sin cara— y la prenda construida a partir de las medidas planas del listing.
4. El panel muestra el veredicto, la holgura crítica en centímetros, el desglose por zonas, la confianza del cálculo y las medidas que faltan.
5. Al cambiar de cuerpo o de talla, cambian la prenda, el mapa de tensión y el veredicto.

No hay fotos del comprador, ni cuenta, ni servidor. El cuerpo se queda en el navegador.

## 3. Cómo funciona

### 3.1 Una sola representación

Cuerpo y prenda son pilas de anillos horizontales. Cada anillo se define por altura, semiejes X/Z, centro y exponente de superelipse. El cuerpo sale de las circunferencias; la prenda sale de recortar la superficie del cuerpo, separarla con la holgura del listing y resolver la caída. Es la misma estructura de datos, y por eso la comparación es una resta y no una estimación.

### 3.2 Cuerpo

`buildBody()` convierte las seis medidas en un perfil antropométrico: priors por sexo y altura, landmarks (cadera, cintura, busto, hombro, rodilla, tobillo), torso de anillos, piernas y brazos como tubos, y validación geométrica. Si falta una medida, se infiere y se marca como inferida; si es implausible, se regulariza y se emite un aviso. Al final se reproyecta cada perímetro con una tolerancia de 0,5 cm: el cuerpo mide lo que dice que mide.

### 3.3 Prenda

`buildGarment()` no carga un modelo 3D. Recorta la malla del cuerpo en la zona de la prenda, aplica la holgura por zona según el tipo y el tejido, relaja la superficie con gravedad, restricciones de distancia y colisión, y añade remates: cuello, puños, bajo, cinturilla, cremallera, capucha y bolsillos. Los materiales PBR son locales, con recetas para algodón, felpa, denim, punto, lino y piel. La caída se calcula al abrir el probador y queda precalculada para que la órbita vaya fluida.

### 3.4 Veredicto

Para cada zona medida:

```
ease = contorno_prenda − contorno_cuerpo − 2π · grosor_tejido
```

Bandas de holgura por tipo de prenda, en centímetros de contorno:

| Prenda | Ajustado | Óptimo | Holgado |
|---|---:|---:|---:|
| Camiseta | −2 … +3 | +3 … +10 | +10 … +20 |
| Sudadera | +2 … +8 | +8 … +16 | +16 … +28 |
| Vestido | 0 … +4 | +4 … +10 | +10 … +20 |
| Chaqueta | +4 … +10 | +10 … +20 | +20 … +32 |
| Vaquero | −1 … +2 | +2 … +6 | +6 … +12 |
| Falda | 0 … +4 | +4 … +10 | +10 … +18 |

El veredicto global es el de la zona más crítica, la de menor holgura. La confianza combina cuántas zonas se pudieron medir, la calidad del perfil corporal y cuántas medidas traía el anuncio. La interfaz enseña siempre las medidas que faltan: no se rellena un hueco con una invención.

**No hay una IA decidiendo el veredicto.** Es una resta. Eso permite enseñar el número, explicar por qué y auditar el resultado.

## 4. Alcance de la entrega

| Capacidad | Estado | Cómo se comprueba |
|---|---|---|
| Cuerpo paramétrico desde 6 medidas, presets XS–Plus, sliders y guardado local | **REAL** | Visor, pestaña «Mi maniquí» |
| Prenda 3D para 6 tipos y 6 tejidos, generada desde medidas planas | **REAL** | Visor, 12 anuncios |
| Holgura por zona, veredicto, confianza y medidas que faltan | **REAL** | Panel «Especificaciones» |
| Mapa de tensión sobre la prenda | **REAL** | Botón «Ver mapa de tensión» |
| Ficha tipo Vinted con 12 anuncios, buscador, filtros y drawer | **REAL (mock local)** | `demo/vinted-mock/` |
| Integración nativa en Vinted o extensión de navegador | **ROADMAP** | — |
| Extracción de medidas desde fotos, OCR de cinta y orquestador LLM | **ROADMAP** | Diseño en `docs/pipeline.md` |
| Simulación textil completa, cuerpo desde foto y AR | **ROADMAP** | — |

La caída de la prenda es una relajación de malla, no una simulación textil de alta fidelidad. Es suficiente para decidir una talla y es honesto decirlo: el veredicto no depende de esa relajación, depende de los perímetros.

## 5. Lectura de la presentación

| Slide | Texto | Qué significa |
|---|---|---|
| Portada | «La talla, *antes* de comprar.» | El producto responde una pregunta de compra concreta; no es un catálogo ni un juego de moda. |
| Problema | «La talla M *no* es una talla.» | Una etiqueta no describe un cuerpo. El desajuste entre etiqueta y medidas es la causa principal de devolución en moda. |
| Demo | «Pruébatelo.» | Mismo anuncio, dos cuerpos, dos veredictos. La demo recorre ficha → panel → veredicto → cambio de cuerpo. |
| Coste | «Una devolución gratis *no es gratis*.» 25–35 € · 66 % | El coste lo paga alguien: logística, inspección y margen. En Vinted lo asume el comprador en forma de prenda que no puede devolver. |
| Escala | «No hacer nada *también cuesta*.» 750.000 € | Estimación: 100.000 pedidos × 25 % de devolución × 30 € por devolución. No es una previsión de ingresos; es el tamaño del problema en una marca mediana. |

Las cifras de coste proceden de Coresight/Optoro y Pitney Bowes. Los 25–35 € por devolución y los 750.000 € son estimaciones propias y así se etiquetan en la slide.

## 6. Escala y negocio

El coste marginal por listing tiende a cero: no hay modelado por prenda, no hay artistas 3D y no hay assets por anuncio. La geometría se calcula en el cliente. Un modelo 3D de prenda para e-commerce cuesta 100–500 USD y 2–5 días; un gemelo digital con patrón y simulación, 500–2.000+ USD y 1–3 semanas. Ese coste es el que hace inviable modelar 500 millones de listings C2C, y el que este enfoque elimina.

El modelo de negocio es SaaS para el marketplace —por sesión o por listing activo—, una función «Pro» para vendedores y licencia por catálogo para marcas. Para Vinted el retorno no es logístico: es menos disputas, menos soporte y más confianza. Para el comprador es una decisión mejor; para el planeta, un envío de ida y vuelta que no ocurre.

La competencia compite en imagen o en talla, pero necesita catálogo modelado, fotos de estudio o escaneo del cuerpo. Google y Zara dan imagen; Zalando y 3DLOOK dan talla con escaneo y catálogo propio. Ninguno convierte las medidas planas de un listing C2C en geometría. Ese es el hueco: cero assets, cero escaneo, un dato que ya existe.

## 7. Preguntas frecuentes del jurado

- **¿Esto no es solo un render bonito?** El color y el veredicto salen de la diferencia entre dos perímetros. Si el panel dice que aprieta 2 cm, aprieta 2 cm.
- **¿Cómo se consigue la geometría de la prenda sin modelo 3D?** De sus medidas planas. Se recorta la superficie del cuerpo, se separa con la holgura y se resuelve la caída. No hay Blender.
- **¿Y si el vendedor mide mal?** El motor devuelve `confidence` y lista las medidas que faltan. El veredicto usa solo las zonas medidas; el usuario ve cuánto nos fiamos del dato.
- **¿Por qué no usáis IA generativa?** Añade latencia, coste y opacidad, y no mejora el veredicto. El foso es la medida de la prenda, no el render.
- **¿Y la privacidad?** El cuerpo se calcula y se guarda en `localStorage`. No hay cuenta, backend ni red en tiempo de ejecución. No hay foto que borrar ni biometría que consentir.

## 8. Ejecución

Sin build, sin dependencias y sin red en tiempo de ejecución.

```bash
# Demo y visor
node demo/vinted-mock/serve.mjs 8080

# Deck y demo, desde la raíz del repo
python3 -m http.server 8080
```

- Demo: <http://localhost:8080/>
- Visor: <http://localhost:8080/viewer3d/?listing=carhartt-hoodie-m>
- Deck: <http://localhost:8080/deck/>
- Producción: <https://hack.cesura.duckdns.org/>

Ficha técnica: HTML, CSS y JavaScript sin bundler; Three.js r186 servido desde `vendor/`; base mesh CC0 de Innerscene/MakeHuman; texturas CC0 de Poly Haven; 12 anuncios y fotos locales. Todo el material pesa menos de 5 MB por archivo y funciona sin conexión.

---

Documentación de referencia: [`PLAN.md`](PLAN.md) · [`STATS.md`](STATS.md) · [`pitch.md`](pitch.md) · [`pipeline.md`](pipeline.md) · [`agent-notes/`](agent-notes/)
