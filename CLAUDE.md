# CLAUDE.md

Adaptación al español y LatAm de `Jakeschincariol/linkedin-agent-skill` (MIT).
`main` tiene el original sin cambios; la adaptación vive en la rama `es-latam`
(PR #1).

## Estructura

- `skills/li-*/SKILL.md`: 14 skills. 11 adaptados del original y 3 nuevos
  (`li-territorio`, `li-lectores`, `li-bilingue`).
- `skills/li-human/`: `humanize.py` y `detect.py`, sin dependencias. Leen
  `lexicons/es.json` y `lexicons/en.json`, y el idioma se detecta solo.
- `skills/li-post/hooks.json`: 27 fórmulas de gancho (de la 22 a la 27 son nuevas).
- `skills/li-profile/rubric.json`: 13 ítems que suman 100.
- `skills/li-human/regiones.md`: vocabulario, números, moneda y fechas por región.
- `templates/voice.md`: perfil de voz. El campo Registro (voseo, tuteo,
  usted, neutro o espana) lo usan todos los skills.
- `tests/run_tests.py`: tests sin dependencias, con textos en `tests/fixtures/`.

## Convenciones

- Correr `python3 tests/run_tests.py` antes de cada commit. Tienen que pasar todos.
- En el léxico español, `replace` con texto es un reemplazo automático y solo
  se usa cuando el cambio es seguro: conectores, relleno y calcos con
  equivalente fijo. Lo que depende de género, número o contexto lleva
  `replace: null` y se marca para reescribir.
- Nunca reemplazar por una palabra de otro idioma.
- Cada término nuevo del léxico necesita un caso que verifique que no genera
  falsos positivos en `humano_es.txt` ni en `humano_es_2.txt`. Si hace falta,
  agregar un texto humano nuevo.
- Los skills están escritos en voseo rioplatense, con ejemplos de la región.
  Ningún ejemplo debe presentarse como dato real del usuario.
- Los skills no publican en LinkedIn ni automatizan el navegador: todo
  termina en un bloque para copiar y pegar.
- Lo que se afirma sobre el algoritmo es consenso de la industria, no
  documentación de LinkedIn. Las fuentes están en el README.

## Pendientes posibles

- Probar el léxico con posts reales del autor y ajustar los falsos positivos.
- Ampliar `vocabulario_regional` y `oralidad` con posts reales de cada región.
- Evaluar `li-lectores` con posts ya publicados, contrastando con `li-audit`.
