import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_SETTINGS, MODELS, OUTPUT_SCHEMA, ROUND_SCHEMA,
  buildRoundMessage, buildRoundSystemPrompt, buildSystemPrompt, buildUserMessage,
  LEARN_SCHEMA, buildLearnMessage, buildLearnPrompt,
} from "./prompt.js";
import { humanize } from "./humanize.js";
import { GEMINI_LITE, GEMINI_MODELS, GeminiError, callGemini, humanWait } from "./gemini.js";
import { COMPAT_PRESETS, CompatError, callCompat } from "./openai-compat.js";
import { fallbackNote, providerChain, runWithFallback } from "./fallback.js";

const compatLabel = (s) => COMPAT_PRESETS[s.compatPreset]?.label === "Otro" ? "la API" : COMPAT_PRESETS[s.compatPreset]?.label || "la API";
// Nombres para los avisos: "con OpenRouter, porque Gemini llegó al límite de uso".
const labelsFor = (s) => ({ anthropic: "Claude", gemini: "Gemini", compat: compatLabel(s) });
const pauseFor = (ms) => Math.min(Math.max(ms || 0, 15 * 60 * 1000), 24 * 60 * 60 * 1000);

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  // Configuraciones viejas (claude-opus-5, claude-sonnet-5) pasan al modelo actual.
  if (!MODELS.includes(settings.model)) settings.model = DEFAULT_SETTINGS.model;
  if (!GEMINI_MODELS.includes(settings.geminiModel)) settings.geminiModel = DEFAULT_SETTINGS.geminiModel;
  return settings;
}

// ---------- Aprender de tus correcciones ----------
// lic_feedback: [{ at, kind: "editado" | "publicado" | "elegido" | "descartado", post, tipo, motivo, original, final }]

const LEARN_EVERY = 8; // ejemplos nuevos para volver a resumir las reglas

async function getLearning(settings) {
  const { lic_feedback: fb = [] } = await chrome.storage.local.get("lic_feedback");
  const recent = (kinds, n) => fb.filter((f) => kinds.includes(f.kind)).slice(-n);
  return {
    rules: settings.learnedRules,
    edits: recent(["editado"], 6),
    published: recent(["publicado", "editado"], 5).map((f) => f.final),
    discards: recent(["descartado"], 6),
  };
}

// Resume las correcciones en reglas cuando se juntaron LEARN_EVERY ejemplos nuevos (o si lo pedís).
async function learn({ force = false } = {}) {
  const settings = await getSettings();
  const { lic_feedback: fb = [], lic_learned_at: since = 0 } = await chrome.storage.local.get(["lic_feedback", "lic_learned_at"]);
  const useful = fb.filter((f) => f.kind === "editado" || f.kind === "descartado");
  const fresh = useful.filter((f) => f.at > since);
  if (!fresh.length || (!force && fresh.length < LEARN_EVERY)) {
    return { rules: settings.learnedRules, examples: fb.length, pending: fresh.length, updated: false };
  }
  const { data } = await callJson(settings, {
    system: buildLearnPrompt(settings.learnedRules),
    user: buildLearnMessage(useful.slice(-30)),
    schema: LEARN_SCHEMA,
  });
  const rules = data.reglas.map((r) => `- ${r.replace(/^[-•]\s*/, "").trim()}`).filter((r) => r.length > 3).slice(0, 10).join("\n");
  await chrome.storage.local.set({ learnedRules: rules, lic_learned_at: Date.now() });
  return { rules, examples: fb.length, pending: 0, updated: true };
}

function keyOf(settings, provider) {
  return { anthropic: settings.apiKey, gemini: settings.geminiKey, compat: settings.compatKey }[provider] || "";
}

