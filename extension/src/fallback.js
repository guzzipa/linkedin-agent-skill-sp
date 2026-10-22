// Respaldo entre proveedores de IA: si el principal se queda sin saldo, llega al límite
// de uso o falla, se prueba con el siguiente de la lista. Sin dependencias de Chrome,
// para poder testearlo.

export const PROVIDER_LABELS = { anthropic: "Claude", gemini: "Gemini", compat: "la API compatible" };

const MIN = 60 * 1000;

// Cuánto tiempo dejar de intentar con un proveedor según el error.
export function classify(err) {
  const status = err?.status ?? 0;
  const msg = String(err?.message || "");
  if (status === 402 || /saldo|credit balance|insufficient balance|billing/i.test(msg)) {
    return { kind: "sin saldo", cooldown: 6 * 60 * MIN };
  }
  if (status === 429 || /límite de uso|rate limit|quota|exhausted/i.test(msg)) {
    // Si la API dijo cuándo se libera (p. ej. el límite diario de Gemini), esperar eso.
    const told = err?.retryAfterMs > 0 ? Math.min(err.retryAfterMs, 24 * 60 * MIN) : 0;
    return { kind: "límite de uso", cooldown: Math.max(told, 15 * MIN) };
  }
  if (status === 401 || status === 403 || /inválida|no tiene permiso/i.test(msg)) {
    return { kind: "key inválida", cooldown: 60 * MIN };
  }
  if (status >= 500 || status === 0) return { kind: "caído", cooldown: 2 * MIN };
  return { kind: "error", cooldown: 0 };
}

// El orden real: principal + respaldos, sin repetidos, solo los que tienen key.
export function providerChain(settings, hasKey) {
  const order = [settings.provider, settings.fallback1, settings.fallback2].filter(
    (p, i, all) => p && p !== "none" && all.indexOf(p) === i && hasKey(p)
  );
  return order;
}

// Ejecuta call(provider) siguiendo la cadena. Devuelve
// { result, provider, skipped: [{provider, kind, message}], cooldowns } o lanza un error
// que resume por qué falló cada uno. `cooldowns` es { provider: hastaCuándo } actualizado.
export async function runWithFallback({ chain, call, cooldowns = {}, now = Date.now(), labels = PROVIDER_LABELS }) {
  if (!chain.length) throw new Error("Falta la API key. Abrí la configuración de la extensión.");
  const next = { ...cooldowns };
  // Los que están en pausa no se intentan, salvo que estén todos en pausa.
  const ready = chain.filter((p) => !(next[p] > now));
  const order = ready.length ? ready : chain;
  const skipped = chain
    .filter((p) => !order.includes(p))
    .map((provider) => ({ provider, kind: "en pausa", message: "" }));

  for (const provider of order) {
    try {
      const result = await call(provider);
      delete next[provider];
      return { result, provider, skipped, cooldowns: next };
    } catch (err) {
      const { kind, cooldown } = classify(err);
      if (cooldown) next[provider] = now + cooldown;
      skipped.push({ provider, kind, message: err?.message || String(err) });
    }
  }
  const error = new Error(
    skipped
      .filter((s) => s.message)
      .map((s) => `${labels[s.provider] || s.provider}: ${s.message}`)
      .join(" · ") || "Ninguna IA respondió."
  );
  error.cooldowns = next;
  error.status = 0;
  throw error;
}

const WHY = {
  "en pausa": "está en pausa",
  "sin saldo": "no tiene saldo",
  "límite de uso": "llegó al límite de uso",
  "key inválida": "tiene la key inválida",
  caído: "no respondió",
  error: "falló",
};

// Texto corto para el panel: "con Gemini, porque Claude no tiene saldo".
export function fallbackNote({ provider, skipped }, labels = PROVIDER_LABELS) {
  if (!skipped.length) return "";
  const why = skipped
    .map((s) => `${labels[s.provider] || s.provider} ${WHY[s.kind] || "falló"}`)
    .join(", ");
  return `con ${labels[provider] || provider}, porque ${why}`;
}
