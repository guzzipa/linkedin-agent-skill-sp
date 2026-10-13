---
name: li-plan
description: >-
  Arma la semana en LinkedIn: qué publicar, cuándo, y con quién interactuar.
  Usalo cuando el usuario dice "planificá mi semana", "¿qué publico?",
  "calendario de contenido", "no tengo de qué hablar", o quiere un calendario
  de publicación y una lista de interacción.
---

# li-plan

La sala de control. El resto del paquete ejecuta; esto decide qué se ejecuta.
Correlo una vez por semana, el mismo día.

## Entrada

Leé `~/.claude/linkedin/voice.md`, `territorio.md` y `log.md` si existen: el
plan no debería repetir un ángulo de las últimas dos semanas, y todo tiene
que caer dentro de los territorios. Si no existen, pedí cuatro cosas y
anotalas:

1. Qué vende el usuario (servicio, producto, o a sí mismo si busca trabajo) y
   a quién.
2. Los dos o tres temas por los que quiere ser conocido. Si no los tiene
   claros, corré `/li-territorio` primero.
3. Qué pasó de verdad esta semana: una reunión con un cliente, un número, un
   error, algo que construyó, una discusión. De ahí salen los posts.
4. Diez a veinte personas o empresas con las que conviene ser visible.

## Qué publicar

Tres o cuatro posts por semana le ganan a siete. La constancia es un piso, no
una meta, y el quinto post de la semana casi siempre es el flojo que baja el
promedio.

Mezclá a lo largo de la semana, nunca dos del mismo tipo seguidos:

| tipo | frecuencia | trabajo que hace |
| --- | --- | --- |
| **Prueba** | 1 por semana | algo que pasó, con un número |
| **Opinión** | 1 por semana | una postura que te puede costar seguidores |
| **Enseñanza** | 1 por semana | algo que el lector puede hacer hoy |
| **Historia** | 1 cada dos semanas | una escena con diálogo y un costo |
| **Oferta** | 1 cada dos semanas | lo que vendés, dicho sin vueltas, sin pedir perdón |
| **Seguimiento** | cuando toque | volver a una predicción con vencimiento (#23) o a un post viejo que cambiaste de opinión (#25) |

El **seguimiento** es nuevo y casi nadie lo hace: revisá `log.md` buscando
predicciones con fecha que vencen este mes. Volver a una apuesta, acertada o
no, es de los posts que más credibilidad construyen.

Para cada lugar: el territorio, el ángulo concreto sacado de lo que pasó esta
semana, y el número de fórmula de `li-post/hooks.json`. No un tema: un ángulo.
"IA" no es un plan. "El modelo que apagamos porque cobranzas no entendía el
número" es un post.

## Cuándo publicar

Publicá cuando la audiencia está frente a la computadora. Las referencias que
circulan (Sprout Social y otros) ubican lo mejor para B2B de martes a jueves,
a media mañana y primera hora de la tarde, en la zona horaria de la audiencia;
lunes temprano y fines de semana rinden menos.

**Para LatAm hay que hacer la cuenta de verdad**, que casi ninguna guía hace:

- Buenos Aires y São Paulo (UTC-3), Santiago (UTC-4/-3), Bogotá y Lima
  (UTC-5), Ciudad de México (UTC-6), Madrid (UTC+1/+2). Un post a las 8:00 de
  Buenos Aires sale a las 5:00 en México.
- Si la audiencia es regional, una ventana de 9:30 a 11:00 en Buenos Aires cae
  entre las 6:30 y las 9:00 del resto. Si es mayormente México, publicá desde
  Argentina a media mañana de allá (mediodía o primera tarde en Buenos Aires).
- El almuerzo en buena parte de LatAm es entre las 13 y las 15, y se scrollea.
- Anclá siempre a la zona de la audiencia, no a la del usuario.

Pero decilo claro: **el día y la hora importan mucho menos que la primera
línea.** Si el usuario optimiza horarios antes de que sus ganchos funcionen,
está puliendo lo que no es, y hay que decírselo. Después de 4 a 6 semanas,
`/li-audit` dice cuál es su horario con sus datos.

## Con quién interactuar

Una lista de 10, en tres grupos:

- **5 de alcance**: gente con la audiencia que el usuario quiere, a cuyos
  posts puede sumar de verdad. Comentá antes de que tengan 20 comentarios o no
  te ve nadie.
- **3 pares**: mismo nivel, mismo campo. Es el grupo que devuelve.
- **2 compradores**: gente que podría contratar o comprar. Comentá sus posts
  durante semanas antes de cualquier mensaje, y nunca hagas pitch en un
  comentario.

Rotá la lista cada semana. Interactuar siempre con las mismas personas a la
misma hora es exactamente lo que LinkedIn busca para detectar pods.

20 minutos por día, antes de publicar, no después.

## Salida

```
SEMANA DEL 13 DE OCTUBRE  ·  audiencia: AR + MX + CO  ·  horas de Buenos Aires

LUN  solo interacción  (20 min, lista abajo)
MAR  10:15  PRUEBA       #22 Postmortem       - el modelo que aprobó lo que no debía
MIÉ  solo interacción
JUE  10:00  OPINIÓN      #1  Contracorriente  - por qué el equipo de datos no debería reportar al CFO
VIE  10:30  ENSEÑANZA    #21 Valor directo    - la checklist de drift, completa en el post
DOM  -
SEGUIMIENTO  vence el 31/10 la predicción del 12/04 sobre agentes en banca. Agendado para la semana que viene.

INTERACCIÓN  (5 alcance / 3 pares / 2 compradores)
  ...

Decí "escribí el martes" y lo redacto.
```

Escribí el plan en `~/.claude/linkedin/plan.md` para que los otros skills lo
lean. No se agenda ni se publica nada: es un plan, y lo corre el usuario.
