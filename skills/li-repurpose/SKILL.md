---
name: li-repurpose
description: >-
  Convierte una pieza larga (video de YouTube, podcast, newsletter, artículo,
  transcripción, charla o clase) en una semana de posts de LinkedIn. Usalo
  cuando el usuario dice "reciclá esto", "sacá posts de acá", "tengo un
  video/newsletter/transcripción", o pega contenido largo y lo quiere en
  LinkedIn.
---

# li-repurpose

Una buena pieza larga tiene adentro entre cuatro y seis posts. La mayoría saca
uno y tira el resto.

## Entrada

Una transcripción, un artículo, un newsletter, un guion, el resumen de una
llamada, las notas de una clase. Si el usuario da un link de YouTube y hay una
herramienta de transcripción en la sesión, usala; si no, pedile que pegue el
texto. Leé todo antes de extraer nada.

**Si la fuente es de otra persona** (una charla de un tercero, el canal de
otro), los posts tienen que ser la lectura del usuario sobre esa fuente, con
crédito explícito, no un resumen que se haga pasar por propio. Y no
reproduzcas párrafos: parafraseá y citá como mucho una frase corta.

**Si la fuente está en inglés** y los posts van en español, no traduzcas:
extraé la idea y escribila desde la experiencia del usuario. Un post que se
nota traducido tiene todos los calcos que `/li-human` marca.

## Extraer, no resumir

El resumen de un video no es un post. Nadie quiere el resumen. Recorré la
pieza y sacá lo que se sostiene solo:

| qué | qué es |
| --- | --- |
| **Afirmaciones** | toda oración que empezaría una discusión |
| **Números** | toda cifra, costo, duración, porcentaje |
| **Historias** | todo momento con una persona, una escena y un costo |
| **Mecanismos** | toda explicación de "funciona así" |
| **Errores** | toda admisión de algo que salió mal |
| **Frases** | toda oración que ya se puede citar tal cual |
| **Preguntas del público** | si es una charla o clase, lo que preguntó la gente: son ganchos probados |

Listá lo que encontraste, con conteos, antes de escribir. Si salen menos de
cuatro cosas, la pieza es flaca, y cuatro posts exprimidos de ahí van a ser
flacos también. Decilo.

## Después, armar la semana

Cada extracto es un post, y cada post tiene que sostenerse completamente
solo: el lector no vio el video y no lo va a ver. Nunca escribas "como conté
en mi último video". El post es la cosa.

Asigná una fórmula de `li-post/hooks.json` a cada uno, y variá: cinco posts de
una misma fuente con la misma forma de gancho parecen una fábrica de
contenido. Si uno de los extractos funciona mejor como lista con pasos,
marcalo para `/li-carousel`.

Ordenalos en la semana para que la afirmación más fuerte vaya primero, la
historia a mitad de semana y el mecanismo al final, cuando la gente a la que
le gustaron los primeros lo está esperando.

## Salida

```
FUENTE: "Por qué dejamos las llamadas de descubrimiento" (18 min, 3.400 palabras)

ENCONTRADO  4 afirmaciones, 6 números, 2 historias, 3 mecanismos, 1 error, 5 frases

SEMANA
MAR  #1  Contracorriente  Las llamadas de descubrimiento son el impuesto de una web floja
MIÉ  #17 Ancla de tiempo  Recuperamos 6 horas por semana borrando un link de agenda
JUE  #9  Arranque en frío "¿Hacemos una llamadita rápida?"
VIE  #21 Valor directo    El formulario de 4 preguntas que reemplazó la llamada (carrusel)

Decí "escribí el martes" y lo redacto.
```

Después redactá a pedido, de a uno, cada uno por `/li-post` y `/li-human`. No
largues cuatro posts terminados juntos: van a sonar iguales y el usuario no
va a editar ninguno.
