# regiones.md

El español de LinkedIn no es uno. Un post para Buenos Aires, otro para Ciudad
de México y otro para Madrid cambian en palabras, números, moneda y fechas. Un
modelo mezcla todo eso por defecto, y la mezcla es una de las señales más
claras de que el texto no lo escribió una persona.

Todos los skills leen la **Variante regional** de `~/.claude/linkedin/voice.md`
y escriben con la columna que corresponde. Si el campo está vacío, se usa el
**Registro** para deducir la región (voseo → rioplatense, `espana` → España).
Si no hay ninguno de los dos, se pregunta una vez y se anota en `voice.md`.

`humanize.py` y `detect.py` marcan solos la mezcla de vocabulario de España y
de LatAm (`vocabulario_regional` en `lexicons/es.json`). Lo de abajo es para
escribir bien de entrada.

## Vocabulario

| concepto | rioplatense | México | España | Chile | Colombia / Venezuela | neutro LatAm |
| --- | --- | --- | --- | --- | --- | --- |
| teléfono | celular | celular | móvil | celular | celular | celular |
| computadora | compu, computadora | computadora | ordenador | computador | computador | computadora |
| auto | auto | carro, coche | coche | auto | carro | auto |
| trabajo (informal) | laburo | chamba | curro | pega | camello, chamba | trabajo |
| dinero (informal) | plata | lana, varo | pasta, dinero | plata, lucas | plata | dinero |
| departamento | departamento, depto | departamento, depa | piso | departamento, depto | apartamento | departamento |
| genial | buenísimo, bárbaro | padre, chido | guay, genial | bacán | chévere, bacano | excelente |
| ahora mismo | ya, ahora | ahorita | ahora mismo | al tiro | ya mismo | ahora |
| reunión breve | una call, una reunión | una junta | una reunión | una reunión | una reunión | una reunión |
| tomar (un bus) | tomar | tomar | coger | tomar | coger, tomar | tomar |
| manejar | manejar | manejar | conducir | manejar | manejar | manejar |
| currículum | CV | CV, currículum | CV, currículum | CV | hoja de vida | CV |
| sueldo | sueldo | sueldo, salario | sueldo, nómina | sueldo | salario | salario |

Ojo con **coger**: normal en España y Colombia, vulgar en Argentina, México y
buena parte de Centroamérica. Si el post va a LatAm, nunca.

## Números, moneda y fechas

| | Argentina, Chile, Colombia, España, Uruguay | México, Centroamérica, Caribe |
| --- | --- | --- |
| miles | 18.000 | 18,000 |
| decimales | 0,81 | 0.81 |
| porcentaje | 30% (la RAE pide "30 %", pero en LinkedIn casi nadie lo escribe así) | 30% |

- **El signo `$` es ambiguo.** En Argentina, Chile, Colombia, México y Uruguay
  es la moneda local. Para dólares escribí `USD 18.000` o `US$18.000`. En un
  post con audiencia de varios países, siempre `USD`.
- **Fechas:** día, después mes: `14/3` o `14 de marzo`. Nunca `3/14`.
- **Meses, días e idiomas van en minúscula:** enero, lunes, español. La
  mayúscula es un calco del inglés y `humanize.py` la marca.
- **Hora:** en Argentina y España se escribe mucho `18 h` o `18:00`; en
  México, `6 pm`. Seguí lo que haga el usuario en sus posts.

## Lenguaje inclusivo

Es una elección de quien firma, no del skill. `voice.md` tiene el campo
**Lenguaje inclusivo** con cuatro opciones:

- **masculino genérico**: "los clientes", "todos".
- **desdoblamiento**: "clientes y clientas", "todos y todas". Cansa rápido, así
  que se usa una vez por post como mucho.
- **neutro sin marca**: se reescribe para evitar el género: "quienes compran",
  "el equipo", "las personas que lideran". Es la opción que menos fricción
  genera en audiencias mixtas.
- **morfológico**: "todes", "les clientes". Solo si el usuario lo usa en sus
  posts.

Cualquiera sea la opción, se sostiene en todo el texto. Mezclar "todos" con
"todes" en el mismo post se nota igual que mezclar "tenés" con "tienes".

## Puntuación que es española y no se toca

- **Signos de apertura** `¿` y `¡`. Muchos humanos los omiten en LinkedIn; un
  modelo casi nunca. Si el usuario no los usa en sus posts, no los agregues.
- **Raya de diálogo**: `—Nos vamos con alguien más barato —me dijo.` Es
  ortografía correcta. `humanize.py` no la toca y `detect.py` no la cuenta
  como huella. La raya usada como en inglés ("la clave — y esto importa — es")
  sí se cambia por coma.
- **Comillas latinas** `«»`: correctas en España, raras en LatAm. Si el usuario
  no las usa, van rectas.
