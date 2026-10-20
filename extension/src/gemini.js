// Cliente mínimo de la API de Gemini con salida JSON, sobre la Interactions API.
// https://ai.google.dev/gemini-api/docs/interactions
// (generateContent devuelve 404 con las keys nuevas de AI Studio, las que empiezan con "AQ.".)
// La key viaja directo a generativelanguage.googleapis.com, igual que la de Anthropic.

export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function friendly(status, body) {
  // A veces el error viene envuelto en un array.
  const error = (Array.isArray(body) ? body[0] : body)?.error || {};
  const msg = error.message || "";
  if (status === 401 || /API key not valid|API_KEY_INVALID/i.test(msg)) return "API key de Gemini inválida.";
  if (status === 403) return "La API key de Gemini no tiene permiso para este modelo.";
  if (status === 404) return "Ese modelo de Gemini no existe o no está disponible para tu key.";
  if (status === 429) return "Llegaste al límite de uso de Gemini (el nivel gratuito tiene límites por minuto y por día). Reintento solo en un rato.";
  if (status >= 500) return "La API de Gemini está con problemas. Reintento solo en un rato.";
  return `Error de la API de Gemini (${status}): ${msg || "sin detalle"}`;
}

// El texto final del modelo: los pasos "model_output", sin los de pensamiento.
function outputText(body) {
  return (body?.steps || body?.outputs || [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content || [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

// Devuelve { data, model }: el JSON que respondió el modelo, ya parseado.
export async function callGemini({ apiKey, model, system, user, schema, maxTokens = 16000 }) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model,
        store: false, // que Google no guarde la conversación en su servidor
        system_instruction: system,
        input: user,
        generation_config: { max_output_tokens: maxTokens },
        ...(schema && { response_format: { type: "text", mime_type: "application/json", schema } }),
      }),
    });
  } catch {
    throw new GeminiError("No pude conectar con la API de Gemini.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new GeminiError(friendly(res.status, body), res.status);

  const text = outputText(body);
  if (!text) {
    const why = body?.status && body.status !== "completed" ? ` (estado: ${body.status})` : "";
    throw new GeminiError(`Gemini no devolvió respuesta${why}. Probá con menos posts por ronda.`, 200);
  }
  if (!schema) return { data: text, model: body.model || model };

  try {
    return { data: JSON.parse(text), model: body.model || model };
  } catch {
    // Por las dudas: si vino envuelto en ```json, sacarle el envoltorio.
    const inner = text.match(/\{[\s\S]*\}/)?.[0];
    if (inner) return { data: JSON.parse(inner), model: body.model || model };
    throw new GeminiError("Gemini no devolvió JSON válido.", 200);
  }
}
