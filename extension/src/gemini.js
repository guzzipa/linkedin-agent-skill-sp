// Cliente mínimo de la API de Gemini (generateContent) con salida JSON.
// https://ai.google.dev/api/generate-content
// La key viaja directo a generativelanguage.googleapis.com, igual que la de Anthropic.

export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Gemini pide el esquema en su subconjunto de OpenAPI: tipos en mayúscula, sin
// additionalProperties, y propertyOrdering para que respete el orden de los campos.
export function toGeminiSchema(schema) {
  const out = {};
  if (schema.type) out.type = schema.type.toUpperCase();
  if (schema.enum) out.enum = schema.enum;
  if (schema.description) out.description = schema.description;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.propertyOrdering = Object.keys(schema.properties);
  }
  if (schema.required) out.required = schema.required;
  return out;
}

function friendly(status, body) {
  const msg = body?.error?.message || "";
  const reason = JSON.stringify(body?.error?.details || "");
  if (/API_KEY_INVALID|API key not valid/i.test(msg + reason)) return "API key de Gemini inválida.";
  if (status === 403) return "La API key de Gemini no tiene permiso para este modelo.";
  if (status === 404) return "Ese modelo de Gemini no existe o no está disponible para tu key.";
  if (status === 429) return "Llegaste al límite de uso de Gemini (el nivel gratuito tiene límites por minuto y por día). Reintento solo en un rato.";
  if (status >= 500) return "La API de Gemini está con problemas. Reintento solo en un rato.";
  return `Error de la API de Gemini (${status}): ${msg || "sin detalle"}`;
}

// Devuelve { data, model }: el JSON que respondió el modelo, ya parseado.
export async function callGemini({ apiKey, model, system, user, schema, maxTokens = 16000 }) {
  let res;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(schema && { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) }),
        },
      }),
    });
  } catch {
    throw new GeminiError("No pude conectar con la API de Gemini.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new GeminiError(friendly(res.status, body), res.status);

  if (body?.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini bloqueó el pedido por sus filtros de seguridad.", 200);
  }
  const candidate = body?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (candidate?.finishReason === "MAX_TOKENS") throw new GeminiError("La respuesta se cortó: probá con menos posts por ronda.", 200);
  if (candidate?.finishReason === "SAFETY") throw new GeminiError("Gemini no quiso comentar estos posts.", 200);
  if (!text) throw new GeminiError(`Respuesta vacía de Gemini (${candidate?.finishReason || "sin motivo"}).`, 200);
  if (!schema) return { data: text, model: body.modelVersion || model };

  try {
    return { data: JSON.parse(text), model: body.modelVersion || model };
  } catch {
    // Por las dudas: si vino envuelto en ```json, sacarle el envoltorio.
    const inner = text.match(/\{[\s\S]*\}/)?.[0];
    if (inner) return { data: JSON.parse(inner), model: body.modelVersion || model };
    throw new GeminiError("Gemini no devolvió JSON válido.", 200);
  }
}
