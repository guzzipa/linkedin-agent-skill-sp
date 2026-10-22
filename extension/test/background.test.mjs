// Test de integración del service worker real: se compila src/background.js como lo usa
// Chrome y se corre con chrome.* y fetch simulados. Escenarios del respaldo entre IAs.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import * as esbuild from "esbuild";
import { join } from "node:path";

const { outputFiles } = await esbuild.build({
  entryPoints: [join(import.meta.dirname, "..", "src", "background.js")],
  bundle: true, format: "iife", platform: "browser", target: "chrome120", write: false,
  define: { __BUILD_VERSION__: JSON.stringify("test-1") },
});
const CODE = outputFiles[0].text;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

// Respuestas reales de cada API, tomadas de las pruebas en vivo.
const ANTHROPIC_NO_CREDIT = () => json(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } });
const GEMINI_OVERLOADED = () => json(503, { error: { message: "gemini-3.8-flash is currently experiencing high demand, spikes in demand are usually temporary. Please try again later.", code: "service_unavailable" } });
const GEMINI_DAILY_LIMIT = () => json(429, { error: { code: 429, message: "Rate limit exceeded for model gemini-3.8-flash (limit: 20 requests per day on Free Tier). Please retry in 13h43m30s or upgrade your tier at https://ai.dev/rate-limit." } });
const geminiOk = (model, text) => json(200, { status: "completed", model, steps: [{ type: "thought" }, { type: "model_output", content: [{ type: "text", text }] }] });
const compatOk = (text) => json(200, { model: "deepseek/deepseek-chat:free", choices: [{ message: { content: text }, finish_reason: "stop" }] });

const ROUND = JSON.stringify({ posts: [{ id: "p1", comentar: true, puntaje: 8, motivo: "m", tipo: "dato", comentario: "Lo vimos igual en producción." }] });

function boot(settings, router) {
  const store = { ...settings };
  let handler;
  const calls = [];
  const chrome = {
    storage: { local: {
      get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
      set: async (o) => Object.assign(store, structuredClone(o)),
    } },
    runtime: { onMessage: { addListener: (fn) => (handler = fn) }, openOptionsPage: async () => {} },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, onClicked: { addListener() {} } },
  };
  const fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : {};
    calls.push({ host: new URL(String(url)).host, model: body.model });
    return router(String(url), body);
  };
  // Lo que un service worker de Chrome tiene a mano y el SDK de Anthropic usa.
  const web = { Response, Headers, Request, URL, URLSearchParams, FormData, Blob, File, AbortController, AbortSignal,
    ReadableStream, TextEncoder, TextDecoder, EventTarget, Event, crypto, structuredClone, queueMicrotask,
    setTimeout, clearTimeout, setInterval, clearInterval, console };
  const ctx = vm.createContext({ ...web, chrome, fetch, navigator: { userAgent: "test" }, __LIC_NO_RETRY_DELAY__: true });
  vm.runInContext(CODE, ctx);
  const send = (msg) => new Promise((resolve) => handler(msg, {}, resolve));
  return { send, store, calls };
}

const POSTS = [{ id: "p1", author: "A", text: "x".repeat(80), comments: 2 }];
const BASE = { persona: "p", topics: "t", apiKey: "sk-ant-x", geminiKey: "AQ.x", compatKey: "sk-or-x", compatPreset: "openrouter", compatBaseUrl: "https://openrouter.ai/api/v1", compatModel: "deepseek/deepseek-chat:free" };

test("Claude sin saldo → sigue con Gemini, y Claude queda en pausa", async () => {
  const bg = boot({ ...BASE, provider: "anthropic", fallback1: "gemini", fallback2: "compat" }, (url, body) =>
    url.includes("anthropic") ? ANTHROPIC_NO_CREDIT() : geminiOk(body.model, ROUND));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.picks[0].text, "Lo vimos igual en producción.");
  assert.match(res.note, /con Gemini, porque Claude no tiene saldo/);
  assert.ok(bg.store.lic_cooldowns.anthropic > Date.now() + 5 * 3600e3, "pausa de unas 6 h");
});

