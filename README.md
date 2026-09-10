# LinkedIn Commenter

Extensión de Chrome que agrega un botón **✨ Sugerir** a cada post del feed de LinkedIn. Al tocarlo, lee el post, le pide a Claude 3 borradores de comentario (aporte, pregunta, experiencia) y te deja editarlos. **Insertar** pega el elegido en la caja de comentario; publicar lo hacés vos.

No publica nada solo a propósito: LinkedIn prohíbe la automatización y restringe cuentas que comentan con bots.

## Instalación

```bash
npm install
npm run build
```

1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. **Cargar descomprimida** → elegí la carpeta `dist/`.
3. Tocá el ícono de la extensión para abrir la configuración: pegá tu API key de Anthropic ([console.anthropic.com](https://console.anthropic.com)), completá **Quién sos** y, si podés, pegá algunos comentarios tuyos de ejemplo. **Probar conexión** verifica la key.
4. Recargá LinkedIn.

Después de cambiar código: `npm run build` y el botón ↻ de la extensión en `chrome://extensions`, y recargá LinkedIn.

## Cómo funciona

| Archivo | Qué hace |
|---|---|
| `src/content.js` | Detecta los posts (botón "Comentar" + barra de reacciones), lee autor y texto, muestra el panel (shadow DOM) e inserta el comentario. |
| `src/background.js` | Service worker: llama a la API de Claude con el SDK oficial y salida JSON estructurada. |
| `src/prompt.js` | System prompt, esquema de salida y valores por defecto de la configuración. |
| `src/options.*` | Página de configuración (se guarda en `chrome.storage.local`). |

- Modelo por defecto: `claude-opus-5` (alternativa: `claude-sonnet-5`), con effort `medium`. Con Opus 5 se activa `fallbacks: "default"`: si los clasificadores de seguridad rechazan un pedido, la API lo reintenta en otro modelo.
- Costo aproximado: un par de centavos de dólar por post con Opus 5.
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
