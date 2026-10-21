// Cliente para cualquier API compatible con OpenAI (POST {baseUrl}/chat/completions):
// DeepSeek, OpenRouter (con modelos gratuitos), Groq, Mistral, un modelo local, etc.
// La salida JSON se pide con response_format json_object (el modo que soportan casi
// todos) y el esquema va en el prompt; después se valida que la respuesta sea un objeto.

export const COMPAT_PRESETS = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    keyUrl: "https://openrouter.ai/keys",
  },
  custom: { label: "Otro", baseUrl: "", model: "", keyUrl: "" },
};

export class CompatError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function friendly(status, body, label) {
  const msg = body?.error?.message || body?.message || "";
  if (status === 401) return `API key de ${label} inválida.`;
  if (status === 402 || /insufficient balance|credit/i.test(msg)) return `Tu cuenta de ${label} no tiene saldo.`;
  if (status === 403) return `La API key de ${label} no tiene permiso para ese modelo.`;
  if (status === 404) return `${label} no encontró el modelo o la URL. Revisá el modelo y la URL base.`;
  if (status === 429) return `Llegaste al límite de uso de ${label}${/free/i.test(msg) ? " (los modelos gratis tienen límites por minuto y por día)" : ""}. Reintento solo en un rato.`;
  if (status >= 500) return `${label} está con problemas. Reintento solo en un rato.`;
  return `Error de ${label} (${status}): ${msg || "sin detalle"}`;
}

// Sin schema estricto disponible, el esquema viaja en el prompt. DeepSeek exige que la
// palabra "json" aparezca en el prompt para activar json_object.
export function jsonInstruction(schema) {
  return `\n\n## Formato de respuesta\n\nRespondé solo con un objeto json válido que cumpla este JSON Schema, sin texto antes ni después y sin bloque de código:\n${JSON.stringify(schema)}`;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const inner = text.match(/\{[\s\S]*\}/)?.[0];
    if (inner) return JSON.parse(inner);
    throw new Error("no es JSON");
  }
}

// Devuelve { data, model }.
export async function callCompat({ apiKey, baseUrl, model, system, user, schema, maxTokens = 8000, label = "la API" }) {
  if (!baseUrl) throw new CompatError("Falta la URL base de la API.", 0);
  if (!model) throw new CompatError("Falta el nombre del modelo.", 0);
  let res;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: schema ? system + jsonInstruction(schema) : system },
          { role: "user", content: user },
        ],
        ...(schema && { response_format: { type: "json_object" } }),
      }),
    });
  } catch {
    throw new CompatError(`No pude conectar con ${label}. Revisá la URL base.`, 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new CompatError(friendly(res.status, body, label), res.status);

  const choice = body?.choices?.[0];
  const text = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
  if (choice?.finish_reason === "length") throw new CompatError("La respuesta se cortó: probá con menos posts por ronda.", 200);
  if (!text) throw new CompatError(`${label} devolvió una respuesta vacía. Probá de nuevo o con otro modelo.`, 200);
  if (!schema) return { data: text, model: body.model || model };

  let data;
  try {
    data = parseJson(text);
  } catch {
    throw new CompatError(`${label} no devolvió JSON válido. Probá con otro modelo.`, 200);
  }
  // Sin schema estricto, validar lo mínimo: que estén los campos de primer nivel requeridos.
  const missing = (schema.required || []).filter((k) => !(k in (data || {})));
  if (missing.length) throw new CompatError(`${label} respondió sin ${missing.join(", ")}. Probá con otro modelo.`, 200);
  return { data, model: body.model || model };
}
