// Tests del respaldo entre proveedores.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, fallbackNote, providerChain, runWithFallback } from "../src/fallback.js";

const err = (status, message) => Object.assign(new Error(message), { status });
const NOW = 1_000_000;

test("la cadena: principal y respaldos, sin repetidos ni proveedores sin key", () => {
  const s = { provider: "anthropic", fallback1: "gemini", fallback2: "anthropic" };
  assert.deepEqual(providerChain(s, () => true), ["anthropic", "gemini"]);
  assert.deepEqual(providerChain(s, (p) => p === "gemini"), ["gemini"]);
  assert.deepEqual(providerChain({ provider: "compat", fallback1: "none", fallback2: "none" }, () => true), ["compat"]);
});

test("si el principal anda, no toca los respaldos", async () => {
  const calls = [];
  const out = await runWithFallback({ chain: ["anthropic", "gemini"], now: NOW, call: async (p) => (calls.push(p), `ok-${p}`) });
  assert.deepEqual(calls, ["anthropic"]);
  assert.equal(out.result, "ok-anthropic");
  assert.equal(fallbackNote(out), "");
});

test("sin saldo en Claude: sigue con Gemini y deja a Claude en pausa 6 horas", async () => {
  const out = await runWithFallback({
    chain: ["anthropic", "gemini"],
    now: NOW,
    call: async (p) => {
      if (p === "anthropic") throw err(400, "Tu cuenta de la API de Anthropic no tiene saldo.");
      return "ok-gemini";
    },
  });
  assert.equal(out.provider, "gemini");
  assert.equal(out.cooldowns.anthropic, NOW + 6 * 60 * 60 * 1000);
  assert.equal(fallbackNote(out), "con Gemini, porque Claude no tiene saldo");
});

test("un proveedor en pausa no se intenta mientras haya otro disponible", async () => {
  const calls = [];
  const out = await runWithFallback({
    chain: ["anthropic", "gemini"],
    now: NOW,
    cooldowns: { anthropic: NOW + 1000 },
    call: async (p) => (calls.push(p), "ok"),
  });
  assert.deepEqual(calls, ["gemini"]);
  assert.equal(fallbackNote(out), "con Gemini, porque Claude está en pausa");
});

test("si todos están en pausa, se prueban igual; si la pausa venció, vuelve el principal", async () => {
  const calls = [];
  await runWithFallback({ chain: ["anthropic", "gemini"], now: NOW, cooldowns: { anthropic: NOW + 1, gemini: NOW + 1 }, call: async (p) => (calls.push(p), "ok") });
  assert.deepEqual(calls, ["anthropic"]);
  const out = await runWithFallback({ chain: ["anthropic", "gemini"], now: NOW, cooldowns: { anthropic: NOW - 1 }, call: async () => "ok" });
  assert.equal(out.provider, "anthropic");
  assert.equal(out.cooldowns.anthropic, undefined, "al andar, se le saca la pausa");
});

test("si fallan todos, el error dice qué le pasó a cada uno y guarda las pausas", async () => {
  await assert.rejects(
    runWithFallback({
      chain: ["gemini", "compat"],
      now: NOW,
      call: async (p) => {
        throw p === "gemini" ? err(429, "Llegaste al límite de uso de Gemini.") : err(402, "Tu cuenta de DeepSeek no tiene saldo.");
      },
    }),
    (e) => /Gemini: Llegaste al límite/.test(e.message) && /DeepSeek no tiene saldo/.test(e.message) && e.cooldowns.gemini === NOW + 15 * 60 * 1000
  );
});

test("clasifica los errores", () => {
  assert.equal(classify(err(402, "")).kind, "sin saldo");
  assert.equal(classify(err(400, "Your credit balance is too low")).kind, "sin saldo");
  assert.equal(classify(err(429, "")).kind, "límite de uso");
  assert.equal(classify(err(401, "")).kind, "key inválida");
  assert.equal(classify(err(503, "")).kind, "caído");
  assert.equal(classify(err(200, "Gemini no devolvió JSON válido.")).cooldown, 0);
});