// Gemini: si el modelo elegido llegó a su límite (el gratuito de 3.8 Flash es de 20 pedidos
// por día), probar con Flash-Lite, que tiene mucho más cupo, antes de cambiar de proveedor.
// `pauses` guarda hasta cuándo no vale la pena intentar con el modelo agotado.
async function callGeminiSmart(settings, req, pauses, now = Date.now()) {
  const apiKey = keyOf(settings, "gemini");
  const preferred = settings.geminiModel;
  const pauseKey = `gemini:${preferred}`;
  let why = "está en pausa";
  if (preferred !== GEMINI_LITE) {
    if (!(pauses[pauseKey] > now)) {
      try {
        return await callGemini({ apiKey, model: preferred, ...req });
      } catch (e) {
        // 429: se agotó el cupo (la API dice cuándo se libera). 5xx: Google está saturado y
        // suele durar minutos. En los dos casos, Flash-Lite suele andar.
        if (e.status !== 429 && !(e.status >= 500)) throw e;
        pauses[pauseKey] = now + (e.status === 429 ? pauseFor(e.retryAfterMs) : 2 * 60 * 1000);
        why = e.status === 429 ? "llegó a su límite" : "está saturado";
      }
    }
    const res = await callGemini({ apiKey, model: GEMINI_LITE, ...req });
    return { ...res, downgraded: `Gemini Flash-Lite, porque Gemini 3.8 Flash ${why}` };
  }
  return callGemini({ apiKey, model: GEMINI_LITE, ...req });
}

// Un pedido con salida JSON a un proveedor puntual. Devuelve { data, model }.
async function callProvider(settings, provider, { system, user, schema }, pauses = {}) {
  const apiKey = keyOf(settings, provider);
  if (provider === "gemini") return callGeminiSmart(settings, { system, user, schema }, pauses);
  if (provider === "compat") {
    return callCompat({ apiKey, baseUrl: settings.compatBaseUrl, model: settings.compatModel, system, user, schema, label: compatLabel(settings) });
  }
  const response = await makeClient(apiKey).beta.messages.create({
    ...requestParams(settings.model, schema),
    system,
    messages: [{ role: "user", content: user }],
  });
  return { data: readJson(response), model: response.model };
}

// Prueba el proveedor principal y, si se queda sin saldo, llega al límite o falla, los de
// respaldo en orden. Devuelve { data, model, note }; note explica si hubo que cambiar.
async function callJson(settings, req) {
  const chain = providerChain(settings, (p) => !!keyOf(settings, p));
  const { lic_cooldowns: cooldowns = {}, lic_model_pauses: modelPauses = {} } =
    await chrome.storage.local.get(["lic_cooldowns", "lic_model_pauses"]);
  const pauses = { ...modelPauses };
  const labels = labelsFor(settings);
  // Los errores pasan por describeError para que el panel los muestre claros y en castellano.
  const call = async (p) => {
    try {
      return await callProvider(settings, p, req, pauses);
    } catch (e) {
      throw Object.assign(new Error(describeError(e)), { status: e?.status ?? 0, retryAfterMs: e?.retryAfterMs || 0 });
    }
  };
  try {
    const out = await runWithFallback({ chain, cooldowns, call, labels });
    await chrome.storage.local.set({ lic_cooldowns: out.cooldowns, lic_model_pauses: pauses });
    const note = [out.result.downgraded && `con ${out.result.downgraded}`, fallbackNote(out, labels)].filter(Boolean).join("; ");
    return { ...out.result, note };
  } catch (err) {
    await chrome.storage.local.set({ lic_model_pauses: pauses, ...(err.cooldowns && { lic_cooldowns: err.cooldowns }) });
    throw err;
  }
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
// Frases que cuentan algo que el usuario hizo o vivió ("en Ualá aprendimos…", "we built…").
// Los modelos chicos las inventan aunque el prompt lo prohíba. Se marca la frase solo si su
// contenido no tiene respaldo en el perfil del usuario: si habla de lo que el perfil dice
// (GenAI con Gemini en soporte), no molesta.
const CLAIM_RE =
  /\b(nos pas[óo]|me pas[óo]|en mi experiencia|in my experience|(lo |la |los |las )?(resolvimos|implementamos|desplegamos|lanzamos|armamos|hicimos|construimos|logramos|probamos|medimos|migramos|vimos|aprendimos|descubrimos|notamos|encontramos|vivimos|enfrentamos|tuvimos|creamos|reemplazamos|redujimos|aumentamos|escalamos|cambiamos)|(desplegu|constru|arm|lider|resolv|implement|lanc|logr|cre|reduj|aument|escal)[eéí]|cuando (estaba|trabajaba|lider[ée]) en|we (built|did|launched|solved|saw|tried|shipped|migrated|learned|found|noticed|discovered|had|faced|ran|used|created|replaced|reduced|scaled|deployed|implemented)|i (built|led|saw|found|learned|ran|launched|deployed)|at my (last|previous) (company|job))\b/i;

const STOP = new Set("para como pero porque cuando donde sobre entre hasta desde esta este esto esos esas solo cada tiene tienen puede hace hacer with that this from have been were their there which about into than then what when your more only also".split(" "));
const stem = (w) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 5);
const wordsOf = (t) => (t.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]{5,}/g) || []).filter((w) => !STOP.has(w.toLowerCase())).map(stem);

