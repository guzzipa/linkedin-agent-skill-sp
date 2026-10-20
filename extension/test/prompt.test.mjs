// Tests del bloque "Lo que aprendiste de mí" que se suma a los prompts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, buildLearningBlock, buildLearnMessage, buildRoundSystemPrompt, buildSystemPrompt } from "../src/prompt.js";

const learning = {
  rules: "- Escribí 2 oraciones como máximo.",
  edits: [{ original: "¡Excelente reflexión! Coincido totalmente.", final: "Coincido, con un matiz." }],
  published: ["Coincido, con un matiz."],
  discards: [{ post: "Buscamos Data Analyst remoto", motivo: "Aviso de tu industria" }],
};

test("sin nada aprendido, los prompts no cambian", () => {
  assert.equal(buildLearningBlock(undefined), "");
  assert.equal(buildLearningBlock({ rules: "", edits: [], published: [], discards: [] }), "");
  assert.equal(buildRoundSystemPrompt({ ...DEFAULT_SETTINGS }).includes("aprendiste"), false);
});

test("las reglas, correcciones y descartes llegan a los dos prompts", () => {
  for (const p of [buildRoundSystemPrompt({ ...DEFAULT_SETTINGS }, learning), buildSystemPrompt({ ...DEFAULT_SETTINGS }, learning)]) {
    assert.match(p, /Lo que aprendiste de mí/);
    assert.match(p, /Escribí 2 oraciones como máximo/);
    assert.match(p, /<borrador>¡Excelente reflexión! Coincido totalmente\.<\/borrador>/);
    assert.match(p, /<publicado>Coincido, con un matiz\.<\/publicado>/);
    assert.match(p, /Buscamos Data Analyst remoto/);
  }
});

test("los textos largos se recortan", () => {
  const block = buildLearningBlock({ edits: [{ original: "x".repeat(2000), final: "y" }] });
  assert.ok(block.length < 1000);
});

test("el mensaje para resumir distingue correcciones y descartes", () => {
  const msg = buildLearnMessage([
    { kind: "editado", original: "antes", final: "después" },
    { kind: "descartado", post: "un aviso", motivo: "porque sí" },
  ]);
  assert.match(msg, /<correccion>[\s\S]*antes[\s\S]*después/);
  assert.match(msg, /<descartado>[\s\S]*un aviso[\s\S]*porque sí/);
});
