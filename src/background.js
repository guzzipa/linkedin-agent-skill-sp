import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_SETTINGS, OUTPUT_SCHEMA, buildSystemPrompt, buildUserMessage } from "./prompt.js";

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

function makeClient(apiKey) {
  // La key vive solo en chrome.storage.local de tu navegador y viaja directo a api.anthropic.com.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

function requestParams(model) {
  const params = {
    model,
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
  };
  if (model === "claude-opus-5") {
    // Si los clasificadores de Opus 5 rechazan el pedido, la API lo reintenta en otro modelo.
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }
  return params;
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

  if (response.stop_reason === "refusal") {
    throw new Error("El modelo no quiso comentar este post.");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`Respuesta vacía (stop_reason: ${response.stop_reason}).`);

  const { comments } = JSON.parse(text);
  return { comments: comments.slice(0, 3), model: response.model };
}

async function testConnection(apiKey, model) {
  const client = makeClient(apiKey);
  const response = await client.beta.messages.create({
    ...requestParams(model),
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
