---
name: li-territorio
description: >-
  Define los dos o tres territorios de contenido del usuario (los temas por los
  que quiere ser conocido), su banco de tesis discutibles y su banco de
  pruebas, y chequea si un borrador cae dentro o fuera. Usalo cuando el
  usuario dice "¿de qué debería hablar?", "no sé cuál es mi nicho", "quiero
  posicionarme como referente en X", "¿esto está dentro de mi tema?", o
  antes del primer /li-plan.
---

# li-territorio

El ranking de LinkedIn ya no reparte posts solo por red de contactos: lee el
texto del post y el del perfil, y arma una idea de sobre qué sabe cada
persona. Las guías de 2025 y 2026 coinciden en una consecuencia práctica:
alrededor del 80% de lo que publicás debería caer en dos o tres temas, y el
perfil tiene que decir esos mismos temas. Publicar de todo le enseña al
sistema que no sos referente de nada.

Este skill no existía en el original. Es el paso cero: sin territorio, el
plan es una lista de ocurrencias.

## Entrada

Leé `~/.claude/linkedin/voice.md` y, si existen, `log.md` y el perfil que haya
pegado el usuario en `/li-profile`. Pedí lo que falte, en una sola pregunta:

1. Qué quiere que pase gracias a LinkedIn en los próximos 12 meses (un
   trabajo concreto, clientes de un tipo, alumnos, inversores, reputación en
   una comunidad).
2. Los temas sobre los que tiene experiencia propia demostrable: cosas que
   hizo, no que leyó.
3. Diez posts que le hubiera gustado escribir (de otros). Muestran el gusto
   mejor que cualquier respuesta.

## Cómo se arma un territorio

Un territorio es la intersección de tres cosas:

```
lo que el usuario hizo y puede probar
  ∩ lo que la audiencia que quiere necesita saber
  ∩ lo que el usuario cree y parte de esa audiencia no
```

Si falta la tercera, es un tema, no un territorio: vas a escribir lo mismo
que todos. Si falta la primera, es una aspiración: no tenés de dónde sacar
pruebas.

Nombrá cada territorio con las **palabras que usaría alguien para buscarlo**,
no con una etiqueta creativa. "Riesgo crediticio con machine learning en
LatAm" sirve. "Datos con alma" no lo busca nadie.

Para cada territorio, armá:

- **Palabras clave**: cinco a ocho términos, en los idiomas en que lo buscan
  (en tecnología, muchas veces en inglés aunque se publique en español).
- **Banco de tesis**: cinco posiciones discutibles que el usuario sostiene.
  Cada una tiene que poder perder seguidores. "La calidad de datos importa" no
  es una tesis. "El equipo de datos no debería reportar a tecnología" sí.
- **Banco de pruebas**: los números, casos e historias que el usuario puede
  firmar, con una marca de qué se puede publicar y qué es confidencial. Nunca
  completes este banco con datos inventados: si está flaco, decilo.
- **Lo que queda afuera**: temas cercanos que el usuario va a querer tocar y
  conviene no tocar (o tocar solo en el 20% restante).

## Salida

Escribí `~/.claude/linkedin/territorio.md`:

```
# Territorios

## 1. Riesgo crediticio con IA en LatAm
palabras: scoring, riesgo crediticio, machine learning, credit risk, drift, cobranzas
tesis:
  - Un modelo que el equipo de negocio no entiende vale cero, aunque tenga mejor AUC.
  - ...
pruebas (publicables):
  - {{caso con número, si el usuario lo dio}}
pruebas (confidenciales, no usar):
  - ...
afuera: cripto, trading

## 2. ...

## Mezcla
80% territorios 1 y 2, 20% libre (vida profesional, docencia, opiniones de industria).
```

Y recomendá el cambio mínimo en el perfil para que diga lo mismo (titular y
tres primeras aptitudes), o mandá a `/li-profile`.

## Modo chequeo

Con un borrador en la mano ("¿esto está dentro de mi tema?"), respondé en tres
líneas: qué territorio toca (o ninguno), qué palabras del territorio aparecen
en la primera línea y cuáles faltan, y si el post es parte del 80% o del 20%.
Sin sermón: publicar fuera de territorio es una decisión válida, siempre que
sea una decisión.

## Revisar cada trimestre

Con `/li-audit` a mano, mirá qué territorio rinde y cuál no. Un territorio que
después de tres meses no trae visitas al perfil ni conversaciones no está
funcionando para el objetivo, aunque traiga reacciones.
