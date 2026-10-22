# Vinted data — de un listing al motor

## Qué medidas hay en un listing típico

Campos estructurados por categoría, más texto libre. Los que nos importan:

| Campo del listing | Tipo | Cómo se usa |
|---|---|---|
| axila–axila | plano, cm | `pit_to_pit_cm` → contorno de pecho = `× 2` |
| cintura | plano, cm | `waist_cm` → contorno = `× 2` |
| largo total | cm | altura del bajo sobre el cuerpo |
| hombro–hombro | cm | ancho de hombro de la prenda |
| largo de manga | cm | longitud del tubo |
| tiro | cm | altura de la cintura del pantalón |
| entrepierna | cm | del crotch al bajo |
| muslo | plano, cm | contorno = `× 2` |
| bajo de pierna | plano, cm | contorno = `× 2` |

## Reglas de interpretación (aquí es donde se gana o se pierde)

1. **Medida plana ≠ contorno.** Casi todo lo que el vendedor mide con la prenda estirada en la cama es plano. Se multiplica por 2. Si el vendedor ya da el contorno, detectarlo por el valor (un contorno de pecho de 52 cm es imposible; 52 plano = 104 de contorno).
2. **Prendas elásticas.** Punto y felpa estiran 4–8 cm de contorno. El denim rígido, casi nada. El motor debe usar la banda de holgura del tejido, no la genérica.
3. **Medidas que faltan.** Nunca inventarlas. `confidence` baja y se listan. Un veredicto con 2 de 6 medidas es orientativo y hay que decirlo.
4. **Medidas raras.** Si `pit_to_pit × 2 < 60` o `> 160`, es un error de dedo o una prenda infantil: marcar como no fiable, no renderizar una monstruosidad.
5. **Largo total vs. largo de prenda.** En un vestido, el largo se mide desde el hombro; en un pantalón, desde la cintura. El tipo de prenda decide el punto de anclaje.

## Mapeo al cuerpo

```
pecho_prenda  = 2 · pit_to_pit
cintura_prenda = 2 · waist
holgura_pecho = pecho_prenda − bust_cm − 2π·grosor
holgura_cintura = cintura_prenda − waist_cm − 2π·grosor
y_bajo = y_hombro − length_cm
y_cintura_pantalon = y_suelo + inseam_cm + rise_cm
```

## Bandas de holgura (cm de contorno)

| Prenda | Ajustado | Óptimo | Holgado |
|---|---|---|---|
| Camiseta | −2…+3 | +3…+10 | +10…+20 |
| Sudadera | +2…+8 | +8…+16 | +16…+28 |
| Vestido | 0…+4 | +4…+10 | +10…+20 |
| Chaqueta | +4…+10 | +10…+20 | +20…+32 |
| Vaquero rígido | −1…+2 | +2…+6 | +6…+12 |
| Vaquero elástico | −2…+1 | +1…+5 | +5…+10 |
| Falda | 0…+4 | +4…+10 | +10…+18 |

## Ejemplo canónico para la demo

Listing: **Levi's 501, W32 L32, 25 €**
- cintura plana 41 cm → contorno 82
- entrepierna 80, tiro 28, muslo 31 plano → 62
- Cuerpo A: 175 cm, cintura 78, cadera 96, entrepierna 80 → holgura cintura +4 → **óptimo**, veredicto `regular`.
- Cuerpo B: 168 cm, cintura 90, cadera 104, entrepierna 76 → holgura cintura −8 → **no cierra**, veredicto `too_small`.

Ese contraste es la demo. Ensayarlo hasta que salga en 15 segundos.

## Anti-patrones

- No scrapear Vinted en vivo durante la demo.
- No usar fotos de listings reales sin permiso en el deck; usar fotos propias o capturas con atribución.
- No prometer lectura automática de la descripción por NLP: en la demo, las medidas vienen del JSON del mock.
- **No presentar una medida estimada como declarada.** Cada medida lleva `source`; ver `docs/pipeline.md` §4 y `docs/vision-extraction.md`.
- **No promediar medidas que discrepan más de 5 cm.** Es un conflicto, no un promedio.
