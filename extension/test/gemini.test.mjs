// Tests del cliente de Gemini con fetch simulado: qué se manda y cómo se lee la respuesta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { callGemini, toGeminiSchema, GeminiError } from "../src/gemini.js";
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
  candidates: [{ content: { parts: [{ text: "pensando…", thought: true }, { text }] }, finishReason: "STOP", ...extra }],
  modelVersion: "gemini-3.8-flash",
});

test("el esquema de la ronda pasa al formato de Gemini", () => {
  const g = toGeminiSchema(ROUND_SCHEMA);
  assert.equal(g.type, "OBJECT");
  assert.equal(g.properties.posts.type, "ARRAY");
  const item = g.properties.posts.items;
  assert.equal(item.properties.puntaje.type, "INTEGER");
  assert.deepEqual(item.propertyOrdering, ["id", "comentar", "puntaje", "motivo", "tipo", "comentario"]);
  assert.ok(item.properties.tipo.enum.includes("mirada_local"));
  assert.equal(JSON.stringify(g).includes("additionalProperties"), false);
});

test("arma el pedido: modelo en la URL, key en el header, system y JSON", async () => {
  const calls = mockFetch(200, reply('{"posts":[]}'));
  const res = await callGemini({ apiKey: "k-123", model: "gemini-3.8-flash", system: "SYS", user: "USR", schema: ROUND_SCHEMA });
  const [c] = calls;
  assert.match(c.url, /models\/gemini-3\.8-flash:generateContent$/);
  assert.equal(c.init.headers["x-goog-api-key"], "k-123");
  assert.equal(c.url.includes("k-123"), false, "la key no va en la URL");
  assert.equal(c.body.systemInstruction.parts[0].text, "SYS");
  assert.equal(c.body.contents[0].parts[0].text, "USR");
  assert.equal(c.body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(res.data, { posts: [] });
  assert.equal(res.model, "gemini-3.8-flash");
});

test("ignora las partes de pensamiento y desenvuelve ```json", async () => {
  mockFetch(200, reply('```json\n{"ok":true}\n```'));
  const res = await callGemini({ apiKey: "k", model: "m", system: "s", user: "u", schema: { type: "object" } });
  assert.deepEqual(res.data, { ok: true });
});

test("errores con mensajes claros", async () => {
  mockFetch(400, { error: { message: "API key not valid. Please pass a valid API key." } });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), (e) => e instanceof GeminiError && /inválida/.test(e.message));
  mockFetch(429, { error: { message: "Resource exhausted" } });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), /límite de uso/);
  mockFetch(200, reply("", { finishReason: "MAX_TOKENS" }));
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u", schema: {} }), /se cortó/);
  mockFetch(200, { promptFeedback: { blockReason: "SAFETY" } });
  await assert.rejects(callGemini({ apiKey: "x", model: "m", system: "s", user: "u" }), /bloqueó/);
});
