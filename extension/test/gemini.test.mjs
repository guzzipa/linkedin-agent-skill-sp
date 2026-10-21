// Tests del cliente de Gemini con fetch simulado: qué se manda y cómo se lee la respuesta.
// Las formas de pedido, respuesta y error salen de llamadas reales a la Interactions API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { callGemini, GeminiError } from "../src/gemini.js";
import { ROUND_SCHEMA } from "../src/prompt.js";

function mockFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return calls;
}

const reply = (text, extra = {}) => ({
  status: "completed",
  steps: [
    { type: "thought", signature: "abc" },
    { type: "model_output", content: [{ type: "text", text }] },
  ],
  object: "interaction",
  model: "gemini-3.8-flash",
  ...extra,
});

test("arma el pedido: modelo, key en el header, system, esquema y store=false", async () => {
  const calls = mockFetch(200, reply('{"posts":[]}'));
  const res = await callGemini({ apiKey: "k-123", model: "gemini-3.8-flash", system: "SYS", user: "USR", schema: ROUND_SCHEMA });
  const [c] = calls;
  assert.match(c.url, /\/v1beta\/interactions$/);
  assert.equal(c.init.headers["x-goog-api-key"], "k-123");
  assert.equal(c.url.includes("k-123"), false, "la key no va en la URL");
  assert.equal(c.body.model, "gemini-3.8-flash");
  assert.equal(c.body.store, false);
  assert.equal(c.body.system_instruction, "SYS");
  assert.equal(c.body.input, "USR");
  assert.equal(c.body.response_format.mime_type, "application/json");
  assert.deepEqual(c.body.response_format.schema, ROUND_SCHEMA);
  assert.deepEqual(res.data, { posts: [] });
  assert.equal(res.model, "gemini-3.8-flash");
});

test("ignora los pasos de pensamiento y desenvuelve ```json", async () => {
  mockFetch(200, reply('```json\n{"ok":true}\n```'));
  const res = await callGemini({ apiKey: "k", model: "m", system: "s", user: "u", schema: { type: "object" } });
  assert.deepEqual(res.data, { ok: true });
});

test("errores con mensajes claros", async () => {
  // Así responde la API real a una key inválida: el error viene dentro de un array.
  mockFetch(401, [{ error: { code: 401, message: "API key not valid. Please pass a valid API key.", status: "UNAUTHENTICATED" } }]);
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), (e) => e instanceof GeminiError && /inválida/.test(e.message));
  mockFetch(404, { error: { message: "Model 'x' not found.", code: "not_found" } });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), /no existe/);
  mockFetch(429, { error: { message: "Resource exhausted" } });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), /límite de uso/);
  mockFetch(200, { status: "incomplete", steps: [{ type: "thought" }] });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u", schema: {} }), /estado: incomplete/);
});

test("lee cuánto falta para que se libere el límite", async () => {
  const { retryAfterMs, humanWait } = await import("../src/gemini.js");
  assert.equal(retryAfterMs([{ error: { message: "Please retry in 13h43m30s or upgrade" } }]), (13 * 3600 + 43 * 60 + 30) * 1000);
  assert.equal(retryAfterMs({ error: { message: "x", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "42s" }] } }), 42000);
  assert.equal(retryAfterMs({ error: { message: "sin dato" } }), 0);
  assert.equal(humanWait((13 * 3600 + 43 * 60 + 30) * 1000), "13 h 44 min");
  mockFetch(429, { error: { message: "limit: 20 requests per day on Free Tier. Please retry in 2h0m0s" } });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), (e) => e.retryAfterMs === 7200000 && /Se libera en 2 h/.test(e.message));
});
