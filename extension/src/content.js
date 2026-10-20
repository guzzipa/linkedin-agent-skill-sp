// Inyecta un botón "Sugerir" en la barra de acciones de cada post del feed de LinkedIn.
// El DOM de LinkedIn cambia seguido: cada paso prueba selectores conocidos y cae en heurísticas.
(() => {
  const MARK = "data-lic";
  const COMMENT_RE = /^(comment|comentar|comentario)\b/i;
  const REACT_RE = /(like|react|recomendar|me gusta|reaccionar)/i;
  const ANGLE_LABELS = { aporte: "Aporte", pregunta: "Pregunta", experiencia: "Experiencia" };

  // ---------- Detección de posts ----------

  function labelOf(el) {
    return (el.getAttribute("aria-label") || el.innerText || "").trim();
  }

  // Sube desde el botón "Comentar" hasta el contenedor que también tiene el botón de reacciones.
  function findActionBar(commentBtn) {
    let node = commentBtn.parentElement;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      const buttons = node.querySelectorAll("button");
      if (buttons.length >= 3 && [...buttons].some((b) => REACT_RE.test(labelOf(b)))) return node;
    }
    return null;
  }

  function findPostContainer(actionBar) {
    return (
      actionBar.closest(
        // El feed nuevo de LinkedIn (2026) no tiene clases legibles: cada post es un listitem.
        '[data-urn*="activity"], [data-urn*="ugcPost"], [data-id*="urn:li:activity"], .feed-shared-update-v2, [role="article"], article, [role="listitem"]'
      ) || actionBar.parentElement?.parentElement?.parentElement
    );
  }

  function scan() {
    for (const btn of document.querySelectorAll(`button:not([${MARK}])`)) {
      // El botón "Comentar" que publica vive dentro del form de la caja; ese no nos interesa.
      if (btn.getAttribute("type") === "submit" || btn.closest("form") || !COMMENT_RE.test(labelOf(btn))) {
        btn.setAttribute(MARK, "skip");
        continue;
      }
      // Sin marcar todavía: si la barra aún no terminó de renderizar, se reintenta en el próximo scan.
      const bar = findActionBar(btn);
      if (!bar) continue;
      btn.setAttribute(MARK, "done");
      if (bar.querySelector(".lic-btn")) continue;
      const container = findPostContainer(bar);
      if (!container) continue;
      container.licCommentBtn = btn;
      registerPost(container, btn);

      const ours = document.createElement("button");
      ours.type = "button";
      ours.className = "lic-btn";
      ours.setAttribute(MARK, "ours");
      ours.textContent = "✨ Sugerir";
      ours.title = "Sugerir comentarios con Claude";
      ours.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPanel({ container, commentBtn: btn });
      });
      // Insertar después del hijo directo de la barra que contiene el botón Comentar.
      let slot = btn;
      while (slot.parentElement && slot.parentElement !== bar) slot = slot.parentElement;
      slot.after(ours);
    }
  }

  let scanTimer = null;
  new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 400);
  }).observe(document.body, { childList: true, subtree: true });
  // Después de que se defina todo el script (la ronda, más abajo, usa constantes propias).
  queueMicrotask(scan);

  // ---------- Lectura del post ----------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function clean(text) {
    return text
      .replace(/…\s*(see more|ver más|más|more)\s*$/i, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ¿Está dentro de la sección de comentarios del post? El feed viejo usa el prefijo BEM
  // "comments-"; en el nuevo no hay clases, pero los comentarios van después de la barra de acciones.
  function inComments(el, container, { byPosition = true } = {}) {
    for (let n = el; n && n !== container; n = n.parentElement) {
      if (typeof n.className === "string" && /\bcomments-/.test(n.className)) return true;
    }
    if (!byPosition) return false;
    const btn = container.licCommentBtn;
    return !!btn && !btn.contains(el) && !!(btn.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  async function extractPost(container, { expand = true } = {}) {
    const more = expand && [...container.querySelectorAll("button")].find(
      (b) =>
        !inComments(b, container) &&
        (b.classList.contains("feed-shared-inline-show-more-text__see-more-less-toggle") ||
          /^(…\s*)?(see more|more|ver más|más)$/i.test(labelOf(b))) &&
        b.getAttribute("aria-expanded") !== "true"
    );
    if (more) {
      more.click();
      await sleep(200);
    }

    const known = [
      '[data-testid="expandable-text-box"]',
      ".update-components-text",
      ".feed-shared-inline-show-more-text",
      ".feed-shared-update-v2__description",
      '[data-test-id="main-feed-activity-card__commentary"]',
    ];
    for (const sel of known) {
      const el = [...container.querySelectorAll(sel)].find((e) => !inComments(e, container) && e.innerText.trim());
      if (el) return clean(el.innerText);
    }

    // Heurística: el bloque de texto más largo fuera de la sección de comentarios.
    let best = "";
    for (const el of container.querySelectorAll('[dir="ltr"], p, span')) {
      if (inComments(el, container) || el.closest(".lic-btn")) continue;
      const t = el.innerText?.trim() || "";
      if (t.length > best.length) best = t;
    }
    return clean(best);
  }

  function extractAuthor(container) {
    // Feed nuevo: el menú del post dice "Open control menu for post by {autor}".
    for (const b of container.querySelectorAll("button[aria-label]")) {
      if (inComments(b, container)) continue;
      const m = b.getAttribute("aria-label").match(/(?:post by|publicación de)\s+(.+)$/i);
      if (m) return m[1].trim();
    }
    const el =
      container.querySelector(
        '.update-components-actor__title span[aria-hidden="true"], .update-components-actor__name span[aria-hidden="true"], .update-components-actor__title, .update-components-actor__name'
      ) ||
      [...container.querySelectorAll('a[href*="/in/"], a[href*="/company/"]')].find(
        (a) => !inComments(a, container) && a.innerText.trim()
      );
    return (el?.innerText || "").split("\n")[0].split("•")[0].trim();
  }

  // ---------- Inserción en la caja de comentario ----------

  const isVisible = (e) => e.getClientRects().length > 0;

  function findEditor(container) {
    const inBox = [
      ...container.querySelectorAll(
        '.comments-comment-box [contenteditable="true"], .comments-comment-texteditor [contenteditable="true"], .ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"]'
      ),
    ].find(isVisible);
    if (inBox) return inBox;
    // Solo el foco dentro de ESTE post: si no, podríamos escribir en la caja de otro post.
    const active = document.activeElement;
    return active?.isContentEditable && container.contains(active) && isVisible(active) ? active : null;
  }

  async function waitFor(fn, timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(100);
    }
    return null;
  }

  // El portapapeles falla si la pestaña no tiene foco; no es motivo para cortar el flujo.
  async function copy(text) {
    try {
      await copy(text);
      return true;
    } catch {
      return false;
    }
  }

  async function insertComment({ container, commentBtn }, text) {
    let editor = findEditor(container);
    if (!editor) {
      // En el feed nuevo la caja se monta recién cuando esa zona está en pantalla.
      commentBtn.scrollIntoView({ block: "center" });
      commentBtn.click();
      editor = await waitFor(() => findEditor(container), 10000);
    }
    if (!editor) return (await copy(text)) ? "copied" : "failed";
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    // insertText pasa por el pipeline de edición nativo, así el editor de LinkedIn registra el cambio.
    const ok = document.execCommand("insertText", false, text);
    if (!ok || !editor.innerText.includes(text.slice(0, 20))) {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
    editor.scrollIntoView({ block: "center", behavior: "smooth" });
    return "inserted";
  }

  // ---------- Panel ----------

  let panel = null;
  let current = null; // { container, commentBtn, author }
  let requestId = 0;

  const PANEL_CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 20px; bottom: 20px; width: 400px; max-height: calc(100vh - 40px);
      display: flex; flex-direction: column; background: #fff; color: #1d2226; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.22); font: 14px/1.4 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483647; overflow: hidden; }
    header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #e8e8e8; }
    header strong { flex: 1; font-size: 15px; }
    .x { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: #666; padding: 2px 6px; border-radius: 6px; }
    .x:hover { background: #f0f0f0; }
    .body { padding: 12px 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
    .meta { color: #666; font-size: 12px; }
    details summary { cursor: pointer; color: #666; font-size: 12px; }
    textarea, input { width: 100%; box-sizing: border-box; font: inherit; border: 1px solid #ccc; border-radius: 8px; padding: 8px; color: inherit; background: #fff; }
    textarea:focus, input:focus { outline: 2px solid #0a66c2; outline-offset: -1px; border-color: transparent; }
    .post { min-height: 90px; font-size: 12px; margin-top: 6px; }
    .row { display: flex; gap: 8px; }
    .row input { flex: 1; }
    button.primary, button.ghost { border-radius: 16px; padding: 6px 14px; font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1.2; cursor: pointer; white-space: nowrap; }
    button.primary { background: #0a66c2; color: #fff; border: 0; }
    button.primary:hover { background: #004182; }
    button.primary:disabled { background: #9bbbe0; cursor: default; }
    button.ghost { background: none; color: #0a66c2; border: 1px solid #0a66c2; }
    button.ghost:hover { background: #eef3f8; }
    .status { font-size: 13px; color: #666; }
    .status.error { color: #b24020; }
    .opt { border: 1px solid #e0e0e0; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .opt-head { display: flex; justify-content: space-between; font-size: 12px; color: #666; }
    .opt-head b { color: #0a66c2; font-weight: 600; }
    .opt textarea { min-height: 70px; resize: vertical; }
    .opt .row { justify-content: flex-end; }
    .flag { font-size: 12px; color: #8a5a00; background: #fff6e0; border-radius: 6px; padding: 4px 8px; }
    footer { padding: 8px 14px; border-top: 1px solid #e8e8e8; font-size: 12px; color: #666; display: flex; justify-content: space-between; }
    footer a { color: #0a66c2; cursor: pointer; }
  `;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const c of [].concat(children)) node.append(c);
    return node;
  }

  function ensurePanel() {
    if (panel) return panel;
    const host = el("div", { id: "lic-panel-host" });
    const root = host.attachShadow({ mode: "open" });
    // Todo con createElement: LinkedIn sanitiza lo que se asigna por innerHTML y se come el <style>.
    const close = el("button", { className: "x", title: "Cerrar (Esc)", textContent: "×" });
    const cfg = el("a", { className: "cfg", textContent: "Configuración" });
    root.append(
      el("style", { textContent: PANEL_CSS }),
      el("div", { className: "wrap", role: "dialog", ariaLabel: "Comentarios sugeridos" }, [
        el("header", {}, [el("strong", { textContent: "Comentarios sugeridos" }), close]),
        el("div", { className: "body" }, [
          el("div", { className: "meta" }),
          el("details", {}, [
            el("summary", { textContent: "Texto del post que leí (editable)" }),
            el("textarea", { className: "post" }),
          ]),
          el("div", { className: "row" }, [
            el("input", { className: "hint", placeholder: "Indicación opcional: ej. mencioná que lo usé en producción" }),
            el("button", { className: "primary gen", textContent: "Generar" }),
          ]),
          el("div", { className: "status", ariaLive: "polite" }),
          el("div", { className: "opts" }),
        ]),
        el("footer", {}, [el("span", { textContent: "Revisá el texto y publicalo vos." }), cfg]),
      ])
    );
    const $ = (s) => root.querySelector(s);
    panel = {
      host,
      meta: $(".meta"),
      details: $("details"),
      post: $(".post"),
      hint: $(".hint"),
      gen: $(".gen"),
      status: $(".status"),
      opts: $(".opts"),
    };
    close.addEventListener("click", closePanel);
    cfg.addEventListener("click", () => send({ type: "openOptions" }));
    panel.gen.addEventListener("click", generate);
    panel.hint.addEventListener("keydown", (e) => e.key === "Enter" && generate());
    // Que las teclas no disparen los atajos de LinkedIn mientras escribís en el panel.
    root.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") closePanel();
    });
    document.body.append(host);
    return panel;
  }

  function closePanel() {
    requestId++;
    panel?.host.remove();
    panel = null;
    current = null;
  }

  function setStatus(text, isError = false) {
    panel.status.textContent = text;
    panel.status.className = "status" + (isError ? " error" : "");
  }

  async function send(msg) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (err) {
      const reload = /context invalidated/i.test(err?.message || "");
      return { ok: false, error: reload ? "La extensión se actualizó: recargá la página." : err.message };
    }
  }

  async function openPanel({ container, commentBtn }) {
    const p = ensurePanel();
    const author = extractAuthor(container);
    const post = await extractPost(container);
    current = { container, commentBtn, author };
    p.meta.textContent = author ? `Post de ${author}` : "Post";
    p.post.value = post;
    p.hint.value = "";
    p.opts.replaceChildren();
    if (!post) {
      p.details.open = true;
      setStatus("No pude leer el texto del post. Pegalo arriba y tocá Generar.", true);
      return;
    }
    p.details.open = false;
    generate();
  }

  async function generate() {
    if (!panel || !current) return;
    const id = ++requestId;
    const post = panel.post.value.trim();
    if (!post) {
      panel.details.open = true;
      setStatus("Pegá el texto del post primero.", true);
      return;
    }
    panel.gen.disabled = true;
    panel.opts.replaceChildren();
    setStatus("Pensando comentarios…");

    const res = await send({ type: "generate", author: current.author, post, hint: panel.hint.value });
    if (id !== requestId || !panel) return; // se cerró o se pidió otra generación
    panel.gen.disabled = false;
    panel.gen.textContent = "Regenerar";
    if (!res?.ok) {
      setStatus(res?.error || "Error desconocido.", true);
      return;
    }
    setStatus("");
    for (const c of res.comments) panel.opts.append(renderOption(c));
  }

  function renderOption({ angle, text, flags = [] }) {
    const area = el("textarea", { value: text });
    const count = el("span", { textContent: `${text.length} car.` });
    area.addEventListener("input", () => (count.textContent = `${area.value.length} car.`));

    const insert = el("button", { className: "primary", textContent: "Insertar" });
    insert.addEventListener("click", async () => {
      const ctx = current;
      const result = await insertComment(ctx, area.value.trim());
      setStatus(
        {
          inserted: "Listo: quedó en la caja de comentario. Revisalo y tocá Publicar.",
          copied: "No encontré la caja de comentario; lo copié al portapapeles.",
          failed: "No encontré la caja de comentario. Copiá el texto y pegalo a mano.",
        }[result]
      );
    });
    const copy = el("button", { className: "ghost", textContent: "Copiar" });
    copy.addEventListener("click", async () => {
      await copy(area.value.trim());
      setStatus("Copiado al portapapeles.");
    });

    return el("div", { className: "opt" }, [
      el("div", { className: "opt-head" }, [el("b", { textContent: ANGLE_LABELS[angle] || angle }), count]),
      area,
      ...flagList(flags),
      el("div", { className: "row" }, [copy, insert]),
    ]);
  }

  function flagList(flags) {
    return flags.map((f) => el("div", { className: "flag", textContent: `⚠ ${f.name}`, title: f.fix || "" }));
  }

  // ---------- Ronda automática ----------
  // Junta los posts del feed a medida que cargan (sin hacer clics), le pide a Claude que elija
  // cuáles vale la pena comentar y deja los comentarios en una cola. Publicar es un clic tuyo:
  // nada sale sin que lo hayas visto.

  const seen = new Map(); // id -> { container, commentBtn }
  const pending = new Map(); // id -> post leído, esperando ronda
  let roundTimer = null;
  let roundBusy = false;
  let roundStatus = "";
  let queuePanel = null;
  let publishing = 0; // mientras haya uno en curso no se repinta la cola (perdería su estado)
  const store = chrome.storage.local;
  const today = () => new Date().toISOString().slice(0, 10);

  function postId(container) {
    const urn =
      container.getAttribute("data-urn") ||
      container.getAttribute("data-id") ||
      container.querySelector("[data-urn]")?.getAttribute("data-urn");
    if (urn) return urn;
    // Feed nuevo: el listitem del post tiene componentkey="update-card-focus{id}".
    const key = container.getAttribute("componentkey");
    return key && /^update-card/.test(key) ? `ck:${key}` : null;
  }

  function postUrl(id) {
    return /^urn:li:/.test(id) ? `https://www.linkedin.com/feed/update/${id}/` : location.href;
  }

  function parseCount(t) {
    const m = (t || "").replace(/\s/g, "").match(/^(\d[\d.,]*)([KkM])?$/);
    if (!m) return null;
    if (!m[2]) return parseInt(m[1].replace(/[.,]/g, ""), 10);
    return Math.round(parseFloat(m[1].replace(",", ".")) * (m[2] === "M" ? 1e6 : 1e3));
  }

  function commentCount(container) {
    // Feed nuevo: el número está adentro del propio botón "Comentar".
    const own = parseCount(container.licCommentBtn?.innerText.replace(/\u200b/g, ""));
    if (own != null) return own;
    for (const n of container.querySelectorAll("button, span, a")) {
      // En el feed viejo el contador puede estar después del botón: acá solo vale la regla por clases.
      if (inComments(n, container, { byPosition: false })) continue;
      const m = (n.getAttribute("aria-label") || n.innerText || "").match(/(\d[\d.,]*)\s+(comentarios?|comments?)\b/i);
      if (m) return parseInt(m[1].replace(/[.,]/g, ""), 10);
    }
    return 0;
  }

  const PROMOTED_RE = /(^|\n)\s*(Promocionado|Promoted|Patrocinado|Sponsored)\s*($|\n)/i;

  async function getData() {
    const d = await store.get(["lic_queue", "lic_done", "lic_log", "autoRound", "maxPerRound", "maxPerDay", "skipAbove", "apiKey", "provider", "geminiKey"]);
    return {
      queue: d.lic_queue || [],
      done: d.lic_done || {},
      log: d.lic_log || [],
      autoRound: d.autoRound !== false,
      maxPerRound: Number(d.maxPerRound) || 5,
      maxPerDay: Number(d.maxPerDay) || 15,
      skipAbove: Number(d.skipAbove) || 40,
      hasKey: d.provider === "gemini" ? !!d.geminiKey : !!d.apiKey,
    };
  }

  async function registerPost(container, commentBtn) {
    let id = postId(container);
    const author = extractAuthor(container);
    const text = await extractPost(container, { expand: false });
    if (!id) id = `txt:${author}:${text.slice(0, 60)}`;
    seen.set(id, { container, commentBtn });
    if (!text || text.length < 60 || PROMOTED_RE.test(container.innerText || "")) return;

    const data = await getData();
    if (data.done[id] || pending.has(id)) return;
    // No comentar a la misma persona más de una vez por semana: se nota.
    const week = Date.now() - 7 * 864e5;
    if (author && data.log.some((l) => l.author === author && l.at > week)) return;
    const comments = commentCount(container);
    if (comments > data.skipAbove) return;

    pending.set(id, { id, author, text: text.slice(0, 3000), comments, url: postUrl(id) });
    if (!data.autoRound) return;
    clearTimeout(roundTimer);
    // Espera a que se junten unos cuantos posts, o 8 segundos sin posts nuevos.
    roundTimer = setTimeout(runRound, pending.size >= 8 ? 0 : 8000);
  }

  async function runRound() {
    if (roundBusy || !pending.size) return;
    const data = await getData();
    if (!data.hasKey) return setRoundStatus("Falta la API key: abrí la configuración.");
    const published = data.log.filter((l) => new Date(l.at).toISOString().slice(0, 10) === today()).length;
    if (published >= data.maxPerDay) return setRoundStatus(`Ya publicaste ${published} hoy, tu máximo. Sigo mañana.`);

    roundBusy = true;
    const batch = [...pending.values()].slice(0, 8);
    batch.forEach((p) => pending.delete(p.id));
    setRoundStatus(`Leyendo ${batch.length} posts nuevos…`);
    const res = await send({ type: "round", posts: batch });
    roundBusy = false;

    const fresh = await getData();
    for (const p of batch) fresh.done[p.id] = Date.now();
    if (!res?.ok) {
      // Si falló la API, esos posts vuelven a la espera y se reintenta en dos minutos.
      for (const p of batch) {
        delete fresh.done[p.id];
        pending.set(p.id, p);
      }
      await store.set({ lic_done: fresh.done });
      setRoundStatus(res?.error || "Error desconocido.");
      clearTimeout(roundTimer);
      roundTimer = setTimeout(runRound, 120000);
      return;
    }
    const picks = res.picks
      .filter((p) => p.comentar && p.text)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, data.maxPerRound);
    const byId = Object.fromEntries(batch.map((p) => [p.id, p]));
    for (const p of picks) {
      const post = byId[p.id];
      fresh.queue.push({
        id: p.id, author: post.author, snippet: post.text.slice(0, 220), url: post.url,
        tipo: p.tipo, motivo: p.motivo, puntaje: p.puntaje, text: p.text, flags: p.flags,
        status: "pendiente", at: Date.now(),
      });
    }
    // Lo que quedó sin publicar de días anteriores ya no sirve: el post envejeció.
    fresh.queue = fresh.queue.filter((q) => q.status === "pendiente" && Date.now() - q.at < 36 * 3600e3);
    const keep = Object.entries(fresh.done).filter(([, t]) => Date.now() - t < 14 * 864e5);
    await store.set({ lic_queue: fresh.queue, lic_done: Object.fromEntries(keep) });
    setRoundStatus(picks.length ? `${picks.length} comentario(s) nuevo(s) de ${batch.length} posts.` : `Ninguno de estos ${batch.length} posts valía un comentario.`);
    if (pending.size) roundTimer = setTimeout(runRound, 1000);
  }

  function setRoundStatus(text) {
    roundStatus = text;
    renderQueue();
  }

  // ---------- Publicar en un clic ----------

  // El botón que publica está pegado a la caja. Nunca el "Comentar" de la barra de acciones
  // del post, que se llama igual: por eso se busca subiendo desde la caja, no en todo el post.
  function findSubmit(ctx, editor) {
    const bar = findActionBar(ctx.commentBtn);
    // Ojo: un <button> sin atributo type vale type === "submit"; por eso se mira el atributo.
    const isSubmit = (b) =>
      b.classList.contains("comments-comment-box__submit-button") ||
      /^(publicar|comentar|post|comment)$/i.test(labelOf(b)) ||
      b.getAttribute("type") === "submit";
    // Sube desde la caja: en el feed nuevo, el botón aparece recién cuando hay texto, unos
    // seis niveles arriba, al lado de los de emoji y GIF.
    for (let n = editor.parentElement, i = 0; n && n !== ctx.container && i < 10; n = n.parentElement, i++) {
      if (bar && n.contains(bar)) break;
      const candidates = [...n.querySelectorAll("button")].filter(
        (b) => isVisible(b) && b !== ctx.commentBtn && !b.closest(".lic-btn") && isSubmit(b)
      );
      // Si hay varios, gana el que se llama "Publicar"/"Comment" antes que un type=submit cualquiera.
      const found = candidates.find((b) => /^(publicar|comentar|post|comment)$/i.test(labelOf(b))) || candidates[0];
      if (found) return found;
    }
    return null;
  }

  async function publish(item, text) {
    const ctx = seen.get(item.id);
    if (!ctx || !document.contains(ctx.container)) {
      await navigator.clipboard.writeText(text);
      window.open(item.url, "_blank");
      return { ok: false, msg: "El post ya no está en esta página: copié el comentario y lo abrí en otra pestaña." };
    }
    const result = await insertComment(ctx, text);
    if (result !== "inserted") {
      return { ok: false, msg: result === "copied" ? "No encontré la caja de comentario; lo copié al portapapeles." : "No encontré la caja de comentario. Abrí el post y pegalo a mano." };
    }
    const editor = findEditor(ctx.container);
    const submit = editor && (await waitFor(() => {
      const b = findSubmit(ctx, editor);
      return b && !b.disabled ? b : null;
    }));
    if (!submit) return { ok: false, msg: "Quedó en la caja de comentario: tocá Publicar en LinkedIn." };
    submit.click();
    const cleared = await waitFor(() => !document.contains(editor) || !editor.innerText.trim(), 6000);
    if (!cleared) return { ok: false, msg: "Toqué Publicar pero no sé si salió: revisá el post." };
    return { ok: true };
  }

  async function updateItem(id, patch, logAuthor) {
    const d = await getData();
    const queue = d.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)).filter((q) => q.status === "pendiente");
    const log = logAuthor !== undefined ? [...d.log, { author: logAuthor, at: Date.now() }].slice(-300) : d.log;
    await store.set({ lic_queue: queue, lic_log: log });
  }

  // ---------- Panel de la cola ----------

  const QUEUE_CSS = PANEL_CSS + `
    .launcher { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; border: 0; border-radius: 24px;
      padding: 10px 16px; background: #0a66c2; color: #fff; font: 600 14px/1 -apple-system, system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,.25); cursor: pointer; }
    .launcher:hover { background: #004182; }
    .card { border: 1px solid #e0e0e0; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    .who { font-weight: 600; font-size: 13px; }
    .snip { font-size: 12px; color: #555; max-height: 4.2em; overflow: hidden; }
    .why { font-size: 12px; color: #666; }
    .chip { display: inline-block; background: #eef3f8; color: #0a66c2; border-radius: 10px; padding: 1px 8px; font-size: 11px; font-weight: 600; margin-right: 6px; }
    .card textarea { min-height: 80px; resize: vertical; }
    .card .row { justify-content: flex-end; }
    .msg { font-size: 12px; color: #b24020; }
    .empty { color: #666; font-size: 13px; padding: 8px 0; }
    .tools { display: flex; gap: 8px; flex-wrap: wrap; }
  `;

  function ensureQueueHost() {
    if (queuePanel) return queuePanel;
    const host = el("div", { id: "lic-queue-host" });
    const root = host.attachShadow({ mode: "open" });
    root.append(el("style", { textContent: QUEUE_CSS }), el("div", { className: "slot" }));
    root.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") toggleQueue(false);
    });
    document.body.append(host);
    queuePanel = { host, root, slot: root.querySelector(".slot"), open: false };
    return queuePanel;
  }

  function toggleQueue(open) {
    const q = ensureQueueHost();
    q.open = open ?? !q.open;
    renderQueue();
  }

  async function renderQueue() {
    const q = ensureQueueHost();
    const d = await getData();
    send({ type: "badge", count: d.queue.length });
    if (!q.open) {
      const btn = el("button", { className: "launcher", textContent: d.queue.length ? `💬 ${d.queue.length} para comentar` : "💬 Ronda" });
      btn.addEventListener("click", () => toggleQueue(true));
      q.slot.replaceChildren(btn);
      return;
    }
    // No repintar mientras escribís en una tarjeta ni mientras se publica una.
    if (q.root.activeElement?.tagName === "TEXTAREA" || publishing) return;

    const published = d.log.filter((l) => new Date(l.at).toISOString().slice(0, 10) === today()).length;
    const close = el("button", { className: "x", title: "Cerrar (Esc)", textContent: "×" });
    close.addEventListener("click", () => toggleQueue(false));

    const more = el("button", { className: "ghost", textContent: "Buscar más posts" });
    more.addEventListener("click", loadMore);
    const pause = el("button", { className: "ghost", textContent: d.autoRound ? "Pausar ronda" : "Reanudar ronda" });
    pause.addEventListener("click", async () => {
      await store.set({ autoRound: !d.autoRound });
      if (!d.autoRound) runRound();
      renderQueue();
    });
    const cfg = el("a", { className: "cfg", textContent: "Configuración" });
    cfg.addEventListener("click", () => send({ type: "openOptions" }));

    const cards = d.queue.length
      ? d.queue.map(renderCard)
      : [el("div", { className: "empty", textContent: d.autoRound ? "Todavía no hay comentarios. Bajá por el feed o tocá Buscar más posts: los leo solo." : "La ronda está en pausa." })];

    q.slot.replaceChildren(
      el("div", { className: "wrap", role: "dialog", ariaLabel: "Ronda de comentarios" }, [
        el("header", {}, [el("strong", { textContent: "Ronda de comentarios" }), el("span", { className: "meta", textContent: `hoy: ${published}/${d.maxPerDay}` }), close]),
        el("div", { className: "body" }, [
          el("div", { className: "tools" }, [more, pause]),
          el("div", { className: "status", ariaLive: "polite", textContent: roundBusy ? "Pensando comentarios…" : roundStatus }),
          ...cards,
        ]),
        el("footer", {}, [el("span", { textContent: "Nada se publica sin tu clic." }), cfg]),
      ])
    );
  }

  function renderCard(item) {
    const area = el("textarea", { value: item.text });
    const msg = el("div", { className: "msg" });
    const go = el("button", { className: "ghost", textContent: "Ver post" });
    go.addEventListener("click", () => {
      const ctx = seen.get(item.id);
      if (ctx && document.contains(ctx.container)) ctx.container.scrollIntoView({ block: "center", behavior: "smooth" });
      else window.open(item.url, "_blank");
    });
    const skip = el("button", { className: "ghost", textContent: "Descartar" });
    skip.addEventListener("click", async () => {
      await updateItem(item.id, { status: "descartado" });
      renderQueue();
    });
    const pub = el("button", { className: "primary", textContent: "Publicar" });
    pub.addEventListener("click", async () => {
      const text = area.value.trim();
      if (!text) return;
      pub.disabled = true;
      pub.textContent = "Publicando…";
      let r;
      publishing++;
      try {
        r = await publish(item, text);
      } catch (err) {
        r = { ok: false, msg: `Algo falló: ${err.message}` };
      } finally {
        publishing--;
      }
      if (r.ok) {
        await updateItem(item.id, { status: "publicado" }, item.author || "");
        area.blur();
        renderQueue();
      } else {
        pub.disabled = false;
        pub.textContent = "Publicar";
        msg.textContent = r.msg;
      }
    });
    return el("div", { className: "card" }, [
      el("div", { className: "who", textContent: item.author || "Post" }),
      el("div", { className: "snip", textContent: item.snippet }),
      el("div", { className: "why" }, [el("span", { className: "chip", textContent: item.tipo.replace(/_/g, " ") }), item.motivo]),
      area,
      ...flagList(item.flags || []),
      msg,
      el("div", { className: "row" }, [go, skip, pub]),
    ]);
  }

  // Lo pedís vos: baja unas pantallas para que LinkedIn cargue más posts, y vuelve.
  async function loadMore() {
    const start = window.scrollY;
    setRoundStatus("Cargando más posts…");
    for (let i = 0; i < 4; i++) {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
      await sleep(1200);
    }
    window.scrollTo({ top: start, behavior: "smooth" });
    setRoundStatus(pending.size ? `${pending.size} posts nuevos para leer.` : "No aparecieron posts nuevos.");
    clearTimeout(roundTimer);
    roundTimer = setTimeout(runRound, 500);
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lic_queue) renderQueue();
  });
  renderQueue();
})();
