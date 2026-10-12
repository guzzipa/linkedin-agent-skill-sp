---
name: li-reply
description: >-
  Maneja las respuestas debajo de los posts propios: borradores para cada
  comentario, ordenados por cuáles vale la pena contestar. Usalo cuando el
  usuario pega los comentarios de su post, dice "respondé estos", "ayudame con
  los comentarios", "alguien me dijo X en el post", o está lidiando con un
  crítico o un potencial cliente en los comentarios.
---

# li-reply

El hilo de respuestas debajo de tu post es donde se decide el alcance. Cada
respuesta es otra interacción sobre el post, y la primera hora hace casi todo
el trabajo. Pero no todos los comentarios valen lo mismo, así que este skill
ordena antes de escribir.

## Entrada

El usuario pega los comentarios, idealmente con nombre y cargo. Las capturas
sirven. No leas el hilo con un navegador.

Si `li-post` dejó un **kit de la primera hora** para este post en
`~/.claude/linkedin/log.md`, leelo: las respuestas preparadas para las
objeciones previstas son el punto de partida, ajustadas a cómo las formuló la
persona.

## Primero, clasificar

Ordená cada comentario en una de cinco categorías y decí el conteo:

| categoría | qué es | qué recibe |
| --- | --- | --- |
| **OPORTUNIDAD** | alguien que describe el problema que el usuario resuelve | una respuesta de verdad + una puerta abierta suave |
| **SUSTANCIA** | suma datos, discrepa, extiende | la respuesta más larga del hilo |
| **PAR** | un nombre con el que conviene que te vean | una respuesta que le da algo |
| **APOYO** | "excelente post", 🔥, una etiqueta | un me gusta y, como mucho, 3 a 8 palabras |
| **RUIDO** | venta, spam, mala fe | nada, o una línea y afuera |

Escribí en ese orden, y pará cuando se termina el valor.

## Cómo responder

- **Contestá la pregunta.** Si alguien pregunta cómo, decile cómo, ahí. No lo
  mandes a un mensaje privado para darle lo que podía tener en público.
- **Su nombre una vez**, al principio, y nunca con signo de exclamación.
- **Igualá el largo.** Un comentario de dos líneas no recibe seis.
- **Mismo registro que el post.** Si el post vosea, las respuestas también.
  Si quien comenta escribe de usted y es mayor o de otro país, se puede
  responder de usted sin romper la voz.
- **A un crítico:** concedé la parte cierta primero, con sus palabras, y
  después sostené lo que creés. Nunca borres, nunca te pongas a la defensiva,
  nunca respondas dos veces en el mismo hilo.
- **A una oportunidad:** respondé completo en público. La puerta abierta es
  una oración al final, y es una oferta de ayuda, no un pitch. El valor en
  público es lo que hace que el próximo te escriba.
- **A un pitch en tus comentarios:** ignoralo. Responder le da alcance.
- **Hacé preguntas de vuelta a los comentarios de sustancia.** Un hilo de tres
  respuestas entre dos personas vale más que tres comentarios sueltos.

## Salida

Un bloque, agrupado por categoría, cada respuesta lista para pegar y
humanizada con `/li-human`:

```
RESPUESTAS  ·  17 comentarios  ·  1 OPORTUNIDAD, 3 SUSTANCIA, 4 PAR, 8 APOYO, 1 RUIDO

OPORTUNIDAD
@Sara Chen - "tenemos el mismo problema con las propuestas"
> Sara, lo que nos lo resolvió fue sacar la tabla de precios del documento y
> mandarla como página aparte. Nos ahorró una ronda entera de revisión. Si te
> sirve, te paso la plantilla.

SUSTANCIA
@Marcos Weber - discrepa con la frecuencia
> Es justo, y 4 por semana me funcionó porque tenía 8 meses de posts atrás.
> Arrancando de cero haría lo que decís. ¿Vos cuánto tardaste en ver tracción?

APOYO  (dales me gusta; respondé a los tres primeros)
@... "Muy bueno" -> Gracias, Dani.

RUIDO  (1)
Salteado: un pitch de agencia. Responder le da alcance.
```

Después, la compuerta: **nada se publica hasta que el usuario dice sí.** Las
respuestas las pega él.
