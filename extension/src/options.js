import { DEFAULT_SETTINGS, MODELS } from "./prompt.js";
import { GEMINI_MODELS } from "./gemini.js";

const FIELDS = Object.keys(DEFAULT_SETTINGS);
const $ = (id) => document.getElementById(id);

function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").className = isError ? "error" : "";
}

function readField(f) {
  const input = $(f);
  if (input.type === "checkbox") return input.checked;
  if (input.type === "number") return Number(input.value) || DEFAULT_SETTINGS[f];
  return input.value.trim();
}

function readForm() {
  return Object.fromEntries(FIELDS.map((f) => [f, readField(f)]));
}

// Muestra solo la key y el modelo del proveedor elegido.
function showProvider() {
  const provider = $("provider").value;
  for (const el of document.querySelectorAll("[data-provider]")) el.hidden = el.dataset.provider !== provider;
}
$("provider").addEventListener("change", showProvider);

async function load() {
  const stored = await chrome.storage.local.get(FIELDS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  if (!MODELS.includes(settings.model)) settings.model = DEFAULT_SETTINGS.model;
  if (!GEMINI_MODELS.includes(settings.geminiModel)) settings.geminiModel = DEFAULT_SETTINGS.geminiModel;
  for (const f of FIELDS) {
    if ($(f).type === "checkbox") $(f).checked = settings[f];
    else $(f).value = settings[f];
  }
  showProvider();
}

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set(readForm());
  setStatus("Guardado.");
});

$("test").addEventListener("click", async () => {
  const f = readForm();
  const gemini = f.provider === "gemini";
  const apiKey = gemini ? f.geminiKey : f.apiKey;
  if (!apiKey) return setStatus("Pegá la API key primero.", true);
  // Una key de Google (AIza… o AQ.…) en el campo de Anthropic, o al revés: avisar antes de probar.
  const googleKey = /^(AIza|AQ\.)/.test(apiKey);
  if (!gemini && googleKey) return setStatus("Esa es una key de Google: en Modelo de IA elegí Gemini y pegala en API key de Gemini.", true);
  if (gemini && apiKey.startsWith("sk-ant-")) return setStatus("Esa es una key de Anthropic: en Modelo de IA elegí Claude.", true);
  setStatus("Probando…");
  const res = await chrome.runtime.sendMessage({ type: "test", provider: f.provider, apiKey, model: gemini ? f.geminiModel : f.model });
  setStatus(res.ok ? `Conexión OK (${res.model}).` : res.error, !res.ok);
});

// ---------- Lo que aprendió ----------

async function learnStats() {
  const { lic_feedback: fb = [] } = await chrome.storage.local.get("lic_feedback");
  const count = (k) => fb.filter((f) => f.kind === k).length;
  $("learnStatus").textContent = fb.length
    ? `${fb.length} ejemplos guardados: ${count("editado")} correcciones, ${count("publicado") + count("elegido")} sin cambios, ${count("descartado")} descartes.`
    : "Todavía no hay ejemplos guardados.";
}

$("learnNow").addEventListener("click", async () => {
  $("learnStatus").textContent = "Resumiendo tus correcciones…";
  const res = await chrome.runtime.sendMessage({ type: "learn", force: true });
  if (!res.ok) return ($("learnStatus").textContent = res.error);
  $("learnedRules").value = res.rules || "";
  if (!res.updated) $("learnStatus").textContent = "No hay correcciones ni descartes nuevos para aprender.";
  else learnStats();
});

$("forget").addEventListener("click", async () => {
  if (!confirm("¿Borrar las reglas y todos los ejemplos guardados? No se puede deshacer.")) return;
  await chrome.storage.local.set({ learnedRules: "", lic_feedback: [], lic_learned_at: 0 });
  $("learnedRules").value = "";
  learnStats();
});

// Si la extensión aprende reglas nuevas con esta página abierta, mostrarlas.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.learnedRules && document.activeElement !== $("learnedRules")) $("learnedRules").value = changes.learnedRules.newValue || "";
  if (changes.lic_feedback) learnStats();
});

load();
learnStats();
