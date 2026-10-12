---
name: li-post
description: >-
  Escribe un post de LinkedIn en español (o inglés) a partir de una idea cruda,
  con 27 fórmulas de gancho, en la voz y el registro del usuario (voseo, tuteo
  o usted), humanizado y con el kit de la primera hora. Usalo cuando el usuario
  quiera un post, un gancho, "escribime un post sobre X", "pasá esto a un post
  de LinkedIn" o pida opciones de apertura. Da tres ganchos, un borrador
  completo y un bloque listo para copiar que nunca se publica sin un sí.
---

# li-post

Convierte una idea en un post que suena a la persona que lo firma.

## Antes de escribir

1. **Leé `~/.claude/linkedin/voice.md`.** Es el perfil de voz: cómo habla,
   qué nunca dice, para quién escribe, su **registro** (voseo, tuteo, usted) y
   sus **territorios**. Si no existe, pedí tres posts propios, inferí la voz,
   escribí el archivo y mostráselo. No inventes una voz: un post en la voz
   equivocada es peor que ningún post.
2. **Leé `hooks.json`** en esta carpeta: 27 fórmulas con plantilla, ejemplo,
   para qué sirve y cómo se arruina. Los ejemplos son ilustrativos, nunca datos
   del usuario.
3. **Chequeá el territorio.** Si `~/.claude/linkedin/territorio.md` existe, la
   idea tiene que caer en uno de sus territorios. Si cae afuera, decilo en una
   línea: un post fuera de tema le enseña al algoritmo que el usuario habla de
   cualquier cosa. Se puede publicar igual; que sea una decisión, no un
   accidente.
4. **Si la idea es flaca** ("un post sobre IA"), no la rellenes. Hacé una sola
   pregunta agrupada: qué pasó, a quién, y cuánto costó o rindió. Un post
   necesita una cosa concreta y verdadera.

## La forma

LinkedIn premia el tiempo de lectura, los comentarios con sustancia, los
guardados y los envíos por mensaje. El formato que sirve a eso:

```
Línea 1    el gancho, sola. Tiene que sobrevivir el corte de ~140 caracteres en
           el celular, y en español eso es menos texto del que parece.
           Nombrá el tema con palabras del territorio del usuario.
Línea 2    el pago de la línea 1, no la preparación de la línea 3.
Cuerpo     párrafos de 1 a 3 líneas, con blanco entre cada uno. Variá: si cada
           párrafo es una frase suelta, es broetry y cansa.
El giro    una línea que reencuadra lo anterior.
Cierre     una pregunta específica, o una instrucción. Nunca las dos.
```

**Largo:** 1.000 a 1.600 caracteres es el rango de trabajo en español (el
español ocupa más que el inglés). Menos de 450 se lee como un pensamiento
suelto. Más de 2.200 tiene que ganarse cada línea.

**Guardable o reenviable.** Antes de cerrar el borrador, preguntate qué se
lleva el lector: un número que va a citar, una lista que va a querer tener, o
una persona concreta a la que se lo va a mandar. Si no hay nada de eso, el post
es opinión sin utilidad; puede estar bien, pero sabelo.

## El ciclo

**1. Tres ganchos, no uno.** Pasá la idea por `hooks.json` y elegí las tres
fórmulas que encajan de verdad. Fórmulas distintas, no tres variaciones de la
misma. Mostralas numeradas y decí cuál publicarías y por qué, en una oración.

**2. Borrador completo** con el gancho más fuerte.

**3. Humanizalo** con `/li-human`, usando el registro de `voice.md`. Todo post
de este skill sale humanizado. Reescribí vos lo que el informe marca.

**4. Si el post es de alto riesgo** (anuncio de trabajo, opinión polémica,
algo sobre el empleador o un cliente), pasalo por `/li-lectores` antes de
mostrarlo.

**5. Imprimí el bloque**, listo para pegar, en un bloque de código. Abajo:

```
POST LISTO
gancho:      #22 Postmortem público
largo:       1.340 caracteres
territorio:  riesgo crediticio con IA
humanizador: 4 artefactos sacados, puntaje 86 PASA (registro: voseo)
publicar:    martes 8:15 (hora de tu audiencia, desde tu plan)

KIT DE LA PRIMERA HORA
primer comentario:  el link al template (los links van acá, no en el post)
objeción probable:  "eso solo pasa en fintech grande"
  respuesta lista:  "Nos pasó con 40 personas en el equipo. ..."
objeción probable:  ...
  respuesta lista:  ...
bloqueá 60 minutos después de publicar para responder.

Respondé "sí" para registrarlo, o decime qué cambiar.
```

El **kit de la primera hora** es el agregado de esta versión: la primera hora
decide hasta dónde viaja el post, y la gente no responde bien en caliente.
Anticipá dos objeciones o preguntas reales que va a generar el post y dejá las
respuestas escritas (humanizadas también). Si el post necesita un link, va en
el primer comentario.

**6. Nunca publiques.** Este skill produce texto; el usuario lo publica. Con
un "sí", agregá el post a `~/.claude/linkedin/log.md` con fecha, gancho,
territorio y primera línea, para que `/li-audit` tenga historia.

## Reglas que hacen la diferencia

- **Una idea por post.** Si el borrador tiene dos, son dos posts. Decilo.
- **Números antes que adjetivos.** Si el usuario no dio un número, pedíselo en
  vez de escribir alrededor del hueco.
- **Nada de cebo.** "¿Qué opinan?", "¿Coincidís?" y "Comentá GUÍA" están
  muertos. La pregunta del cierre tiene que ser una que solo este post podría
  hacer.
- **Cero a dos hashtags**, al final, y solo si son categorías que alguien
  sigue. LinkedIn dijo que ranquea por temas y palabras, no por hashtags.
- **Sin links en el cuerpo.** Al primer comentario, y avisalo en el bloque.
  LinkedIn mismo recomienda que el post se sostenga sin el link.
- **Registro coherente.** Si el usuario vosea, el post vosea de punta a punta,
  incluidas las preguntas. Mezclar "tenés" con "tienes" es la marca más
  visible de un texto generado.
- **Nunca inventes.** Ninguna métrica, cliente, facturación ni resultado bajo
  el nombre del usuario, ni siquiera de relleno. Si falta un número, dejá
  `{{tu número}}` en el borrador y marcalo.
- **Confidencialidad.** Si el post menciona al empleador actual o anterior, a
  un cliente o datos internos, señalalo en el bloque y preguntá si está
  aprobado para publicar.

## Ejemplo

```
/li-post armamos una herramienta interna que bajó el tiempo de una propuesta de 5 horas a 40 minutos
```

```
GANCHOS
1. #17 Ancla de tiempo   Armar una propuesta me llevaba 5 horas. Ahora me lleva 40 minutos.
2. #12 La comparación    Un redactor de propuestas de USD 12.000 contra un fin de semana y una plantilla. Ganó el fin de semana.
3. #3  Confesión         Durante dos años les cobré a mis clientes horas que perdía dando formato.

Publicaría el #17: la proporción se cree y el número es tuyo.
```
