# LinkedIn Commenter

Extensión de Chrome que hace tu ronda de comentarios en LinkedIn con Claude.

Mientras bajás por el feed, lee los posts, elige los que vale la pena comentar según los temas que te interesan y te deja un comentario escrito para cada uno. Vos los revisás y publicás cada uno con un clic.

![Panel de la ronda, en el feed de prueba](docs/ronda.jpg)

- **Elige por vos.** Saltea publicidad, avisos sin contenido, temas delicados y posts donde no tenés nada concreto para sumar.
- **Escribe como una persona.** Usa 10 tipos de comentario (sumar un dato, el caso que falta, desacuerdo respetuoso, la pregunta de verdad…), nunca "¡Excelente post!", y solo usa datos tuyos que vos le diste.
- **Le saca la cara de IA.** Cada comentario pasa por un humanizador que elimina rayas largas, comillas curvas y caracteres invisibles, y marca con ⚠ las frases de manual ("crucial", "No es solo X, es Y") para que las cambies.
- **Nada se publica sin tu clic.** Ver más abajo por qué.

Funciona en español y en inglés: comenta en el idioma de cada post.

## Antes de empezar

Necesitás:

1. **Google Chrome** (o Brave, Edge, Arc u otro navegador basado en Chromium).
2. **Una API key de Anthropic, con saldo.** Se crea en [console.anthropic.com](https://console.anthropic.com): **API Keys → Create Key**. La API se paga por uso, aparte de cualquier suscripción a Claude.ai. Cargá unos USD 5 para empezar.

**Cuánto cuesta:** con el modelo por defecto (Claude Opus 5.5), cada ronda de hasta 8 posts sale entre 5 y 10 centavos de dólar. Navegando el feed un rato por día, son unos pocos dólares al mes. Con Claude Sonnet 5.5 sale la mitad.

## Instalación

### Opción A: descargar el zip (sin programar)

1. Entrá a [Releases](../../releases) y bajá el último `linkedin-commenter-vX.Y.Z.zip`.
2. Descomprimilo en una carpeta que no vayas a borrar (por ejemplo, `Documentos/linkedin-commenter`).
3. En Chrome, abrí `chrome://extensions` y activá **Modo de desarrollador** (arriba a la derecha).
4. Tocá **Cargar descomprimida** y elegí la carpeta del paso 2.
5. Fijá la extensión en la barra: ícono de rompecabezas 🧩 → 📌 al lado de **LinkedIn Commenter**.

### Opción B: desde el código

Necesitás [Node.js](https://nodejs.org) 22 o más nuevo.

```bash
git clone https://github.com/guzzipa/linkedin-commenter.git
cd linkedin-commenter
npm install
npm run build
```

Después seguí los pasos 3 a 5 de la opción A, eligiendo la carpeta `dist/`.

## Configuración (5 minutos)

Tocá el ícono de la extensión para abrir la configuración. Lo que completes acá es lo único que el modelo sabe de vos, así que vale la pena dedicarle un rato.

| Campo | Qué poner |
| --- | --- |
| **API key de Anthropic** | La key que creaste. Después tocá **Probar conexión**. |
| **Quién sos** | Tu rol, años de experiencia, en qué trabajaste, opiniones fuertes. Ejemplo: *"Diseñadora de producto, 6 años en fintech en Bogotá. Lideré el rediseño de una app de pagos. Creo que la mayoría de los onboardings piden datos demasiado pronto."* Los comentarios solo usan lo que diga acá: si no está, no lo inventa. |
| **Tono** | Cómo hablás. Si escribís con vos o con usted, decilo acá. |
| **Comentarios tuyos de ejemplo** | 3 a 5 comentarios que hayas escrito vos. Es lo que más ayuda a que suene a vos. |
| **Temas en los que querés que te vean** | Uno por línea. Con esto decide qué posts comentar. Si lo dejás vacío, usa "Quién sos". |
| **Sugerencias por ronda** | Cuántos comentarios como máximo te propone por cada tanda de posts (5 por defecto). |
| **Máximo por día** | Cuando llegás, la ronda se frena hasta el día siguiente (15 por defecto). |
| **Saltear posts con más de N comentarios** | En un post con 200 comentarios el tuyo no lo ve nadie (40 por defecto). |

Tocá **Guardar** y recargá LinkedIn.

## Uso

1. **Entrá a LinkedIn y bajá por el feed** como siempre. Abajo a la derecha aparece el botón **💬 Ronda**.
2. **Esperá unos segundos.** Cuando juntó varios posts nuevos, la extensión los manda a Claude. Si alguno vale la pena, el botón pasa a decir **💬 3 para comentar** y el número aparece también en el ícono.
3. **Abrí el panel.** Cada tarjeta muestra:
   - de quién es el post y el principio del texto;
   - qué tipo de comentario eligió y por qué;
   - el comentario, que podés editar;
   - avisos ⚠ si quedó alguna frase con olor a IA.
4. **Elegí qué hacer con cada uno:**
   - **Publicar**: lo pega en la caja de comentario del post y lo publica.
   - **Descartar**: lo saca de la cola.
   - **Ver post**: te lleva al post para leerlo entero.

**Más opciones:**
- **Buscar más posts**: baja unas pantallas para que LinkedIn cargue más y vuelve adonde estabas.
- **Pausar ronda**: deja de leer el feed hasta que la reanudes.
- **✨ Sugerir**: está en cada post y te da 3 borradores distintos para ese post en particular.

### Qué saltea la ronda

- Posts patrocinados.
- Posts con muy poco texto.
- Posts con más comentarios que tu límite.
- Gente que ya comentaste en los últimos 7 días. Comentar siempre a las mismas personas se nota, y LinkedIn penaliza los grupos que se comentan entre sí.
- Lo que Claude descarta: publicidad, avisos de empleo sin contenido, duelos y temas personales delicados, política, y posts donde no tenés nada concreto para sumar.

Las sugerencias que no publicás vencen a las 36 horas, porque para entonces el post ya envejeció.

## Por qué no publica sola

[El Acuerdo de Usuario de LinkedIn](https://www.linkedin.com/legal/user-agreement) prohíbe comentar con bots, y LinkedIn restringe o suspende las cuentas que lo hacen. Por eso:

- **Cada comentario sale solo cuando tocás Publicar.** Ese clic tuyo es el control: nada se publica en segundo plano.
- **No recorre el feed sola.** Lee los posts que vos cargás al navegar, y solo baja la página cuando tocás **Buscar más posts**.
- **No intenta esconderse de LinkedIn.** No simula movimientos de mouse ni demoras al azar.

Leé cada comentario antes de publicarlo. Sale con tu nombre, y un comentario que entendió mal el post se nota.

## Privacidad

- **Tu API key** queda guardada solo en tu navegador (`chrome.storage.local`) y viaja directo a `api.anthropic.com`. No pasa por ningún otro servidor.
- **Lo que se manda a Anthropic** para escribir los comentarios: el texto y el autor de los posts de tu feed, cuántos comentarios tienen, y lo que pusiste en la configuración. Ver la [política de privacidad de Anthropic](https://www.anthropic.com/legal/privacy).
- **Lo que queda en tu navegador:** la cola de sugerencias y un registro de a quién comentaste y cuándo, que se usa para no repetir autores.

## Problemas frecuentes

| Qué pasa | Qué hacer |
| --- | --- |
| No aparece el botón 💬 | Recargá LinkedIn. Fijate en `chrome://extensions` que la extensión esté activada y sin errores. |
| "Falta la API key" | Abrí la configuración, pegá la key y tocá **Guardar**. |
| "API key inválida" o error 401 | La key está mal copiada o la borraste en la consola de Anthropic. |
| "Límite de uso alcanzado" o error de saldo | Cargá saldo en [console.anthropic.com](https://console.anthropic.com) → **Billing**. |
| Pasa un rato y no sugiere nada | Revisá que la ronda no esté en pausa y que **Temas** no sea demasiado estrecho. El panel dice cuántos posts leyó y cuántos descartó. |
| "Quedó en la caja de comentario: tocá Publicar en LinkedIn" | No encontró el botón de publicar: el comentario ya está pegado, tocá vos el botón de LinkedIn. Pasa cuando LinkedIn cambia su página. |
| "El post ya no está en esta página" | Te copia el comentario y abre el post en otra pestaña: pegalo ahí. |

LinkedIn cambia el HTML de su sitio seguido. Si algo deja de andar, [abrí un issue](../../issues) contando qué pasó.

## Para desarrolladores

| Archivo | Qué hace |
| --- | --- |
| `src/content.js` | Corre dentro de LinkedIn. Detecta los posts (por el botón "Comentar" y la barra de reacciones), lee autor y texto, arma las rondas, muestra los paneles (shadow DOM) y publica. |
| `src/background.js` | Service worker. Llama a la API de Claude con el SDK oficial y salida JSON estructurada, humaniza cada comentario y actualiza el contador del ícono. |
| `src/prompt.js` | Prompts de **Sugerir** y de la ronda, esquemas de salida y valores por defecto de la configuración. |
| `src/humanize.js` | Port a JS de `humanize.py` de [linkedin-agent-skill-sp](https://github.com/guzzipa/linkedin-agent-skill-sp). Traduce sus regex de Python a JS. |
| `src/lexicons/` | Léxicos del humanizador, copiados de ese repo. |
| `src/options.*` | Página de configuración. |

**Modelo y API:**
- Modelo: `claude-opus-5-5` por defecto, o `claude-sonnet-5-5`.
- Usa `effort: "medium"` y `fallbacks: "default"`: si los clasificadores de seguridad rechazan un pedido, la API lo reintenta en otro modelo.

```bash
npm run watch          # recompila al guardar; después ↻ en chrome://extensions y recargá LinkedIn
npm test               # tests del humanizador
npm run sync-lexicon   # trae los léxicos de ../linkedin-agent-skill-sp
```

Si [linkedin-agent-skill-sp](https://github.com/guzzipa/linkedin-agent-skill-sp) está clonado en la carpeta de al lado (o en `SKILLS_REPO`), `npm test` también compara el humanizador en JS contra el de Python.

**Probar sin entrar a LinkedIn:** `test/mock-feed.html` imita el feed y simula la API y `chrome.storage`. Tiene cuatro posts:
- uno con las clases del feed viejo de LinkedIn;
- uno sin clases;
- uno patrocinado;
- uno armado como el feed nuevo (2026): sin clases legibles, cada post es un `role="listitem"`, el número de comentarios va adentro del botón y el botón de publicar aparece al escribir.

```bash
npm run build
python3 -m http.server 8765
```

Abrí `http://localhost:8765/test/mock-feed.html`: a los 8 segundos aparecen tres sugerencias.

**Si LinkedIn cambia su HTML.** Desde 2026 el feed casi no tiene clases legibles. Lo que la extensión usa hoy para orientarse:

| Qué | Cómo lo encuentra |
| --- | --- |
| El post | `[role="listitem"]` |
| Su ID | `componentkey="update-card-…"` |
| El texto | `[data-testid="expandable-text-box"]` |
| El autor | el `aria-label` del menú del post ("…post by {autor}") |
| La cantidad de comentarios | el número adentro del botón **Comment** |
| La caja de comentario | `[contenteditable][role="textbox"]`, que se monta recién cuando está en pantalla |

Dónde mirar si algo se rompe:
- **No aparece ✨ Sugerir:** revisá `COMMENT_RE`, `REACT_RE` y `findActionBar`, que buscan los botones por su `aria-label`.
- **Lee mal el post:** revisá `extractPost`. En **Sugerir**, el texto leído se puede corregir a mano.
- **No encuentra la caja o el botón de publicar:** revisá `findEditor` y `findSubmit`.

**Publicar una versión:**
1. Subí `version` en `package.json` y en `src/manifest.json`.
2. Pusheá un tag `vX.Y.Z`. El workflow `release.yml` arma el zip y crea el release.

## Créditos

- Los tipos de comentario y el humanizador vienen de [linkedin-agent-skill-sp](https://github.com/guzzipa/linkedin-agent-skill-sp), la adaptación al español de [linkedin-agent-skill](https://github.com/Jakeschincariol/linkedin-agent-skill) de Jake Schincariol.

## Licencia

MIT. Ver [LICENSE](LICENSE).