// Las frases del comentario que cuentan una experiencia sin respaldo en `facts` (el perfil).
function unsupportedClaims(text, facts) {
  const known = new Set(wordsOf(facts));
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => CLAIM_RE.test(sentence))
    .filter((sentence) => new Set(wordsOf(sentence).filter((w) => known.has(w))).size < 3);
}

// Cifras que aparecen en el comentario pero no en lo que el modelo tenía a mano (tu perfil,
// el post, tus ejemplos). Los modelos chicos las inventan ("el 70% del esfuerzo").
// Se ignoran los años y los números de una cifra.
const digits = (s) => s.replace(/[.,%\s]/g, "");
function unverifiedNumbers(text, known) {
  const knownSet = new Set((known.match(/\d[\d.,]*/g) || []).map(digits));
  return [...new Set(text.match(/\d[\d.,]*%?/g) || [])]
    .filter((n) => digits(n).length >= 2 && !/^(19|20)\d\d$/.test(digits(n)) && !knownSet.has(digits(n)))
    .map((n) => n.replace(/[.,]$/, ""));
}

function clean(text, known = "", facts = "") {
  const h = humanize(text);
  const flags = h.flags.map((f) => ({ name: f.name, fix: f.fix }));
  const invented = known ? unverifiedNumbers(h.text, known) : [];
  if (invented.length) {
    flags.unshift({
      name: `Cita ${invented.length > 1 ? "cifras" : "una cifra"} que no está en tu perfil ni en el post (${invented.join(", ")}): confirmá que sea real`,
      fix: "Los modelos a veces inventan números. Si no es un dato tuyo, sacalo.",
    });
  }
  const claims = facts ? unsupportedClaims(h.text, facts) : [];
  if (claims.length) {
    flags.unshift({
      name: `Cuenta una experiencia tuya que no está en tu perfil ("${claims[0].slice(0, 70).trim()}…"): confirmá que sea real`,
      fix: "Los modelos a veces inventan anécdotas. Si no te pasó, cambiala por una opinión.",
    });
  }
  return { text: h.text, flags };
}

async function generate({ author, post, hint }) {
  const settings = await getSettings();
  if (!post?.trim()) throw new Error("No hay texto del post para comentar.");

  const { data, model, note } = await callJson(settings, {
    system: buildSystemPrompt(settings, await getLearning(settings)),
    user: buildUserMessage({ author, post, hint }),
    schema: OUTPUT_SCHEMA,
  });
  return {
    comments: data.comments.slice(0, 3).map((c) => ({ ...c, ...clean(c.text, `${settings.persona} ${settings.examples} ${post} ${hint || ""}`, `${settings.persona} ${settings.examples}`) })),
    model,
    note,
  };
}

// Una ronda: recibe los posts nuevos del feed y devuelve, para los que vale la pena,
// un comentario ya humanizado.
async function round({ posts }) {
  const settings = await getSettings();
  if (!posts?.length) return { picks: [] };

  const { data, model, note } = await callJson(settings, {
    system: buildRoundSystemPrompt(settings, await getLearning(settings)),
    user: buildRoundMessage(posts),
    schema: ROUND_SCHEMA,
  });
  const known = new Set(posts.map((p) => p.id));
  const picks = data.posts
    .filter((p) => known.has(p.id))
    .map((p) => (p.comentar && p.comentario.trim()
      ? { ...p, ...clean(p.comentario, `${settings.persona} ${settings.examples} ${posts.find((x) => x.id === p.id)?.text || ""}`, `${settings.persona} ${settings.examples}`) }
      : { ...p, text: "", flags: [] }));
  return { picks, model, note };
}

