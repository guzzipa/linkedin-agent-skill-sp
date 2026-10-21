import { DEFAULT_SETTINGS, MODELS } from "./prompt.js";
import { GEMINI_MODELS } from "./gemini.js";
import { COMPAT_PRESETS } from "./openai-compat.js";

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

// Muestra la key y el modelo del proveedor principal y de los de respaldo.
function showProvider() {
  const used = new Set([$("provider").value, $("fallback1").value, $("fallback2").value]);
  for (const el of document.querySelectorAll("[data-provider]")) el.hidden = !used.has(el.dataset.provider);
}
for (const id of ["provider", "fallback1", "fallback2"]) $(id).addEventListener("change", showProvider);

// ---------- Compatible con OpenAI ----------

const COMPAT_HELP = {
  deepseek: 'Sacá la key en <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a> y cargá unos dólares de saldo: con este uso alcanza para meses. <strong>Ojo:</strong> DeepSeek procesa los datos en China, y lo que le mandás incluye posts de otras personas.',
  openrouter: 'Sacá la key gratis en <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>. En <a href="https://openrouter.ai/models?q=free" target="_blank">openrouter.ai/models</a> elegí un modelo que termine en <code>:free</code> y pegá su nombre en Modelo. Los gratis tienen límites por día y cada proveedor tiene su propia política de datos.',
  custom: "Cualquier API compatible con OpenAI que tenga <code>/chat/completions</code>. Pegá la URL base (por ejemplo, <code>https://api.groq.com/openai/v1</code>) y el nombre exacto del modelo. Chrome te va a pedir permiso para conectarse a esa dirección.",
};

function showCompatHelp() {
  $("compatHelp").innerHTML =
    (COMPAT_HELP[$("compatPreset").value] || "") +
    " Los modelos más chicos o gratis respetan menos la regla de no inventar experiencias tuyas: leé cada comentario antes de publicarlo.";
}

// Al cambiar de servicio, completar URL y modelo con los de ese servicio.
$("compatPreset").addEventListener("change", () => {
  const p = COMPAT_PRESETS[$("compatPreset").value];
  $("compatBaseUrl").value = p.baseUrl;
  $("compatModel").value = p.model;
  showCompatHelp();
});

// DeepSeek y OpenRouter vienen permitidos en el manifest; para otra dirección hay que pedir permiso.
async function ensureHostPermission(baseUrl) {
  let origin;
  try {
    origin = new URL(baseUrl).origin + "/*";
  } catch {
    return false;
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

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
  showCompatHelp();
}

$("save").addEventListener("click", async () => {
  const form = readForm();
  const usesCompat = [form.provider, form.fallback1, form.fallback2].includes("compat");
  if (usesCompat && !(await ensureHostPermission(form.compatBaseUrl))) {
    return setStatus("Sin permiso para conectarse a esa URL: no se guardó.", true);
  }
  await chrome.storage.local.set(form);
  setStatus("Guardado.");
});

$("test").addEventListener("click", async () => {
  const f = readForm();
  if (f.provider === "compat") {
    if (!f.compatKey) return setStatus("Pegá la API key primero.", true);
    if (!(await ensureHostPermission(f.compatBaseUrl))) return setStatus("Sin permiso para conectarse a esa URL.", true);
    setStatus("Probando…");
    const res = await chrome.runtime.sendMessage({ type: "test", provider: "compat", apiKey: f.compatKey, model: f.compatModel, baseUrl: f.compatBaseUrl, preset: f.compatPreset });
    return setStatus(res.ok ? `Conexión OK (${res.model}).` : res.error, !res.ok);
  }
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
