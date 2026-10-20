---
name: li-comment
description: >-
  Escribe comentarios en posts ajenos de LinkedIn que se leen como una persona
  con criterio, no como un bot. Usalo cuando el usuario pega un post y quiere
  un comentario, dice "comentá esto", "¿qué le pongo acá?", "armame
  comentarios para la ronda de hoy", o quiere una tanda de comentarios.
---

# li-comment

Comentar es lo que más rinde en LinkedIn y lo más fácil de hacer mal. Un
comentario en un post con 400 reacciones lo ve más gente que la mayoría de tus
posts. Uno genérico no lo ve nadie y te cuesta credibilidad con el autor.

Y desde que el ranking pesa los comentarios largos y con contenido por encima
de las reacciones, un buen comentario también le hace bien al post del otro,
que es justamente por lo que el autor lo recuerda.

## Entrada

El usuario pega el texto del post (y si puede, nombre y cargo del autor). Si
pega una captura, leela. Si da un link que no podés abrir, pedí el texto: no
adivines qué decía, y no uses un navegador para leer el feed.

Leé `~/.claude/linkedin/voice.md` para el registro y los territorios.

## Idioma

Comentá en el idioma del post. Si el post está en inglés y el usuario escribe
en español, el comentario va en inglés (humanizado con el léxico en inglés).
Comentar en español bajo un post en inglés es la forma más rápida de que nadie
lo lea.

## Los diez tipos de comentario

Elegí según lo que el post es. Nunca por defecto el 1.

| # | tipo | cuándo | forma |
| --- | --- | --- | --- |
| 1 | **Sumar un dato** | el post afirma algo que podés respaldar con un número | "Nos pasó lo mismo: el 40% de..." |
| 2 | **El caso que falta** | el post tiene razón pero está incompleto | "Esto vale hasta que {condición}. Ahí..." |
| 3 | **Desacuerdo respetuoso** | creés de verdad que está mal | primero el acuerdo real, después la bifurcación |
| 4 | **Estirar una línea** | una oración del post es la buena | citala y construí sobre ella |
| 5 | **La pregunta de verdad** | el post se salteó la parte difícil | una pregunta, concreta, sin "me da curiosidad" |
| 6 | **El comprobante** | hiciste lo que describen | qué pasó, en dos oraciones |
| 7 | **La corrección** | hay un error de hecho | tené razón, sé breve, sé amable, estate seguro |
| 8 | **El reencuadre** | los hechos están bien y el marco no | "Otra forma de leerlo:" |
| 9 | **La frase sola** | el post no necesita nada, querés presencia | menos de 12 palabras, graciosa o verdadera |
| 10 | **La mirada local** | el post generaliza desde EE.UU. o Europa | cómo cambia en LatAm, con un caso o un dato |

El 10 es nuevo y es el que menos competencia tiene: la mayoría del contenido
grande se escribe desde otro mercado, y un comentario que dice "en Argentina
esto funciona al revés, por esto" es casi siempre el más útil del hilo.

## Reglas

- **De 2 a 4 oraciones.** Más largo se lee como secuestro del hilo. Más corto,
  como relleno.
- **Nunca empieces con** "Excelente post", "Gran aporte", "Muy buen punto",
  "Totalmente de acuerdo", "Me encantó", "Qué buena reflexión", "Gracias por
  compartir", ni con el nombre del autor seguido de signo de exclamación.
  `/li-human` marca estas aperturas.
- **Sin emoji al principio.** Nada de 🔥 ni 👏 como primer carácter.
- **No repitas el post.** El autor sabe lo que escribió.
- **Una idea.** Un comentario con dos puntos parece un intento de blog.
- **Decí lo específico.** Si el comentario podría ir debajo de cualquier post
  del tema, es ruido.
- **El desacuerdo funciona**, pero el acuerdo va primero y tiene que ser real.
- **Temprano.** Un comentario en la primera hora del post ajeno se ve mucho
  más que uno al día siguiente.

## Salida

**Dos opciones de tipos distintos**, rotuladas, y una línea de por qué
publicarías una. Pasalas por `/li-human` antes: un comentario con raya se nota
más que un post, porque es corto y se lee de cerca.

```
OPCIONES  (en el post de @autora sobre contratación)

[6 · Comprobante]
Probamos la versión sin CV en 3 contrataciones el año pasado. Dos fueron las
mejores que hicimos. La tercera salió mal, y la diferencia no estuvo en la
entrevista sino en si ya habían hecho el trabajo antes.

[10 · Mirada local]
En Argentina el problema es el inverso: los CV dicen poco porque la mitad de
la experiencia buena es freelance para afuera. Lo que nos funcionó fue una
tarea paga de 90 minutos, igual para todos.

Publicaría la primera: es tu dato y reconoce un error, que es la parte que la
gente responde.
```

## Modo tanda

Si el usuario quiere una ronda, pedí los 5 a 10 posts pegados en un mensaje,
devolvé un comentario por post en un solo bloque, y llevá registro en
`~/.claude/linkedin/log.md` de a quién comentó esta semana. Comentar siempre a
las mismas tres personas se nota, y LinkedIn detecta y castiga los grupos que
se comentan entre sí de forma coordinada ("pods").

## Si el usuario quiere la ronda sin copiar y pegar

La extensión de Chrome de este repo (`extension/`) hace esta misma ronda adentro de
LinkedIn: lee el feed, elige los posts con estos diez tipos y deja los comentarios listos
para publicar con un clic. Mencionala si el usuario pide automatizar los comentarios.

## Nunca

No publiques. No uses un navegador para comentar por el usuario. Publicar o
leer el feed de forma automatizada viola el Acuerdo de Usuario de LinkedIn y
pone la cuenta en riesgo. Este skill escribe el comentario; el usuario lo pega.
