# LinkedIn Commenter

Extensión de Chrome que hace tu ronda de comentarios en LinkedIn:

- **Ronda automática.** Mientras navegás el feed, lee los posts que cargan (sin hacer clics), le pide a Claude que elija los que valen un comentario según tus temas y escribe uno por post. Los deja en el botón **💬** de abajo a la derecha, con el número también en el ícono de la extensión.
- **Publicar en un clic.** En el panel ves cada post, por qué se eligió, qué tipo de comentario es y el texto (editable). **Publicar** lo pega en la caja y lo publica. **Descartar** lo saca de la cola.
- **✨ Sugerir**, en cada post: 3 borradores para elegir, como antes.

Cada comentario pasa por el humanizador de [linkedin-agent-skill-sp](https://github.com/guzzipa/linkedin-agent-skill-sp) (el mismo léxico que `/li-human`): saca rayas, comillas curvas y caracteres invisibles, y marca con ⚠ lo que suena a IA ("crucial", "No es solo X, es Y", mezcla de voseo y tuteo).

**Nada se publica sin tu clic**, a propósito: LinkedIn prohíbe comentar con bots y restringe las cuentas que lo hacen. La extensión no recorre el feed sola, salvo cuando tocás **Buscar más posts** (baja unas pantallas y vuelve).

La ronda saltea los posts patrocinados, los que tienen más de 40 comentarios (ahí el tuyo no se ve) y a la gente que ya comentaste en los últimos 7 días. Tiene un máximo por día (15 por defecto). Todo se ajusta en la configuración.

## Instalación

```bash
npm install
npm run build
```

1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. **Cargar descomprimida** → elegí la carpeta `dist/`.
3. Tocá el ícono de la extensión para abrir la configuración: pegá tu API key de Anthropic ([console.anthropic.com](https://console.anthropic.com)), completá **Quién sos** y **Temas en los que querés que te vean**, y si podés, pegá algunos comentarios tuyos de ejemplo. **Probar conexión** verifica la key.
4. Recargá LinkedIn.

Después de cambiar código: `npm run build` y el botón ↻ de la extensión en `chrome://extensions`, y recargá LinkedIn.

## Cómo funciona

| Archivo | Qué hace |
|---|---|
| `src/content.js` | Detecta los posts (botón "Comentar" + barra de reacciones), lee autor y texto, muestra el panel (shadow DOM) e inserta el comentario. |
| `src/content.js` (ronda) | Junta los posts del feed, arma las rondas, muestra la cola y publica con tu clic. La cola y el registro de lo publicado viven en `chrome.storage.local`. |
| `src/background.js` | Service worker: llama a la API de Claude con el SDK oficial y salida JSON estructurada, y humaniza cada comentario. |
| `src/prompt.js` | System prompts (sugerir y ronda), esquemas de salida y valores por defecto de la configuración. La ronda usa los 10 tipos de comentario de `/li-comment`. |
| `src/humanize.js` | Port a JS de `humanize.py`. Lee `src/lexicons/*.json`. |
| `src/options.*` | Página de configuración (se guarda en `chrome.storage.local`). |

- Modelo por defecto: `claude-opus-5-5` (alternativa: `claude-sonnet-5-5`, a mitad de precio), con effort `medium`. Se activa `fallbacks: "default"`: si los clasificadores de seguridad rechazan un pedido, la API lo reintenta en otro modelo.
- Costo aproximado con Opus 5.5: entre 5 y 10 centavos de dólar por ronda de 8 posts, y un par de centavos por cada ✨ Sugerir.
- La API key queda solo en tu navegador y viaja directo a `api.anthropic.com`.

## Si LinkedIn cambia el DOM

LinkedIn cambia sus clases seguido. El código prueba selectores conocidos y después cae en heurísticas:

- **No aparece el botón:** revisá `COMMENT_RE` / `REACT_RE` y `findActionBar` en `content.js` (buscan los botones por su `aria-label`).
- **Lee mal el post:** el panel muestra el texto leído en "Texto del post que leí (editable)". Corregilo ahí y tocá Regenerar. Para arreglarlo en el código, mirá `extractPost`.
- **No encuentra la caja de comentario:** copia el texto al portapapeles. Revisá `findEditor`.

`test/mock-feed.html` imita el feed (un post con clases conocidas y otro sin ellas, en español) con la API simulada. Para probar cambios sin entrar a LinkedIn:

```bash
python3 -m http.server 8765
```

y abrí `http://localhost:8765/test/mock-feed.html`.

## Tests y léxico

```bash
npm test
```

Compara el humanizador en JS contra `humanize.py` sobre los textos de prueba de `linkedin-agent-skill-sp`, si ese repo está en la carpeta de al lado. Cuando cambie el léxico allá, traelo con:

```bash
npm run sync-lexicon
```
