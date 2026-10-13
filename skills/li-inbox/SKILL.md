---
name: li-inbox
description: >-
  Ordena la bandeja de LinkedIn: clasifica invitaciones y mensajes en
  oportunidades, reclutadores, pares, pedidos y spam, y redacta solo las
  respuestas que valen la pena. Usalo cuando el usuario dice "tengo la bandeja
  explotada", "ordená mis mensajes", "¿le contesto a esto?", pega una tanda de
  mensajes de LinkedIn o está tapado de invitaciones.
---

# li-inbox

La mayoría de las bandejas de LinkedIn son 80% ruido, y el costo de ese ruido
es que el 20% que importa queda sin respuesta una semana. Este skill los
separa y escribe solo lo que vale la pena.

## Entrada

El usuario pega los mensajes. Las capturas sirven. No entres a su cuenta ni
leas la bandeja con un navegador.

## Cinco categorías

| categoría | señal | acción |
| --- | --- | --- |
| **OPORTUNIDAD** | describe un problema que el usuario resuelve, o pregunta por trabajar juntos | responder hoy, completo |
| **RECLUTADOR** | un rol, una empresa, una banda salarial | responder si el rol es real, una línea si no |
| **PAR** | alguien del mismo campo con algo para decir | responder esta semana, con tono humano |
| **PEDIDO** | quiere consejo, tiempo, una presentación, un favor | responder si es barato y concreto, declinar limpio si no |
| **SPAM** | agencia, secuencia de prospección, cripto, "consulta rápida" sin consulta | archivar, sin respuesta |

Imprimí los conteos primero. Ver "3 oportunidades, 2 reclutadores, 41 spam" es
la mitad del valor.

## Detectar una secuencia

La prospección automática tiene forma: una invitación sin nada específico, un
mensaje que llega minutos después de aceptar, "una consulta rápida", "vi que
estás en {industria}", un link de agenda en el primer mensaje, y un
recordatorio exacto a los cuatro días. Cuando la veas, marcala como SPAM y
decí qué la delató.

**La señal nueva en español:** las secuencias traducidas o generadas mezclan
registros ("Hola, ¿cómo estás? Vi que tienes un equipo... ¿te parece si
agendamos?") o usan calcos ("aplicar a", "hacer sentido"). Si pasás el mensaje
por `/li-human` y salta "mezcla de registros" o tres o más marcas de manual en
un mensaje de cuatro líneas, casi seguro es una plantilla. El usuario no le
debe respuesta a un guion.

## Respuestas

- **OPORTUNIDAD**: respondé la pregunta del mensaje, completa, gratis. Si
  encaja, la oferta es una oración al final. Si no encaja, decilo y mandalo a
  algún lugar útil. Los dos resultados son buenos.
- **RECLUTADOR**: si el rol interesa de verdad, preguntá lo que el mensaje no
  dijo: banda de compensación (y en qué moneda, que en LatAm cambia todo),
  nivel, modalidad (remoto, híbrido, oficina) y país de contratación. Si no
  interesa, una línea: no estoy buscando, con gusto refiero a alguien, y que
  la referencia sea en serio.
- **PEDIDO**: si cuesta menos de diez minutos y es concreto, hacelo. Si es
  "¿te puedo robar un café para hacerte unas preguntas?", declinalo en una
  oración cálida y dale la única respuesta que le hubieras dado en el café. Es
  la versión amable, y también la más útil.
- **LOS NO** son cortos, cálidos y definitivos. Nada de "retomemos el año que
  viene" si no hay año que viene.

## Salida

Agrupado por categoría, conteos primero, borradores solo para lo que lleva
respuesta, todo humanizado con el registro del usuario. Después, la
compuerta: los manda él.

```
BANDEJA  ·  52 mensajes  ·  3 OPORTUNIDAD, 2 RECLUTADOR, 4 PAR, 2 PEDIDO, 41 SPAM

SPAM  (41) - archivar. 38 son la misma secuencia: invitación sin nada concreto,
"consulta rápida" a los 4 minutos de aceptar, link de agenda en el primer
mensaje. 11 mezclan "tú" y "vos" en el mismo mensaje.
```
