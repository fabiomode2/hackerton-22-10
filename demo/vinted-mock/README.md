# Mock de listing (demo)

Página local con pinta de marketplace de segunda mano. Es contra lo que corre la demo: **sin red, sin scraping, sin depender de Vinted**.

## Arrancar

```bash
cd demo/vinted-mock
python3 -m http.server 8080
```

Abrir: http://localhost:8080

Para apuntar al viewer 3D:

```
http://localhost:8080/?viewer=http://localhost:5173
```

El viewer recibe `?listing=<id>&embed=1`. Si no está levantado, el panel sale vacío: **levanta el viewer antes de ensayar**.

## URLs útiles

| URL | Qué hace |
|---|---|
| `/` | Anuncio héroe (sudadera Carhartt) |
| `/?id=uniqlo-tee-m` | Camiseta (para el beat de "no cierra") |
| `/?id=levis-501-w32` | Vaquero (catálogo) |
| `/?viewer=http://localhost:5173` | Conecta el iframe al viewer |

Atajos: `f` abre el probador · `Esc` cierra.

## Fotos

`listings.json` apunta a `assets/<id>/0X.jpg`. Si el archivo no existe, la página muestra un placeholder con el nombre de la prenda: **se ve bien aunque no haya fotos todavía**.

Para meter las tuyas:

```
assets/
  carhartt-hoodie-m/01.jpg 02.jpg 03.jpg
  uniqlo-tee-m/01.jpg 02.jpg
```

Recomendado: 1200 px de ancho, JPG calidad 80 (~200 KB). Fotos propias, luz natural, prenda plana y cinta métrica visible en una de ellas.

**No commitees fotos de terceros.** Las capturas de Vinted van en `assets/vinted/`, que está en `.gitignore`.

## Qué es real y qué no

- Real: el layout, el botón, el panel, las medidas y el flujo.
- Mock: el catálogo (6 anuncios inventados a partir de listings reales).
- El veredicto **no** se calcula aquí: lo pinta el viewer con el motor de fit.

## Para la demo

1. Abrir el anuncio héroe.
2. Click en **Ver cómo te queda**.
3. Enseñar el veredicto y el mapa de calor.
4. Cambiar el cuerpo en el viewer (mismo anuncio, otro cuerpo).
5. Volver al listing y abrir `?id=uniqlo-tee-m` para enseñar un "no cierra".

Los otros 4 anuncios son la prueba de que el sistema es general, no un caso hardcodeado.
