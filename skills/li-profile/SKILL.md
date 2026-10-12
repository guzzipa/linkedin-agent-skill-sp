---
name: li-profile
description: >-
  Puntúa un perfil de LinkedIn sobre 100 con una rúbrica de 13 partes y
  reescribe lo que pierde puntos: titular, Acerca de, experiencia, destacados,
  portada, y el perfil en un segundo idioma. Usalo cuando el usuario dice
  "optimizá mi perfil", "puntuá mi LinkedIn", "reescribí mi titular",
  "arreglá mi Acerca de", o pega su perfil y pregunta cómo se lee.
---

# li-profile

Un perfil no es un CV. El CV responde "¿qué hiciste?". El perfil responde
"¿le escribo a esta persona?", y lo responde en unos cuatro segundos, con el
titular y las dos primeras líneas del Acerca de.

Hay una segunda razón para cuidarlo: el ranking del feed lee el perfil como
texto para decidir si quien publica sabe del tema. Si el perfil dice
"Gerente de Operaciones" y los posts hablan de IA generativa, el algoritmo no
conecta las dos cosas.

## Entrada

Pedí que el usuario pegue: titular, Acerca de, rol actual y las dos últimas
experiencias, aptitudes principales, y si tiene portada y destacados. Una
captura de la tarjeta superior alcanza para la primera pasada. No entres a
LinkedIn por el usuario.

Leé `~/.claude/linkedin/voice.md` y `territorio.md` si existen.

## Puntuar

Leé `rubric.json` en esta carpeta. Trece ítems, 100 puntos, cada uno con cómo
se ve el puntaje completo. Puntuá todo, mostrá la tabla y el total. Con
honestidad: la mayoría de los perfiles quedan entre 30 y 45 en la primera
pasada, y un puntaje generoso no sirve.

```
PUNTAJE DEL PERFIL  41/100

  titular               3/12   solo el cargo, sin resultado, sin audiencia
  acerca de: apertura   2/10   empieza con "apasionado por"
  acerca de: cuerpo     4/8    historia, no oferta
  coherencia temática   2/7    el titular habla de operaciones; los posts, de IA
  destacados            0/8    vacío
  portada               0/5    el degradado azul por defecto
  ...
```

## Después, reescribir en este orden

De mayor a menor según los puntos perdidos. No reescribas todo junto: el
usuario tiene que pegar cada cosa.

**1. Titular (220 caracteres).** La fórmula que funciona:
`{qué hacés y para quién} | {prueba} | {cómo empezar}`. No el cargo solo. No
"Ayudando a X a lograr Y" como primeras palabras, que es como arranca uno de
cada dos perfiles. Incluí las palabras de los territorios como las buscaría
alguien (en el idioma en que te buscan). Dá tres opciones.

**2. Acerca de, dos primeras líneas.** Todo lo que sigue queda detrás de "ver
más" en el celular, así que esas dos líneas son el Acerca de para casi todos.
Tienen que decir a quién ayudás y qué cambia. Sin "apasionado", sin
"orientado a resultados", sin biografía en tercera persona, sin empezar con tu
nombre.

**3. Acerca de, cuerpo.** A un lector, en segunda persona, en el registro del
usuario. Estructura: el problema que tiene, qué hacés con eso, una prueba con
número, qué hacer después. Menos de 1.600 caracteres aunque el límite sea
2.600.

**4. Coherencia temática.** Revisá que titular, Acerca de, el rol actual y las
tres primeras aptitudes nombren los mismos territorios. Si no, proponé el
cambio mínimo para alinearlos.

**5. Destacados.** Tres ítems: el mejor post, la pieza de prueba y la forma de
contacto. Un destacado vacío son ocho puntos, y es el único lugar del perfil
que controlás por completo.

**6. Experiencia.** Cada rol: una línea de alcance y dos o tres viñetas de
resultados con números, no tareas. Lo de más de diez años, a una línea.

**7. Portada.** Una oración de posicionamiento y una forma de contacto.

**8. El perfil en un segundo idioma.** LinkedIn permite tener el perfil en más
de un idioma, y cada persona ve el que coincide con su configuración. Casi
nadie en LatAm lo usa. Si el usuario quiere ser visible para reclutadores o
clientes de afuera, ofrecé la versión en inglés de titular y Acerca de, y que
sea una transcreación (con `/li-bilingue`), no una traducción literal.

## Salida

La tabla de puntaje, después las reescrituras como bloques listos para pegar,
en orden de lo que más suma, cada una pasada por `/li-human`. Al final,
volvé a puntuar y mostrá la diferencia con honestidad: si la reescritura llega
a 86 y no a 98, decí 86, y decí qué necesitan los puntos que faltan (casi
siempre recomendaciones, una portada real e historial de publicaciones, que
una reescritura no puede crear).

Este skill no guarda nada en LinkedIn. El usuario pega cada sección.

**Si el usuario está buscando trabajo**, recordale el ajuste de "Open to Work"
(visible solo para reclutadores o para todos) y que el rol actual no quede
vacío: un hueco sin explicar en el perfil se lee peor que un "Asesor
independiente" con dos resultados concretos.