test("Gemini 3.8 Flash agotado → Flash-Lite, sin cambiar de proveedor; la próxima ronda va directo a Lite", async () => {
  const bg = boot({ ...BASE, provider: "gemini", geminiModel: "gemini-3.8-flash", fallback1: "compat" }, (url, body) =>
    body.model === "gemini-3.8-flash" ? GEMINI_DAILY_LIMIT() : geminiOk(body.model, ROUND));
  let res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.match(res.note, /Gemini Flash-Lite, porque Gemini 3.8 Flash llegó a su límite/);
  const pause = bg.store.lic_model_pauses["gemini:gemini-3.8-flash"];
  assert.ok(pause > Date.now() + 13 * 3600e3, "la pausa sigue lo que dijo la API (13 h 43 min)");
  bg.calls.length = 0;
  res = await bg.send({ type: "round", posts: POSTS });
  assert.deepEqual(bg.calls.map((c) => c.model), ["gemini-3.5-flash-lite"], "no gasta un pedido en 3.8 Flash");
  assert.match(res.note, /3.8 Flash está en pausa/);
});

test("Gemini agotado del todo → OpenRouter, con el nombre correcto en el aviso", async () => {
  const bg = boot({ ...BASE, provider: "gemini", geminiModel: "gemini-3.8-flash", fallback1: "compat" }, (url) =>
    url.includes("googleapis") ? GEMINI_DAILY_LIMIT() : compatOk(ROUND));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.match(res.note, /con OpenRouter, porque Gemini llegó al límite de uso/);
  assert.deepEqual(bg.calls.map((c) => c.host), ["generativelanguage.googleapis.com", "generativelanguage.googleapis.com", "openrouter.ai"]);
});

test("si fallan todas, el error dice qué pasó con cada una, en castellano", async () => {
  const bg = boot({ ...BASE, provider: "anthropic", fallback1: "compat" }, (url) =>
    url.includes("anthropic") ? ANTHROPIC_NO_CREDIT() : json(429, { error: { message: "Rate limit exceeded: free-models-per-day" } }, { "retry-after": "3600" }));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, false);
  assert.match(res.error, /Claude: Tu cuenta de la API de Anthropic no tiene saldo/);
  assert.match(res.error, /OpenRouter: Llegaste al límite de uso de OpenRouter \(los modelos gratis/);
  assert.ok(bg.store.lic_cooldowns.compat > Date.now() + 55 * 60e3, "respeta Retry-After de 1 h");
});

test("un respaldo sin key se saltea", async () => {
  const bg = boot({ ...BASE, geminiKey: "", provider: "anthropic", fallback1: "gemini", fallback2: "compat" }, (url) =>
    url.includes("anthropic") ? ANTHROPIC_NO_CREDIT() : compatOk(ROUND));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.equal(bg.calls.some((c) => c.host.includes("googleapis")), false);
});

test("Probar conexión prueba todas y reporta cada una", async () => {
  const bg = boot({}, (url, body) => {
    if (url.includes("anthropic")) return ANTHROPIC_NO_CREDIT();
    if (url.includes("googleapis")) return body.model === "gemini-3.8-flash" ? GEMINI_DAILY_LIMIT() : geminiOk(body.model, '{"ok":true}');
    return compatOk('{"ok":true}');
  });
  const res = await bg.send({ type: "test", providers: [
    { provider: "anthropic", apiKey: "sk-ant-x", model: "claude-opus-5-5" },
    { provider: "gemini", apiKey: "AQ.x", model: "gemini-3.8-flash" },
    { provider: "compat", apiKey: "sk-or-x", model: "m", baseUrl: "https://openrouter.ai/api/v1", preset: "openrouter" },
  ] });
  assert.equal(res.ok, true);
  const [claude, gemini, compat] = res.results;
  assert.equal(claude.ok, false);
  assert.match(claude.error, /no tiene saldo/);
  assert.equal(gemini.ok, true);
  assert.match(gemini.note, /se libera en 13 h 44 min; mientras tanto uso Flash-Lite/);
  assert.equal(compat.ok, true);
});

