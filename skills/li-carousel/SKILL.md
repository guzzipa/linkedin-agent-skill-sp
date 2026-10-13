---
name: li-carousel
description: >-
  Arma un post de documento (carrusel) para LinkedIn: el texto slide por
  slide, la portada que gana el deslizar, y el PDF para subir. Usalo cuando el
  usuario dice "carrusel", "post de documento", "slides para LinkedIn",
  "pasá esto a carrusel", o tiene una idea con forma de lista que como texto
  se moriría.
---

# li-carousel

Los posts de documento son el formato de más tiempo de permanencia en
LinkedIn, porque cada deslizar cuenta y un scroll no. Las mediciones que
circulan en 2025 y 2026 los ponen arriba en tasa de interacción frente a texto
e imagen. El formato premia una idea partida en pasos y castiga un post de
texto cortado en pedazos.

## Cuándo usarlo en vez de un post de texto

Cuando la idea tiene **secuencia**: pasos, una cuenta regresiva, un antes y
después progresivo, un marco con partes. Si la idea es una sola afirmación,
va en texto. Partir una afirmación en ocho slides es la forma más común en que
fallan los carruseles; si eso es lo que tiene el usuario, decilo y mandalo a
`/li-post`.

## Estructura

De 8 a 12 slides. Menos de 8 es un post de texto. Más de 12 y la tasa de
llegada al final se cae.

```
1        PORTADA       el gancho, 6 palabras o menos, más una línea de promesa
2        LO QUE ESTÁ EN JUEGO  por qué importa, en una oración
3-N      UNA IDEA POR SLIDE. Un título de 3 a 7 palabras y como mucho 30
                       palabras abajo. Si necesita un párrafo, son dos slides.
N+1      RESUMEN       todo como lista, para que la captura sirva sola
ÚLTIMA   CIERRE        una acción. Seguir, comentar algo concreto, o el link. Una.
```

**En español, el texto crece entre un 15% y un 25% respecto del inglés.** Si
la plantilla de diseño se pensó en inglés, el cuerpo de 25 palabras pasa a 30
y no entra. Ajustá el tamaño de letra o cortá contenido, nunca bajes de 28 px.

## Reglas de texto

- **La portada es el 80% del resultado.** Seis palabras. Grande. El resto del
  carrusel no salva una portada que nadie desliza.
- **Mayúscula solo al principio.** "Cómo armar un equipo de datos", no
  "Cómo Armar Un Equipo De Datos". Las mayúsculas de título son un calco del
  inglés y `/li-human` las marca.
- **Numerá cada slide** (3/10). Se termina más cuando se ve el final.
- **Ningún slide es un párrafo.** Si no entra en 30 palabras, partilo.
- **El slide de resumen es el que se captura.** Que se sostenga solo.
- **Tu nombre de usuario en cada slide**, chico, en una esquina. Las capturas
  viajan sin vos.
- **Un slide con un dato propio de la región**, si lo hay. Es lo que menos se
  ve en carruseles en español y lo que más se guarda.

## Hacer el PDF

LinkedIn pide PDF, 1080x1350 (4:5) para ocupar más lugar en el feed, menos
de 100 MB, menos de 300 páginas. Armalo en HTML e imprimilo a PDF:

```bash
# una página por slide, 1080x1350, sin márgenes
# después: Chrome headless --print-to-pdf, o el conversor que tengas
```

Escribí el HTML con un `<section>` por slide, `width:1080px; height:1350px;
page-break-after:always`, un solo color de acento y letra de 28 px o más:
se leen en el celular, en miniatura. Usá `lang="es"` en el HTML para que el
corte de palabras con guion sea correcto. Si el usuario tiene un sistema de
diseño o una marca en el proyecto, usalo y no inventes paleta.

## Salida

Primero el texto slide por slide, como lista numerada que se lee en diez
segundos. Después el **texto del post** que lo acompaña: un carrusel igual
necesita dos o tres líneas arriba, que son el gancho real en el feed. Pasá
las dos cosas por `/li-human`. El PDF se arma solo si el usuario aprueba el
texto.

No se sube nada a LinkedIn. El PDF lo publica el usuario.
