import { DEFAULT_SETTINGS, MODELS } from "./prompt.js";
import { GEMINI_MODELS } from "./gemini.js";
import { COMPAT_PRESETS } from "./openai-compat.js";

const FIELDS = Object.keys(DEFAULT_SETTINGS);
const $ = (id) => document.getElementById(id);

// ¿El service worker que está corriendo es de esta versión? Si el usuario recompiló pero no
// tocó ↻, esta página es nueva y el service worker es viejo: los mensajes no coinciden y los
// errores son engañosos (p. ej. "Could not resolve authentication method").
async function staleWorker() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "ping" });
    return res?.version !== __BUILD_VERSION__;
  } catch {
    return true; // un service worker viejo no conoce "ping" y no responde
  }
}

const RELOAD_MSG =
  "Chrome sigue usando la versión anterior de la extensión. Abrí chrome://extensions, tocá ↻ en LinkedIn Commenter y volvé a abrir esta página.";

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
  // Con la configuración nueva (otra key, saldo cargado), las pausas anteriores ya no valen.
  await chrome.storage.local.set({ ...form, lic_cooldowns: {}, lic_model_pauses: {} });
  setStatus("Guardado.");
});

const LABELS = { anthropic: "Claude", gemini: "Gemini", compat: "" };

// Lo que hay que probar: la principal y los respaldos, con los datos del formulario.
function providersToTest(f) {
  const order = [f.provider, f.fallback1, f.fallback2].filter((p, i, all) => p && p !== "none" && all.indexOf(p) === i);
  return order.map((provider) => ({
    provider,
    apiKey: { anthropic: f.apiKey, gemini: f.geminiKey, compat: f.compatKey }[provider],
    model: { anthropic: f.model, gemini: f.geminiModel, compat: f.compatModel }[provider],
    baseUrl: f.compatBaseUrl,
    preset: f.compatPreset,
  }));
}

// Avisos antes de gastar un pedido: una key en el campo de otro proveedor.
function keyMismatch(f) {
  if (/^(AIza|AQ\.)/.test(f.apiKey)) return "La key del campo de Anthropic es de Google: pegala en API key de Gemini.";
  if (f.geminiKey.startsWith("sk-ant-")) return "La key del campo de Gemini es de Anthropic: pegala en API key de Anthropic.";
  if (/^(AIza|AQ\.)/.test(f.compatKey) || f.compatKey.startsWith("sk-ant-")) return "La key del campo de DeepSeek / OpenRouter es de otro proveedor.";
  return "";
}

$("test").addEventListener("click", async () => {
  if (await staleWorker()) return setStatus(RELOAD_MSG, true);
  const f = readForm();
  const providers = providersToTest(f);
  const mismatch = keyMismatch(f);
  if (mismatch) return setStatus(mismatch, true);
  if (providers.some((p) => !p.apiKey)) {
    const missing = providers.filter((p) => !p.apiKey).map((p) => LABELS[p.provider] || $("compatPreset").selectedOptions[0].text.split(":")[0]);
    return setStatus(`Falta la API key de: ${missing.join(", ")}.`, true);
  }
  if (providers.some((p) => p.provider === "compat") && !(await ensureHostPermission(f.compatBaseUrl))) {
    return setStatus("Sin permiso para conectarse a la URL de la API compatible.", true);
  }
  setStatus(providers.length > 1 ? `Probando ${providers.length} IA…` : "Probando…");
  const res = await chrome.runtime.sendMessage({ type: "test", providers });
  if (!res.ok) return setStatus(res.error, true);
  const compatName = $("compatPreset").selectedOptions[0].text.split(":")[0];
  const lines = res.results.map((r, i) => {
    const name = r.provider === "compat" ? compatName : LABELS[r.provider];
    const role = i === 0 ? "principal" : `respaldo ${i}`;
    return r.ok ? `✓ ${name} (${role}): OK, ${r.model}${r.note ? ` (${r.note})` : ""}` : `✗ ${name} (${role}): ${r.error}`;
  });
  setStatus(lines.join("\n"), res.results.every((r) => !r.ok));
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

staleWorker().then((stale) => {
  if (stale) {
    $("reload").textContent = RELOAD_MSG;
    $("reload").hidden = false;
  }
});

load();
learnStats();
