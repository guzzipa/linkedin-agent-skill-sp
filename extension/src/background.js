import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_SETTINGS, MODELS, OUTPUT_SCHEMA, ROUND_SCHEMA,
  buildRoundMessage, buildRoundSystemPrompt, buildSystemPrompt, buildUserMessage,
} from "./prompt.js";
import { humanize } from "./humanize.js";

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  // Configuraciones viejas (claude-opus-5, claude-sonnet-5) pasan al modelo actual.
  if (!MODELS.includes(settings.model)) settings.model = DEFAULT_SETTINGS.model;
  return settings;
}

function makeClient(apiKey) {
  // La key vive solo en chrome.storage.local de tu navegador y viaja directo a api.anthropic.com.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

function requestParams(model, schema = OUTPUT_SCHEMA) {
  return {
    model,
    max_tokens: 16000,
    output_config: {
      effort: "medium", // explícito: es el default de Opus 5.5 pero no el de Sonnet 5.5
      format: { type: "json_schema", schema },
    },
    // Si los clasificadores rechazan el pedido, la API lo reintenta en otro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
}

function readJson(response) {
  if (response.stop_reason === "refusal") throw new Error("El modelo no quiso comentar estos posts.");
  if (response.stop_reason === "max_tokens") throw new Error("La respuesta se cortó: probá con menos posts por ronda.");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`Respuesta vacía (stop_reason: ${response.stop_reason}).`);
  return JSON.parse(text);
}

// Pasa cada borrador por el humanizador: arregla lo seguro y devuelve lo que hay que mirar.
function clean(text) {
  const h = humanize(text);
  return { text: h.text, flags: h.flags.map((f) => ({ name: f.name, fix: f.fix })) };
}

async function generate({ author, post, hint }) {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("Falta la API key. Abrí la configuración de la extensión.");
  if (!post?.trim()) throw new Error("No hay texto del post para comentar.");

  const client = makeClient(settings.apiKey);
  const response = await client.beta.messages.create({
    ...requestParams(settings.model),
    system: buildSystemPrompt(settings),
    messages: [{ role: "user", content: buildUserMessage({ author, post, hint }) }],
  });

  const { comments } = readJson(response);
  return {
    comments: comments.slice(0, 3).map((c) => ({ ...c, ...clean(c.text) })),
    model: response.model,
  };
}

// Una ronda: recibe los posts nuevos del feed y devuelve, para los que vale la pena,
// un comentario ya humanizado.
async function round({ posts }) {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("Falta la API key. Abrí la configuración de la extensión.");
  if (!posts?.length) return { picks: [] };

  const client = makeClient(settings.apiKey);
  const response = await client.beta.messages.create({
    ...requestParams(settings.model, ROUND_SCHEMA),
    system: buildRoundSystemPrompt(settings),
    messages: [{ role: "user", content: buildRoundMessage(posts) }],
  });
  const known = new Set(posts.map((p) => p.id));
  const picks = readJson(response)
    .posts.filter((p) => known.has(p.id))
    .map((p) => (p.comentar && p.comentario.trim() ? { ...p, ...clean(p.comentario) } : { ...p, text: "", flags: [] }));
  return { picks, model: response.model };
}

function setBadge({ count }) {
  chrome.action.setBadgeBackgroundColor({ color: "#0a66c2" });
  chrome.action.setBadgeText({ text: count ? String(count) : "" });
  return Promise.resolve({});
}

async function testConnection(apiKey, model) {
  const client = makeClient(apiKey);
  const response = await client.beta.messages.create({
    ...requestParams(MODELS.includes(model) ? model : DEFAULT_SETTINGS.model),
    output_config: { effort: "low" },
    max_tokens: 1024,
    messages: [{ role: "user", content: "Respondé solo: OK" }],
  });
  return { model: response.model };
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "API key inválida.";
  if (err instanceof Anthropic.PermissionDeniedError) return "La API key no tiene permiso para este modelo.";
  if (err instanceof Anthropic.RateLimitError) return "Límite de uso alcanzado. Probá en un rato.";
  if (err instanceof Anthropic.APIConnectionError) return "No pude conectar con la API de Anthropic.";
  if (err instanceof Anthropic.APIError) return `Error de la API (${err.status}): ${err.message}`;
  return err?.message || String(err);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    generate: () => generate(msg),
    round: () => round(msg),
    badge: () => setBadge(msg),
    test: () => testConnection(msg.apiKey, msg.model),
    openOptions: () => chrome.runtime.openOptionsPage().then(() => ({})),
  };
  const handler = handlers[msg?.type];
  if (!handler) return false;

  handler()
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((err) => sendResponse({ ok: false, error: describeError(err) }));
  return true; // respuesta asíncrona
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
