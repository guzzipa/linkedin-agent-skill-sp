import { DEFAULT_SETTINGS } from "./prompt.js";

const FIELDS = Object.keys(DEFAULT_SETTINGS);
const $ = (id) => document.getElementById(id);

function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").className = isError ? "error" : "";
}

function readForm() {
  return Object.fromEntries(FIELDS.map((f) => [f, $(f).value.trim()]));
}

async function load() {
  const stored = await chrome.storage.local.get(FIELDS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  for (const f of FIELDS) $(f).value = settings[f];
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
