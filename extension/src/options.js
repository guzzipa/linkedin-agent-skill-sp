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
  setStatus("Probando…");
  const res = await chrome.runtime.sendMessage({ type: "test", provider: f.provider, apiKey, model: gemini ? f.geminiModel : f.model });
  setStatus(res.ok ? `Conexión OK (${res.model}).` : res.error, !res.ok);
});

load();
