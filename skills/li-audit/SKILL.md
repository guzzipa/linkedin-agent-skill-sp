---
name: li-audit
description: >-
  Post mortem de lo que el usuario ya publicó: qué posts funcionaron, por qué,
  y qué dejar de hacer. Usalo cuando el usuario pega su analytics de LinkedIn o
  posts anteriores y pregunta "¿qué está funcionando?", "¿por qué no anduvo
  este?", "leé mis métricas", "auditá mi contenido", o quiere saber en qué
  redoblar.
---

# li-audit

La única fuente honesta de qué funciona para una cuenta es esa cuenta. Toda
regla de toda guía de LinkedIn, incluidas las de este paquete, es un supuesto
previo. Los últimos 30 posts del usuario son la evidencia.

## Entrada

Pedí lo que el usuario tenga:

- El export de analytics de LinkedIn (Analytics -> Contenido -> Exportar), en
  Excel o CSV. Si viene como archivo, procesalo con código, no a ojo.
- O una captura por post con impresiones, miembros alcanzados, reacciones,
  comentarios, compartidos, guardados y envíos.
- O solo los posts y sus reacciones, que alcanza para una primera pasada.

Leé también `~/.claude/linkedin/log.md` si existe: registra gancho, territorio
y si hubo kit de primera hora en cada post.

## Qué medir de verdad

Las impresiones crudas son el número menos útil de la página, porque dependen
sobre todo de cuánta gente ya te sigue. Calculá esto, y mostrá la cuenta:

| métrica | cómo | qué te dice |
| --- | --- | --- |
| **Tasa de interacción** | (reacciones + comentarios + compartidos) / impresiones | si el post se ganó el alcance que tuvo |
| **Proporción de comentarios** | comentarios / reacciones | si abrió una conversación o solo un gesto |
| **Múltiplo de alcance** | miembros alcanzados / seguidores | si salió de la audiencia propia |
| **Tasa de guardado y envío** | (guardados + envíos) / miembros alcanzados | la señal de utilidad más fuerte; LinkedIn la muestra desde septiembre de 2025 |
| **Conversión a perfil** | visitas al perfil o seguidores ganados desde el post | si el post trabaja para el objetivo del usuario, no solo para el feed |

Ordená por tasa de interacción y múltiplo de alcance, no por impresiones. Un
post con 900 impresiones y 40 comentarios le ganó al de 12.000 y 6.

La conversión a perfil es la que más importa si el usuario busca trabajo o
clientes. Un post viral que no trae visitas al perfil entretuvo, no vendió.

## Después, buscar el patrón

Con los 5 mejores y los 5 peores lado a lado, buscá qué los separa de verdad,
y estate dispuesto a concluir algo que al usuario no le guste:

- **Territorio.** ¿Los mejores caen dentro de los territorios de
  `territorio.md`? Si los posts fuera de tema rinden peor, es la evidencia de
  que la coherencia temática importa para esta cuenta.
- **Gancho.** ¿Qué números de `hooks.json` están entre los 5 mejores?
- **Formato.** Texto, documento, imagen, video.
- **Largo.**
- **Idioma**, si el usuario publica en español y en inglés.
- **Primera hora.** Posts donde el usuario respondió dentro de la hora contra
  los que no.
- **Día y hora**, **al final**, y solo si lo demás no muestra nada. Casi nunca
  es la causa, y es donde todos quieren que esté.

Enunciá cada hallazgo como afirmación con la evidencia al lado, y decí cuánta
confianza le tenés. Con 30 posts se puede ver un patrón; con 6 no, y tenés que
decir eso en vez de inventar uno.

## Salida

```
AUDITORÍA  ·  31 posts  ·  12 jun - 5 sep

5 MEJORES POR TASA DE INTERACCIÓN
  8,1%  #3  Confesión      "USD 18.000 es lo que me costó no firmar"  1.940 imp  · 9 guardados
  6,4%  #22 Postmortem     "Incidente: el modelo aprobó 300..."       2.210 imp  · 31 guardados
  ...

5 PEORES
  0,4%  #5  Lista          "7 herramientas que todo founder necesita" 11.400 imp
  ...

QUÉ DICEN LOS DATOS
1. Los posts donde quedaste mal: 6,2% de promedio contra 1,1% del resto. n=6.
   Es tu señal más fuerte y no está cerca.
2. Las listas de herramientas traen impresiones y nada más: sin comentarios,
   sin visitas al perfil. Tres de tus cinco peores.
3. Los 4 posts fuera de tus territorios promedian la mitad de alcance. n=4,
   confianza media.
4. El día de la semana no muestra nada. Martes y viernes están dentro del ruido.

DEJÁ: las listas de herramientas.
HACÉ MÁS: los que tienen un costo que pagaste y un número.
```

Después pasale las conclusiones a `/li-plan`, para que el plan de la semana
se arme con la evidencia del usuario y no con supuestos.