test("marca las anécdotas que no están en el perfil, y deja pasar las que sí", async () => {
  const mk = (c) => JSON.stringify({ posts: [{ id: "p1", comentar: true, puntaje: 8, motivo: "m", tipo: "comprobante", comentario: c }] });
  let reply;
  const bg = boot({ ...BASE, persona: "CDAO en Ualá. Desplegué GenAI con Gemini en soporte al cliente.", provider: "compat" }, () => compatOk(reply));
  const EN_POST = [{ id: "p1", author: "A", comments: 2, text: "The board approves the budget, the data team builds a model, and nobody owns the business metric. Ownership beats architecture." }];
  reply = mk("At Ualá we learned that naming a business owner is not enough: they need a seat in the credit committee.");
  let res = await bg.send({ type: "round", posts: EN_POST });
  assert.match(res.picks[0].flags[0].name, /Cuenta una experiencia tuya que no está en tu perfil \("At Ualá we learned/);
  reply = mk("En Ualá desplegamos GenAI con Gemini en soporte al cliente y la base de conocimiento fue lo difícil.");
  res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.picks[0].flags.some((f) => /experiencia tuya/.test(f.name)), false, "está respaldado por el perfil");
  reply = mk("La velocidad sin una definición común de cliente activo es deuda.");
  res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.picks[0].flags.length, 0, "una opinión no se marca");
});

test("ping devuelve la versión del service worker (la configuración la usa para detectar una versión vieja)", async () => {
  const bg = boot({}, () => json(500, {}));
  assert.equal(JSON.stringify(await bg.send({ type: "ping" })), JSON.stringify({ ok: true, version: "test-1" }));
});

test("un service worker VIEJO no conoce ping: no responde, y eso es lo que delata la versión vieja", async () => {
  const bg = boot({}, () => json(500, {}));
  let answered = false;
  // handler devuelve false para tipos desconocidos: sendResponse nunca se llama.
  const handled = await Promise.race([bg.send({ type: "tipo-que-no-existe" }).then(() => (answered = true)), new Promise((r) => setTimeout(() => r("sin respuesta"), 50))]);
  assert.equal(handled, "sin respuesta");
  assert.equal(answered, false);
});

test("Gemini 3.8 Flash saturado (503) → Flash-Lite, sin cambiar de proveedor, con pausa corta", async () => {
  const bg = boot({ ...BASE, provider: "gemini", geminiModel: "gemini-3.8-flash", fallback1: "compat" }, (url, body) =>
    body.model === "gemini-3.8-flash" ? GEMINI_OVERLOADED() : geminiOk(body.model, ROUND));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.match(res.note, /Gemini Flash-Lite, porque Gemini 3.8 Flash está saturado/);
  const pause = bg.store.lic_model_pauses["gemini:gemini-3.8-flash"];
  assert.ok(pause > Date.now() && pause < Date.now() + 3 * 60e3, "pausa de 2 minutos, no de horas");
  assert.equal(bg.calls.some((c) => c.host.includes("openrouter")), false, "no hace falta ir a otro proveedor");
});

test("Probar conexión con Gemini saturado usa Flash-Lite y lo explica", async () => {
  const bg = boot({}, (url, body) => (body.model === "gemini-3.8-flash" ? GEMINI_OVERLOADED() : geminiOk(body.model, '{"ok":true}')));
  const res = await bg.send({ type: "test", providers: [{ provider: "gemini", apiKey: "AQ.x", model: "gemini-3.8-flash" }] });
  assert.equal(res.results[0].ok, true);
  assert.match(res.results[0].note, /está saturado en este momento \(error 503\); mientras tanto uso Flash-Lite/);
});

test("los errores 5xx muestran qué dijo la API, y un modelo inexistente se explica", async () => {
  let bg = boot({}, () => GEMINI_OVERLOADED());
  let res = await bg.send({ type: "test", providers: [{ provider: "gemini", apiKey: "AQ.x", model: "gemini-3.5-flash-lite" }] });
  assert.match(res.results[0].error, /está con problemas \(503: gemini-3.8-flash is currently experiencing high demand/);
  bg = boot({}, () => json(400, { error: { message: "deepseek/deepseek-chat:free is not a valid model ID", code: 400 } }));
  res = await bg.send({ type: "test", providers: [{ provider: "compat", apiKey: "sk-or-x", model: "deepseek/deepseek-chat:free", baseUrl: "https://openrouter.ai/api/v1", preset: "openrouter" }] });
  assert.match(res.results[0].error, /no encontró ese modelo \(puede que ya no exista/);
});

test("un 503 pasajero de Gemini se reintenta y se recupera sin cambiar de modelo", async () => {
  let n = 0;
  const bg = boot({ ...BASE, provider: "gemini", geminiModel: "gemini-3.5-flash-lite" }, (url, body) => (++n === 1 ? GEMINI_OVERLOADED() : geminiOk(body.model, ROUND)));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.note, "");
  assert.deepEqual(bg.calls.map((c) => c.model), ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]);
});

