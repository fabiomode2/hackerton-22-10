# Demo script — operativa

## Antes de presentar (checklist de 5 min)

- [ ] Demo servida en local, **sin red**: `cd demo/vinted-mock && python3 -m http.server 8080`.
- [ ] Viewer levantado y conectado: `http://localhost:8080/?viewer=http://localhost:5173`.
- [ ] Pestañas preabiertas: (1) home, (2) listing héroe, (3) panel ya cargado una vez para calentar caché, (4) vídeo de respaldo.
- [ ] Zoom del navegador al 110%, ventana 1440×900, barra de marcadores oculta.
- [ ] Notificaciones del sistema en modo "no molestar".
- [ ] Cursor grande activado.
- [ ] Segundo portátil con el MP4 listo.
- [ ] Cronómetro visible solo para el presentador.

## Secuencia (90 s)

| t | Acción | Riesgo | Plan B |
|---|---|---|---|
| 0:00 | Home llena, scroll lento por los 12 anuncios | — | — |
| 0:08 | Click en el anuncio con badge **Prueba 3D** | — | Deep link: `/?id=carhartt-hoodie-m` |
| 0:14 | Ficha: precio, medidas, vendedor | — | — |
| 0:20 | Click "Ver cómo te queda" (CTA fijo abajo) | El panel tarda | Ya precalentado; si tarda > 2 s, seguir hablando |
| 0:26 | Panel con el cuerpo A | Cámara mal encuadrada | Reset de cámara con tecla `R` |
| 0:38 | Órbita suave 90° | Mareo | Solo 45° |
| 0:48 | Activar heatmap | Colores lavados | Dejar el toggle ya activo |
| 0:58 | Leer veredicto | — | — |
| 1:08 | Cambiar a cuerpo B | El selector falla | Atajo `1` / `2` para cambiar de perfil |
| 1:16 | Señalar la cintura en rojo | — | — |
| 1:24 | Cerrar panel y volver al feed | Escape dentro del iframe no llega | Usar la X del header |
| 1:30 | Abrir otro anuncio (`uniqlo-tee-m`) | — | Cortar a vídeo |

## Reglas

- **Nunca** escribir en un input durante la demo. Todo con botones y atajos.
- Nada de scroll fino con trackpad. Usar `Space` / `PageDown`.
- Si algo falla: una frase, sin disculpas largas, y al MP4.
- El presentador de la demo no mira la pantalla mientras habla: mira al jurado en los beats clave.

## Frases de la demo

- "Esto es Vinted. Un feed normal."
- "Este es un anuncio normal de Vinted."
- "Un click."
- "Este soy yo."
- "La prenda no está modelada: está calculada a partir de las medidas del anuncio."
- "Verde: bien. Ámbar: justo. Rojo: no cierra."
- "Mismo anuncio. Otro cuerpo. Otra respuesta."
- "Y lo sé antes de pagar."
