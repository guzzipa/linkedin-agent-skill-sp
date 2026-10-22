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
  const ctx = vm.createContext({ ...web, chrome, fetch, navigator: { userAgent: "test" } });
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

test("marca los comentarios que cuentan una experiencia del usuario, para que la confirme", async () => {
  const invented = JSON.stringify({ posts: [{ id: "p1", comentar: true, puntaje: 8, motivo: "m", tipo: "comprobante", comentario: "En Ualá lo resolvimos con una capa de features centralizada." }] });
  const opinion = JSON.stringify({ posts: [{ id: "p1", comentar: true, puntaje: 8, motivo: "m", tipo: "dato", comentario: "La velocidad sin una definición común de cliente activo es deuda." }] });
  let reply = invented;
  const bg = boot({ ...BASE, provider: "compat" }, () => compatOk(reply));
  let res = await bg.send({ type: "round", posts: POSTS });
  assert.match(res.picks[0].flags[0].name, /Cuenta una experiencia tuya \("lo resolvimos"\)/);
  reply = opinion;
  res = await bg.send({ type: "round", posts: POSTS });
  assert.equal(res.picks[0].flags.some((f) => /experiencia tuya/.test(f.name)), false);
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
