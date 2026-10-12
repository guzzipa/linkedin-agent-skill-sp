---
name: li-lectores
description: >-
  Pre mortem de un post antes de publicarlo: un panel de cinco lectores
  simulados (comprador o reclutador, par experto, escéptico, contacto de
  segundo grado y la parte aludida) dice dónde deja de leer, qué se lleva, qué
  comentaría y cómo podría malinterpretarse. Usalo cuando el usuario dice
  "¿esto está bien para publicar?", "¿cómo lo van a leer?", "revisalo antes de
  subirlo", o el post es de alto riesgo (anuncio laboral, opinión polémica,
  algo sobre el empleador o un cliente).
---

# li-lectores

El humanizador te dice si el texto suena a máquina. No te dice si a alguien
le importa, ni si te puede traer un problema. Este skill hace la segunda
revisión: lee el borrador como lo leerían cinco personas concretas de la
audiencia del usuario.

Es una simulación, no un dato. Sirve para encontrar lo obvio que el autor no
ve (la frase que se puede sacar de contexto, el párrafo donde todos dejan de
leer, la objeción que va a aparecer en el comentario dos). No reemplaza a
`/li-audit`, que mira lo que pasó de verdad.

## Entrada

El borrador, ya humanizado. Leé `voice.md` (audiencia, registro) y
`territorio.md`.

## El panel

Armá los cinco lectores a partir de la audiencia real del usuario, con
nombre de rol, país y lo que le importa. Por defecto:

1. **El que decide**: quien podría contratar o comprar. Ejemplo: directora de
   riesgo de un banco mediano en Colombia.
2. **El par experto**: alguien que sabe tanto como el usuario del tema. Va a
   detectar cualquier exageración técnica.
3. **El escéptico**: alguien que está en desacuerdo con la tesis por razones
   razonables, no un troll.
4. **El de segundo grado**: alguien fuera del nicho a quien le llega porque un
   contacto reaccionó. Prueba si el post se entiende sin contexto.
5. **La parte aludida**: el empleador, el ex empleador, el cliente, el equipo,
   o la persona de la historia. Si el post no alude a nadie, reemplazalo por
   **el que hace la captura**: alguien que lee solo una frase fuera de
   contexto y la reenvía.

## Qué responde cada lector

Para cada uno, en dos o tres líneas:

- **¿Pasa de la línea 1?** Sí o no, y por qué, con sus palabras.
- **¿Dónde deja de leer?** El párrafo concreto.
- **¿Qué se lleva?** Lo guarda, se lo manda a alguien (a quién), o nada.
- **El comentario que escribiría**, textual, en su registro.
- **El riesgo**: cómo podría leerlo mal, o qué le molestaría.

## Después, el veredicto

```
PANEL  ·  "Incidente: el modelo aprobó 300 créditos..."

1 DECIDE (directora de riesgo, CO)   pasa la línea 1 · lee hasta el final · lo reenvía a su equipo de modelos
  comentaría: "¿Cada cuánto corren el chequeo de drift? Nosotros mensual y no alcanza."
2 PAR (head de ML, AR)                pasa · deja en "Causa raíz" · nada
  comentaría: "El AUC nunca fue la métrica para esto. Me sorprende que no tuvieran PSI."
  riesgo: suena a que el equipo no sabía lo básico
3 ESCÉPTICO                           ...
4 SEGUNDO GRADO                       no pasa la línea 1: "drift" no le dice nada
5 PARTE ALUDIDA (ex empleador)        riesgo alto: USD 41.000 en mora es un dato interno identificable

ARREGLOS, EN ORDEN
1. Sacar el monto exacto o pedir aprobación: es identificable. (bloqueante)
2. Agregar una línea que conceda que el PSI existía y no se miraba, para el par experto.
3. Línea 1 sin jerga: "aprobó créditos que no debía" antes que "drift".

PARA EL KIT DE LA PRIMERA HORA
- Respuesta preparada a la pregunta de frecuencia (lector 1).
- Respuesta preparada a la crítica del PSI (lector 2).
```

## La prueba de la firma

Al final, una pregunta más: **¿podría firmar este post otra persona del mismo
rubro sin cambiar nada?** Si sí, no está listo, aunque el humanizador dé PASA.
Señalá qué falta: un número propio, una escena, una postura que le cueste
algo.

## Reglas

- No inventes reacciones elogiosas para tranquilizar. Si el post es flojo,
  el panel lo dice.
- Los comentarios simulados van en el registro de cada lector (un lector
  mexicano no vosea).
- Los riesgos de confidencialidad o reputación van primero y se marcan como
  bloqueantes. Lo demás es opinión del panel; decide el usuario.
- Pasá las objeciones del panel al kit de la primera hora de `/li-post`.
