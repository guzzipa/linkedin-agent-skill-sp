// Tests del cliente compatible con OpenAI (DeepSeek, OpenRouter, ...) con fetch simulado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { callCompat, CompatError, jsonInstruction } from "../src/openai-compat.js";
import { ROUND_SCHEMA } from "../src/prompt.js";

function mockFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return calls;
}
const reply = (content, extra = {}) => ({ model: "deepseek-flash", choices: [{ message: { content }, finish_reason: "stop", ...extra }] });
const base = { apiKey: "sk-1", baseUrl: "https://api.deepseek.com/", model: "deepseek-flash", system: "SYS", user: "USR", label: "DeepSeek" };

test("arma el pedido: /chat/completions, Bearer, json_object y el esquema en el prompt", async () => {
  const calls = mockFetch(200, reply('{"posts":[]}'));
  const res = await callCompat({ ...base, schema: ROUND_SCHEMA });
  const [c] = calls;
  assert.equal(c.url, "https://api.deepseek.com/chat/completions");
  assert.equal(c.init.headers.Authorization, "Bearer sk-1");
  assert.deepEqual(c.body.response_format, { type: "json_object" });
  assert.equal(c.body.messages[0].role, "system");
  assert.match(c.body.messages[0].content, /^SYS/);
  assert.match(c.body.messages[0].content, /json/); // DeepSeek lo exige para json_object
  assert.ok(c.body.messages[0].content.includes('"comentario"'), "el esquema viaja en el prompt");
  assert.equal(c.body.messages[1].content, "USR");
  assert.deepEqual(res.data, { posts: [] });
});

test("acepta JSON envuelto en ``` y valida los campos requeridos", async () => {
  mockFetch(200, reply('```json\n{"posts":[]}\n```'));
  assert.deepEqual((await callCompat({ ...base, schema: ROUND_SCHEMA })).data, { posts: [] });
  mockFetch(200, reply('{"otra":1}'));
  await assert.rejects(callCompat({ ...base, schema: ROUND_SCHEMA }), /sin posts/);
});

test("errores con mensajes claros", async () => {
  mockFetch(401, { error: { message: "Authentication Fails" } });
  await assert.rejects(callCompat(base), (e) => e instanceof CompatError && /DeepSeek inválida/.test(e.message));
  mockFetch(402, { error: { message: "Insufficient Balance" } });
  await assert.rejects(callCompat(base), /no tiene saldo/);
  mockFetch(429, { error: { message: "Rate limit exceeded: free-models-per-day" } });
  await assert.rejects(callCompat(base), /modelos gratis/);
  mockFetch(200, reply("", { finish_reason: "length" }));
  await assert.rejects(callCompat({ ...base, schema: {} }), /se cortó/);
  await assert.rejects(callCompat({ ...base, model: "" }), /Falta el nombre del modelo/);
});

test("la instrucción de formato menciona json y lleva el esquema", () => {
  const s = jsonInstruction({ type: "object", required: ["ok"] });
  assert.match(s, /json/);
  assert.match(s, /"required":\["ok"\]/);
});

test("si la API no responde a tiempo, corta y lo dice (para que pase al respaldo)", async () => {
  globalThis.fetch = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  await assert.rejects(
    callCompat({ ...base, label: "OpenRouter", timeoutMs: 30 }),
    (e) => e instanceof CompatError && e.status === 0 && /OpenRouter tardó más de 0 segundos|tardó más de/.test(e.message)
  );
});