function setBadge({ count }) {
  chrome.action.setBadgeBackgroundColor({ color: "#0a66c2" });
  chrome.action.setBadgeText({ text: count ? String(count) : "" });
  return Promise.resolve({});
}

const OK_SCHEMA = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };

// Prueba una IA con los datos del formulario (todavía sin guardar).
async function testOne({ provider, apiKey, model, baseUrl, preset }) {
  if (!apiKey) throw new Error("falta la API key");
  if (provider === "compat") {
    const res = await callCompat({
      apiKey, baseUrl, model, system: "Respondés en json.", user: "Respondé {\"ok\": true}",
      schema: OK_SCHEMA, maxTokens: 512, label: compatLabel({ compatPreset: preset }),
    });
    return { model: res.model };
  }
  if (provider === "gemini") {
    const preferred = GEMINI_MODELS.includes(model) ? model : DEFAULT_SETTINGS.geminiModel;
    const ask = (m) => callGemini({ apiKey, model: m, system: "Respondés en JSON.", user: "Respondé {\"ok\": true}", schema: OK_SCHEMA, maxTokens: 1024 });
    try {
      return { model: (await ask(preferred)).model };
    } catch (e) {
      if ((e.status !== 429 && !(e.status >= 500)) || preferred === GEMINI_LITE) throw e;
      const res = await ask(GEMINI_LITE);
      const why = e.status === 429
        ? `llegó a su límite${e.retryAfterMs ? `, se libera en ${humanWait(e.retryAfterMs)}` : ""}`
        : "está saturado en este momento (error " + e.status + ")";
      return { model: res.model, note: `3.8 Flash ${why}; mientras tanto uso Flash-Lite` };
    }
  }
  const response = await makeClient(apiKey).beta.messages.create({
    ...requestParams(MODELS.includes(model) ? model : DEFAULT_SETTINGS.model),
    output_config: { effort: "low" },
    max_tokens: 1024,
    messages: [{ role: "user", content: "Respondé solo: OK" }],
  });
  return { model: response.model };
}

// Prueba la principal y los respaldos; devuelve el estado de cada una.
async function testConnection({ providers }) {
  const results = [];
  for (const p of providers) {
    try {
      results.push({ provider: p.provider, ok: true, ...(await testOne(p)) });
    } catch (e) {
      results.push({ provider: p.provider, ok: false, error: describeError(e) });
    }
  }
  return { results };
}

function describeError(err) {
  if (err instanceof GeminiError || err instanceof CompatError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "API key de Anthropic inválida.";
  if (err instanceof Anthropic.PermissionDeniedError) return "La API key no tiene permiso para este modelo.";
  if (err instanceof Anthropic.RateLimitError) return "Límite de uso alcanzado. Probá en un rato.";
  if (err instanceof Anthropic.APIConnectionError) return "No pude conectar con la API de Anthropic.";
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    return "Tu cuenta de la API de Anthropic no tiene saldo. Cargá crédito en console.anthropic.com → Billing (la suscripción a Claude no sirve para la API). Reintento solo en un rato.";
  }
  if (err instanceof Anthropic.InternalServerError) return "La API de Anthropic está con problemas. Reintento solo en un rato.";
  if (err instanceof Anthropic.APIError) return `Error de la API (${err.status}): ${err.message}`;
  return err?.message || String(err);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    generate: () => generate(msg),
    round: () => round(msg),
    learn: () => learn(msg),
    badge: () => setBadge(msg),
    test: () => testConnection(msg),
    openOptions: () => chrome.runtime.openOptionsPage().then(() => ({})),
    ping: () => Promise.resolve({ version: __BUILD_VERSION__ }),
  };
  const handler = handlers[msg?.type];
  if (!handler) return false;

  handler()
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((err) => sendResponse({ ok: false, error: describeError(err) }));
  return true; // respuesta asíncrona
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
