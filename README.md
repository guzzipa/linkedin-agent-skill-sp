# El agente de LinkedIn, en español

Catorce skills de Claude para llevar una cuenta de LinkedIn en español (y en
inglés cuando hace falta). Gratis, MIT, sin registro, sin API key, sin nada
que conectar.

Es una adaptación de
[Jakeschincariol/linkedin-agent-skill](https://github.com/Jakeschincariol/linkedin-agent-skill),
que funciona bien en inglés pero rompe los textos en castellano: su
humanizador reemplazaba "crucial" por "important" adentro de un post en
español, no veía ninguna de las muletillas de LinkedIn en nuestro idioma, y
su chequeo de voz buscaba contracciones inglesas, así que un post en español
casi nunca podía aprobar. Esta versión reescribe el humanizador, traduce y
adapta los once skills a LatAm, y suma tres nuevos.

**Nada se publica hasta que decís que sí.** Estos skills escriben. Publicás vos.

El repo trae dos cosas, que usan el mismo humanizador:

| | qué es | para quién |
| --- | --- | --- |
| **[Las skills](#instalar)** | 14 skills para Claude Code o el chat de Claude: posts, perfil, plan semanal, comentarios, DMs, bandeja, carruseles, auditoría. Gratis, sin API key. | Quien quiere ayuda con todo LinkedIn hablando con Claude. |
| **[La extensión de Chrome](extension/)** | Hace tu ronda de comentarios adentro de LinkedIn: lee el feed, elige qué posts vale la pena comentar, escribe los comentarios y vos publicás con un clic. Funciona con Claude, Gemini, DeepSeek u OpenRouter (estos dos últimos, gratis o casi), con tu propia API key. | Quien comenta seguido y quiere ahorrarse la ronda diaria. |

## Qué cambió respecto del original

| | original | esta versión |
| --- | --- | --- |
| Idioma | solo inglés | español e inglés, detección automática; nunca cruza idiomas |
| Léxico de manual | 113 términos en inglés | 92 entradas en español (frases, calcos, anglicismos, anuncios de LinkedIn) + el léxico inglés |
| Reemplazos | todo automático ("paradigm" -> "model") | automático solo lo seguro; lo que depende de género o contexto se marca para reescribir |
| Estructuras | 11, en inglés | 18 en español (mayúsculas de título en inglés, viñetas de emoji, aperturas de comentario invisibles, entre otras) + broetry y registro, calculados |
| Registro | no existe | detecta mezcla de voseo y tuteo (la marca de IA más clara en un texto rioplatense) y choques con tu registro |
| Chequeo de voz | contracciones inglesas | persona gramatical, primera persona del pasado, oralidad y registro |
| Ganchos | 21 | 27: los 21 adaptados con ejemplos de la región + 6 nuevos |
| Skills | 11 | 14: suma `li-territorio`, `li-lectores`, `li-bilingue` |
| Tests | no | `tests/run_tests.py`, 18 casos, en CI |
| Extensión de Chrome | no | [`extension/`](extension/): ronda de comentarios en LinkedIn con el mismo humanizador |

## Instalar

En Claude Code:

```bash
git clone https://github.com/guzzipa/linkedin-agent-skill-sp.git
cp -r linkedin-agent-skill-sp/skills/li-* ~/.claude/skills/
```

O como plugin:

```
/plugin marketplace add guzzipa/linkedin-agent-skill-sp
/plugin install linkedin-agent-es
```

En la app de Claude: subí la carpeta de cada skill como skill propio, o pegá
un `SKILL.md` al principio de un chat y funciona como modo (sin los scripts de
`li-human`, que son la mitad del valor).

Después, diez minutos con `templates/voice.md`. Copialo a
`~/.claude/linkedin/voice.md` y completalo, o pegale a Claude tres posts tuyos
y decile "escribí mi voice.md a partir de estos". El campo **Registro**
(voseo, tuteo, usted) lo usan todos los skills. Y corré `/li-territorio` antes
del primer plan.

## Los catorce

| comando | qué hace |
| --- | --- |
| `/li-territorio` | **Nuevo.** Tus 2-3 territorios, el banco de tesis discutibles y el banco de pruebas. El ranking lee perfil y posts como texto; esto los alinea. |
| `/li-post` | Una idea a un post. Tres ganchos de [27 fórmulas](skills/li-post/hooks.json), un borrador, humanizado, y el **kit de la primera hora**: primer comentario y respuestas preparadas a las objeciones previstas. |
| `/li-lectores` | **Nuevo.** Pre mortem con cinco lectores simulados: quién deja de leer dónde, qué comentaría cada uno, qué se puede sacar de contexto. Riesgos de confidencialidad primero. |
| `/li-comment` | Comentarios en posts ajenos. Diez tipos, incluido "la mirada local" (cómo cambia en LatAm). Nunca "Excelente post". |
| `/li-reply` | El hilo debajo de tu post, ordenado en oportunidad / sustancia / par / apoyo / ruido. |
| `/li-profile` | Puntúa tu perfil con una [rúbrica de 13 partes](skills/li-profile/rubric.json) sobre 100, incluida la coherencia entre perfil y posts, y reescribe en orden de impacto. |
| `/li-plan` | La semana: qué, cuándo (con la cuenta de husos horarios de LatAm) y con quién interactuar. |
| `/li-bilingue` | **Nuevo.** Transcreación español-inglés de posts y perfil. Moneda, contexto local, registro, falsos amigos. |
| `/li-human` | El humanizador. Dos scripts que corren de verdad. Ver abajo. |
| `/li-carousel` | Carruseles: texto slide por slide, la portada y el PDF, ajustado a que el español ocupa más. |
| `/li-repurpose` | Un video, newsletter o clase en una semana de posts, sin traducir fuentes en inglés. |
| `/li-dm` | La nota de invitación, el primer mensaje y dos seguimientos. Dos. |
| `/li-inbox` | Ordena la bandeja y detecta secuencias automáticas, también por mezcla de registros. |
| `/li-audit` | Post mortem de lo publicado: interacción, guardados, envíos y visitas al perfil, no impresiones. |

## El humanizador

`/li-human` trae dos scripts de Python sin dependencias. Corren en tu máquina
y no suben nada.

```bash
python3 humanize.py borrador.txt --report --registro voseo   # limpia y muestra cada cambio
python3 detect.py borrador.txt                                # puntúa, cinco chequeos
python3 detect.py antes.txt despues.txt                       # la diferencia
```

**Se arregla solo:** caracteres invisibles, rayas, comillas curvas, conectores
de ensayo ("asimismo", "por ende"), relleno ("es importante destacar que") y
calcos con equivalente exacto ("hace sentido", "al final del día").

**Se marca para que lo reescribas:** "robusto", "potenciar", "innovador",
"sinergia", "la clave está en", "llevar al siguiente nivel", "me complace
anunciar", "No es solo X, es Y", "¿El resultado?", "En resumen", "¿Qué
opinan?", "Comentá GUÍA y te lo mando", "Cómo Escalar Tu Equipo De Datos", las
listas con ✅, el broetry, "tenés" mezclado con "tienes", "ordenador" mezclado
con "celular", y las marcas del español de traducción: el gerundio de
posterioridad ("..., logrando un aumento"), la pasiva con "por", "levanté mi
mano", "en Enero", "en una base diaria". La raya de diálogo
(`—Nos vamos —me dijo.`) es español correcto y no se toca. En español casi
todo lo de manual necesita concordar en género y número o cambia según el
contexto, así que un regex lo arruinaría. Por eso, en un post de manual en
español el script solo sube unos puntos: la mejora fuerte la hacés vos con la
lista que te da.

**Los cinco chequeos**, de 0 a 100, más alto es más humano:

| chequeo | qué mide |
| --- | --- |
| VARIACIÓN | variación del largo de oraciones; las cortas cuentan |
| CONCRECIÓN | cifras con unidad ("ocho meses", "11 puntos"), fechas, siglas, nombres, citas |
| LÉXICO | términos de manual cada 100 palabras |
| HUELLA | invisibles, rayas, comillas curvas |
| VOZ | persona gramatical, oralidad, registro coherente, estructuras |

Un post de manual en español de los tests:

```
  VARIACIÓN    #################.......  72.2
  CONCRECIÓN   ################........  65.6
  LÉXICO       ........................   0.0   9 términos de manual, 9.4 cada 100 palabras
  HUELLA       #################.......  71.3   1 raya
  VOZ          ........................   0.0   registro:voseo+tuteo, no-es-solo, no-se-trata, revelacion
  PUNTAJE      ######..................  25.1   MARCADO
```

Un post escrito por una persona, en los mismos tests:

```
  VARIACIÓN    ####################....  81.6
  CONCRECIÓN   ######################## 100.0   4 cifras con unidad, 2 fechas, 3 citas
  LÉXICO       ######################## 100.0
  HUELLA       ######################## 100.0
  VOZ          ######################..  89.6
  PUNTAJE      #####################...  89.2   PASA
```

```bash
python3 tests/run_tests.py   # 18/18 ok
```

## La letra chica, que es la parte honesta

**Estos skills no publican en LinkedIn, y no deberían.** Publicar de forma
automatizada o leer el feed con un navegador viola el
[Acuerdo de Usuario de LinkedIn](https://www.linkedin.com/legal/user-agreement)
y termina en cuentas restringidas. Todo skill termina igual: un bloque para
copiar, y lo pegás vos.

**Los cinco chequeos son heurísticas locales, no detectores.** No son GPTZero,
Originality, Copyleaks, Winston ni Turnitin, no llaman a esas APIs y no pueden
prometer su veredicto. Nadie puede venderte "indetectable" con honestidad.

**`li-lectores` es una simulación, no un dato.** Sirve para ver lo obvio que
el autor no ve. Lo que pasó de verdad lo dice `li-audit`.

**Nada acá inventa.** Ninguna métrica, cliente ni resultado va con tu nombre.
Si un borrador necesita un número que no diste, vuelve con `{{tu número}}` y
un aviso.

**Lo que se dice del algoritmo es consenso de la industria, no documentación
oficial.** LinkedIn no publica cómo rankea. Lo que usan estos skills (peso de
los comentarios con sustancia y del tiempo de lectura, guardados y envíos,
links fuera del cuerpo, hashtags casi irrelevantes, coherencia temática entre
perfil y posts, castigo a los pods) es lo que coinciden en reportar las
fuentes de abajo en 2025 y 2026. Son supuestos previos: `li-audit` los
confirma o los descarta para tu cuenta.

## Archivos

```
skills/li-post/hooks.json             27 fórmulas de gancho: plantilla, ejemplo, para qué sirve, cómo se arruina
skills/li-human/lexicons/es.json      léxico en español: frases, palabras, 24 estructuras, registros, oralidad y vocabulario por región
skills/li-human/regiones.md           vocabulario, números, moneda, fechas y lenguaje inclusivo por región
skills/li-human/lexicons/en.json      léxico en inglés (el original, con reemplazos dudosos pasados a marca)
skills/li-human/humanize.py           las pasadas de limpieza
skills/li-human/detect.py             el panel de cinco chequeos
skills/li-profile/rubric.json         el puntaje de perfil sobre 100
templates/voice.md                    tu perfil de voz. Completalo primero.
tests/                                runner y textos de prueba
extension/                            la extensión de Chrome (ver extension/README.md)
```

## Fuentes consultadas para la adaptación

- [LinkedIn suma guardados y envíos a sus métricas de contenido](https://www.socialmediatoday.com/news/linkedin-adds-save-and-send-data-to-content-insights/759828/) (Social Media Today, sept. 2025)
- [Cómo funciona el algoritmo de LinkedIn](https://www.tryordinal.com/blog/how-linkedins-algorithm-works) (Ordinal; incluye declaraciones de producto de LinkedIn sobre links y hashtags)
- [El algoritmo de LinkedIn en 2026](https://www.giraffesocialmedia.co.uk/the-linkedin-algorithm-decoded-what-actually-gets-you-seen-in-2026/) (Giraffe Social Media; horarios citando a Sprout Social)
- [360Brew y el perfil](https://www.nit.bg/en/successful-linkedin-profile-in-2026-the-ai-algorithm-(360brew)-nit) (sobre el paper de LinkedIn de enero de 2025 y sus implicancias)
- [Palabras que delatan a ChatGPT en español](https://www.applesfera.com/curiosidades/te-han-pillado-palabras-frases-que-hacen-evidente-que-utilizaste-chatgpt-lugar-pensar-a-apple) (Applesfera) y [adjetivos y metáforas de IA](https://www.enter.co/?p=553718) (Enter.co)
- [Límite de caracteres de la nota de invitación](https://getfuzzy.ai/blog/linkedin-connection-request-note-300-characters) (Fuzzy, junio 2026)

## Créditos

Original de Jake Schincariol, [opusjake.ai](https://opusjake.ai), bajo MIT.
Adaptación al español y skills nuevos: Pablo Guzzi.

## Licencia

MIT. Usalo, cambialo, publicalo.