test("si el 503 no se va, se reintenta dos veces y recién ahí se baja de modelo", async () => {
  const bg = boot({ ...BASE, provider: "gemini", geminiModel: "gemini-3.8-flash" }, (url, body) =>
    body.model === "gemini-3.8-flash" ? GEMINI_OVERLOADED() : geminiOk(body.model, ROUND));
  const res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.ok, true, res.error);
  assert.deepEqual(bg.calls.map((c) => c.model), ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]);
});

test("marca las cifras que no están en el perfil ni en el post (las que inventan los modelos chicos)", async () => {
  const reply = (c) => JSON.stringify({ posts: [{ id: "p1", comentar: true, puntaje: 8, motivo: "m", tipo: "dato", comentario: c }] });
  const post = [{ id: "p1", author: "A", comments: 2, text: "Resolvimos el 38% de los tickets sin intervención en 6 semanas. " + "x".repeat(60) }];
  let text = "Con el 38% de automatización, el cuello de botella es el contenido.";
  const bg = boot({ ...BASE, persona: "CDAO en Ualá. UalaScore con 20.000 variables.", provider: "compat" }, () => compatOk(reply(text)));
  let res = await bg.send({ type: "round", posts: post });
  assert.equal(res.picks[0].flags.some((f) => /cifra/.test(f.name)), false, "el 38% está en el post");
  text = "Pasamos de 20.000 variables a un modelo que ahorró el 70% del esfuerzo.";
  res = await bg.send({ type: "round", posts: post });
  const flag = res.picks[0].flags.find((f) => /cifra/.test(f.name));
  assert.match(flag.name, /una cifra .*\(70%\)/, "20.000 es del perfil, 70% no");
  text = "Desde 2023 lo vemos en 3 de cada 4 equipos.";
  res = await bg.send({ type: "round", posts: post });
  assert.equal(res.picks[0].flags.some((f) => /cifra/.test(f.name)), false, "los años y los números de una cifra no se marcan");
});

const EN_POSTS = [{ id: "p1", author: "Tom, Partner at a VC fund", comments: 3, text: "Most AI strategies fail the same way: the board approves a budget, the data team builds a model, and nobody owns the business metric it was supposed to move. Ownership beats architecture." }];
const ES_POSTS = [{ id: "p1", author: "Ana, CEO", comments: 3, text: "Después de dieciocho meses con un equipo de datos centralizado, lo partimos en squads por dominio. La velocidad subió, pero cada squad define cliente activo a su manera." }];
const roundWith = (c) => JSON.stringify({ posts: [{ id: "p1", comentar: true, puntaje: 8, motivo: "m", tipo: "dato", comentario: c }] });

test("el idioma de cada post viaja en el pedido, y la regla gana sobre el perfil en castellano", async () => {
  const first = [];
  const bg = boot({ ...BASE, provider: "compat" }, (url, body) => {
    first.push(body.messages);
    return compatOk(roundWith(first.length === 1
      ? "Ownership beats architecture, and the owner has to sit where the metric is reviewed."
      : "Cada squad define cliente activo a su manera, y eso rompe cualquier métrica compartida."));
  });
  await bg.send({ type: "round", posts: EN_POSTS });
  assert.match(first[0][1].content, /<idioma_del_comentario>inglés<\/idioma_del_comentario>/);
  assert.match(first[0][0].content, /el comentario va en el idioma que dice <idioma_del_comentario>/);
  await bg.send({ type: "round", posts: ES_POSTS });
  assert.match(first[1][1].content, /<idioma_del_comentario>español<\/idioma_del_comentario>/);
  assert.equal(first.length, 2, "las dos respuestas ya estaban en el idioma correcto: sin traducción");
});

