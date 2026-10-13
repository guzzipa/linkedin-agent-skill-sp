---
name: li-human
description: >-
  Saca la huella de máquina de cualquier borrador en español o inglés (rayas,
  léxico de manual, calcos del inglés, caracteres invisibles, mezcla de voseo y
  tuteo) y lo puntúa con un panel de cinco chequeos antes de que salga. Usalo
  cuando un texto tiene que sonar humano, cuando el usuario dice "humanizá
  esto", "¿suena a IA?", "sacale las rayas", "limpialo", "¿me van a detectar?",
  y antes de mostrar cualquier post, comentario, respuesta o DM de LinkedIn.
---

# li-human

Dos herramientas que corren de verdad. Usalas; no lo hagas a ojo.

```bash
python3 humanize.py borrador.txt --report --registro voseo   # limpia y muestra qué cambió
python3 detect.py borrador.txt --registro voseo               # puntúa, cinco chequeos
python3 detect.py antes.txt despues.txt                       # muestra la diferencia
```

El idioma se detecta solo (`--lang es|en` para forzarlo). El registro sale de
`~/.claude/linkedin/voice.md` (campo **Registro**): `voseo`, `tuteo`, `usted`,
`neutro` o `espana`. Si no hay registro definido, usá `auto`, que igual marca
cuando el texto mezcla formas.

Los léxicos viven en `lexicons/es.json` y `lexicons/en.json`. Son para editar:
si una palabra es jerga legítima de la industria del usuario ("escalable",
"apalancamiento" en finanzas), sacala del archivo.

## Qué se arregla solo

1. **Caracteres invisibles.** Espacios de ancho cero, word joiners, guiones
   blandos, BOM, caracteres de etiqueta, espacios duros. Un teclado no los
   produce y sobreviven al copiar y pegar.
2. **Tipografía.** Raya a coma, comillas curvas a rectas, elipsis a tres
   puntos, viñeta a guion. La raya es la que importa: en LinkedIn en español
   casi nadie la tipea.
3. **Lo que tiene reemplazo exacto.** Conectores de ensayo ("asimismo",
   "por ende", "no obstante"), relleno ("es importante destacar que", "cabe
   señalar que", que se borran y la oración se recapitaliza) y calcos con
   equivalente fijo ("hace sentido" a "tiene sentido", "al final del día" a
   "al final", "en orden a" a "para").

**Nunca mete una palabra de otro idioma.** El original reemplazaba "crucial"
por "important" en textos en español; eso ya no pasa y hay un test que lo
verifica.

## Qué se marca para que lo reescribas vos

En español casi todos los adjetivos y verbos de manual necesitan concordar en
género y número, o cambian de sentido según el contexto. Por eso **se marcan,
no se reemplazan**: "robusto/a/os/as", "potenciar", "innovador", "sinergia",
"crucial", "paradigma", "llevar al siguiente nivel", "la clave está en",
"juega un rol", "me complace anunciar", "apasionado por". El informe muestra
la palabra tal como aparece y una nota de qué poner en su lugar.

Y las estructuras, que son la huella más fuerte:

- "No es solo X, es Y" / "No es X. Es Y." / "No se trata de X, se trata de Y"
- "No solo X, sino también Y"
- Pregunta-revelación sola en una línea: "¿El resultado?", "¿La clave?", "¿Por qué?"
- "Spoiler:", "Plot twist:", "Esto es lo que aprendí", "Leelo de nuevo", "Hilo 🧵"
- "Hoy quiero hablar de..." como apertura
- Tríadas de tres palabras ("cultura, innovación y sinergia")
- Cebo: "¿Qué opinan?", "¿Coincidís?", "Contame en comentarios", "Comentá GUÍA y te lo mando"
- Cierre de ensayo: "En resumen", "En conclusión", "En definitiva"
- **Mayúsculas de título en inglés**: "Cómo Escalar Tu Equipo De Datos". En
  español va mayúscula solo la primera palabra; esto es un calco directo.
- **Listas con emojis como viñetas** (✅ 👉 🔹), tres o más.
- **Broetry**: ocho párrafos o más donde casi todos son una frase suelta.
- **Mezcla de registros**: "tenés" y "tienes" en el mismo post. Es la marca de
  IA más clara en un texto rioplatense, porque los modelos tutean por defecto.
  Con `--registro voseo` también marca formas de España ("tenéis", "vale,").
- Largo de oraciones uniforme.

Reescribí cada línea marcada a mano, manteniendo el sentido, y volvé a correr
`detect.py`. Esa es la parte que lleva de REVISAR a PASA, y es la que un
script no puede hacer.

## Los cinco chequeos

| chequeo | qué mide | cómo se ve la máquina |
| --- | --- | --- |
| VARIACIÓN | variación del largo de oraciones (las cortas cuentan) | todas las oraciones del mismo largo |
| CONCRECIÓN | cifras con unidad ("ocho meses", "11 puntos", "USD 40k"), fechas, siglas, nombres propios, citas textuales | sustantivos abstractos, ningún dato |
| LÉXICO | términos de manual cada 100 palabras | vocabulario de folleto |
| HUELLA | invisibles, rayas, comillas curvas | tipografía perfecta |
| VOZ (es) | persona gramatical, primera persona del pasado, marcas de oralidad, apartes entre paréntesis, registro coherente, estructuras | nadie habla, nadie hizo nada, mezcla "tú" y "vos" |

En inglés, VOZ sigue midiendo contracciones y pronombres como el original.

El veredicto pondera el promedio al 60% y el **chequeo más débil** al 40%,
porque a un detector le alcanza con una señal. PASA pide 70 o más y ningún
chequeo debajo de 55.

## Decilo con honestidad

Son cinco heurísticas locales basadas en las señales que miran los detectores
públicos. Corren en la máquina del usuario y no suben nada. **No son** GPTZero,
Originality, Copyleaks, Winston ni Turnitin, no llaman a sus APIs y no pueden
prometer su veredicto. No le digas a nadie que su texto es "indetectable".

Y una más: el objetivo no es engañar a un detector, es que el texto suene a la
persona que lo firma. Si el borrador pasa el panel pero no dice nada que solo
esa persona podría decir, no está listo. Para eso está `/li-lectores`.

## Orden de trabajo

1. `humanize.py borrador.txt -o limpio.txt --report --registro <registro>`
2. Leé las secciones 4 y 5 del informe. Reescribí esas líneas vos.
3. `detect.py borrador.txt limpio.txt --registro <registro>` para mostrar antes y después.
4. Si no da PASA, arreglá el chequeo más débil que nombra la salida y repetí.
   Dos vueltas es normal. Cinco quiere decir que el borrador se escribió con
   fórmula: la solución es otro borrador, no más pasadas.
5. Mostrale al usuario el texto limpio y el puntaje. Nunca el puntaje solo.

## Tests

```bash
python3 tests/run_tests.py
```

Cubren que no se cuele inglés, la mezcla de registros, la separación entre un
texto humano real y uno de manual, URLs intactas y caracteres invisibles.
