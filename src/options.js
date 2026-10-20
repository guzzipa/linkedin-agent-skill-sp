import { DEFAULT_SETTINGS, MODELS } from "./prompt.js";

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

async function load() {
  const stored = await chrome.storage.local.get(FIELDS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  if (!MODELS.includes(settings.model)) settings.model = DEFAULT_SETTINGS.model;
  for (const f of FIELDS) {
    if ($(f).type === "checkbox") $(f).checked = settings[f];
    else $(f).value = settings[f];
  }
}

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set(readForm());
  setStatus("Guardado.");
});

$("test").addEventListener("click", async () => {
  const { apiKey, model } = readForm();
  if (!apiKey) return setStatus("Pegá la API key primero.", true);
  setStatus("Probando…");
  const res = await chrome.runtime.sendMessage({ type: "test", apiKey, model });
  setStatus(res.ok ? `Conexión OK (${res.model}).` : res.error, !res.ok);
});

load();