test("post en inglés con comentario en castellano: se traduce solo, con una segunda llamada", async () => {
  const sent = [];
  const bg = boot({ ...BASE, provider: "compat", tone: "Voseo rioplatense." }, (url, body) => {
    sent.push(body.messages[1].content);
    return sent.length === 1
      ? compatOk(roundWith("El dueño de la métrica tiene que sentarse donde se revisa, si no el modelo se muere después del lanzamiento."))
      : compatOk(JSON.stringify({ textos: ["The metric's owner has to sit where it is reviewed, or the model dies after launch."] }));
  });
  const res = await bg.send({ type: "round", posts: EN_POSTS });
  assert.equal(res.ok, true, res.error);
  assert.match(res.picks[0].text, /^The metric's owner has to sit where it is reviewed/);
  assert.equal(res.picks[0].translated, true);
  assert.equal(res.picks[0].flags.some((f) => /idioma equivocado/.test(f.name)), false);
  assert.equal(sent.length, 2);
  assert.match(sent[1], /<idioma>inglés<\/idioma>/);
});

test("si ya está en el idioma correcto no hay segunda llamada", async () => {
  let calls = 0;
  const bg = boot({ ...BASE, provider: "compat" }, () => (calls++, compatOk(roundWith("Ownership beats architecture, and the owner has to sit where the metric is reviewed."))));
  const res = await bg.send({ type: "round", posts: EN_POSTS });
  assert.equal(calls, 1);
  assert.equal(res.picks[0].translated, false);
});

test("si la traducción falla, el comentario queda con una advertencia en vez de perderse", async () => {
  let n = 0;
  const bg = boot({ ...BASE, provider: "compat" }, () => (++n === 1 ? compatOk(roundWith("El dueño de la métrica tiene que sentarse donde se revisa, si no el modelo se muere.")) : json(500, { error: { message: "boom" } })));
  const res = await bg.send({ type: "round", posts: EN_POSTS });
  assert.equal(res.ok, true);
  assert.match(res.picks[0].text, /^El dueño de la métrica/);
  assert.match(res.picks[0].flags[0].name, /idioma equivocado \(el post pide inglés\)/);
});

test("si el usuario fija el idioma, manda sobre el del post", async () => {
  const sent = [];
  const bg = boot({ ...BASE, provider: "compat", language: "es" }, (url, body) => (sent.push(body.messages[1].content), compatOk(roundWith("El dueño de la métrica tiene que sentarse donde se revisa el resultado."))));
  const res = await bg.send({ type: "round", posts: EN_POSTS });
  assert.match(sent[0], /<idioma_del_comentario>español/);
  assert.equal(sent.length, 1, "ya está en español: no se traduce");
  assert.equal(res.picks[0].translated, false);
});

test("✨ Sugerir: los 3 comentarios en castellano de un post en inglés se traducen en una sola llamada", async () => {
  const sent = [];
  const gen = JSON.stringify({ comments: [
    { angle: "aporte", text: "El dueño de la métrica tiene que estar donde se revisa el resultado." },
    { angle: "pregunta", text: "¿Quién es el dueño de la métrica cuando el modelo falla en producción?" },
    { angle: "experiencia", text: "Los modelos que se quedaron sin dueño de negocio murieron después del lanzamiento." },
  ] });
  const bg = boot({ ...BASE, provider: "compat" }, (url, body) => {
    sent.push(body);
    return sent.length === 1 ? compatOk(gen) : compatOk(JSON.stringify({ textos: [
      "The metric's owner has to sit where results are reviewed.",
      "Who owns the metric when the model fails in production?",
      "Models left without a business owner died after launch.",
    ] }));
  });
  const res = await bg.send({ type: "generate", author: "Tom", post: EN_POSTS[0].text });
  assert.equal(res.ok, true, res.error);
  assert.equal(sent.length, 2, "una traducción para los tres, no tres");
  assert.equal(JSON.stringify(res.comments.map((c) => c.text.split(" ")[0])), JSON.stringify(["The", "Who", "Models"]));
});
