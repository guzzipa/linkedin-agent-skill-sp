// Port a JS del humanizador de linkedin-agent-skill-sp (skills/li-human/humanize.py).
// Lee los mismos léxicos que /li-human, directo de skills/li-human/lexicons/: hay una sola copia.
// Arregla solo lo seguro (invisibles, tipografía, reemplazos exactos) y marca el resto.
import ES from "../../skills/li-human/lexicons/es.json" with { type: "json" };
import EN from "../../skills/li-human/lexicons/en.json" with { type: "json" };

const WORD = "\\p{L}\\p{N}_";
// En JS, \w y \b son solo ASCII aunque uses el flag u: "más" tendría un "borde" en la "á".
const WB = `(?:(?<=[${WORD}])(?![${WORD}])|(?<![${WORD}])(?=[${WORD}]))`;
const SYNTAX = new Set("^$\\.*+?()[]{}|/");
const ESCAPES = new Set("dDsSwWbBnrtfv0uxcpPk123456789");

// Traduce una regex de Python (re) a JS con flag u. Cubre lo que usan los léxicos:
// flags en línea al principio, \w, \b, \UXXXXXXXX y escapes innecesarios.
export function pyRegex(src, extraFlags = "") {
  let flags = new Set(["u", ...extraFlags]);
  const lead = src.match(/^\(\?([ims]+)\)/);
  if (lead) {
    for (const f of lead[1]) flags.add(f);
    src = src.slice(lead[0].length);
  }
  let out = "";
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      const n = src[i + 1];
      if (n === "w") out += inClass ? WORD : `[${WORD}]`;
      else if (n === "b" && !inClass) out += WB;
      else if (n === "U") {
        out += `\\u{${src.slice(i + 2, i + 10).replace(/^0+/, "")}}`;
        i += 8;
      } else if (SYNTAX.has(n) || ESCAPES.has(n) || (inClass && n === "-")) out += c + n;
      else out += n; // escape de identidad: inválido en modo u
      i++;
      continue;
    }
    if (c === "[" && !inClass) inClass = true;
    else if (c === "]" && inClass) inClass = false;
    out += c;
  }
  return new RegExp(out, [...flags].join(""));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compiled = new WeakMap();
function entryRegex(entry) {
  if (!compiled.has(entry)) {
    const body = entry.pattern || escapeRe(entry.find).replace(/ /g, "\\s+");
    compiled.set(entry, pyRegex(`(?<!\\w)(?:${body})(?!\\w)`, "gi"));
  }
  return compiled.get(entry);
}

const wordRegex = (w) => new RegExp(`(?<![${WORD}])${escapeRe(w)}(?![${WORD}])`, "giu");
const label = (e) => e.label || e.find || e.pattern;

const STOP_ES = new Set("el la los las de del que y en un una por para con es se no lo como más pero su al este esta".split(" "));
const STOP_EN = new Set("the and of to a in is that for it with as was on are be this you i we not but at by".split(" "));

export function detectLang(text) {
  const toks = text.toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  const es = toks.filter((t) => STOP_ES.has(t)).length + 2 * (text.toLowerCase().match(/[ñ¿¡áéíóú]/g) || []).length;
  const en = toks.filter((t) => STOP_EN.has(t)).length;
  return es >= en ? "es" : "en";
}

const DIALOGO = /^\s*—\S|:\s+—\S/u;
const URL_RE = /https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gu;

function passInvisible(text, lex) {
  for (const { cp } of lex.invisible) {
    const [a, b] = cp.split("-").map((x) => parseInt(x.slice(2), 16));
    const re = b ? new RegExp(`[\\u{${a.toString(16)}}-\\u{${b.toString(16)}}]`, "gu") : new RegExp(`\\u{${a.toString(16)}}`, "gu");
    const action = lex.invisible.find((e) => e.cp === cp).action;
    text = text.replace(re, action === "delete" ? "" : " ");
  }
  return text.replace(/\p{Cf}/gu, "");
}

function passTypographic(text, lex) {
  for (const { from, to } of lex.typographic) {
    if (from === "—") {
      text = text
        .split("\n")
        .map((line) => (DIALOGO.test(line) ? line : line.replace(/\s*—\s*/g, ", ")))
        .join("\n");
    } else if (from === "–") {
      text = text.replace(/\s*–\s*(?=\d)/g, "-").replace(/\s+–\s+/g, ", ").replaceAll("–", "-");
    } else {
      text = text.replaceAll(from, to);
    }
  }
  return text
    .replace(/,\s*([,.;:!?])/g, "$1")
    .replace(/:\s*,\s*/g, ": ")
    .replace(/,\s*\n/g, "\n")
    .replace(/^,\s*/gm, "");
}

function matchCase(src, repl) {
  if (!repl) return repl;
  if (src === src.toUpperCase() && src.length > 1 && src !== src.toLowerCase()) return repl.toUpperCase();
  if (src[0] !== src[0].toLowerCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}

function passLexical(text, lex) {
  const fixed = [];
  const flagged = [];
  const entries = [...lex.phrases, ...lex.words].sort(
    (a, b) => (b.find || b.pattern).length - (a.find || a.pattern).length
  );
  let deleted = false;
  for (const entry of entries) {
    let rx = entryRegex(entry);
    const found = text.match(rx);
    if (!found) continue;
    if (entry.replace === null) {
      flagged.push({ id: "lexico", name: label(entry), fix: entry.nota || "", ejemplos: [...new Set(found.map((f) => f.trim()))].slice(0, 3) });
      continue;
    }
    fixed.push({ find: label(entry), replace: entry.replace || "(borrado)", count: found.length });
    if (!entry.replace) {
      deleted = true;
      rx = new RegExp(rx.source + "[ \\t]*", rx.flags);
    }
    text = text.replace(rx, (m) => matchCase(m, entry.replace));
  }
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]*([,.;:])\s*/gm, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  if (deleted) {
    text = text.replace(/(^|[.!?]\s+|\n\s*|[¿¡])([a-záéíóúñ])/gu, (_, a, b) => a + b.toUpperCase());
  }
  return { text, fixed, flagged };
}

function scanStructures(text, lex) {
  const flags = [];
  for (const s of lex.structures) {
    if (!compiled.has(s)) {
      try {
        compiled.set(s, pyRegex(s.regex, "gm"));
      } catch {
        compiled.set(s, null);
      }
    }
    const rx = compiled.get(s);
    if (!rx) continue;
    const found = text.match(rx) || [];
    if (found.length >= (s.min || 1)) flags.push({ id: s.id, name: s.name, fix: s.fix });
  }
  // Mezcla de registros (voseo + tuteo) y de vocabulario de España + LatAm.
  const present = (forms) => (forms || []).some((w) => wordRegex(w).test(text));
  const regs = lex.registros || {};
  const mix = ["voseo", "tuteo", "vosotros"].filter((k) => present(regs[k]));
  if (mix.length > 1) {
    flags.push({ id: "registro-mezcla", name: `Mezcla de registros (${mix.join(" + ")})`, fix: "Elegí uno: no mezcles \"tenés\" con \"tienes\"." });
  }
  const voc = lex.vocabulario_regional || {};
  if (present(voc.espana) && present(voc.latam)) {
    flags.push({ id: "vocabulario-mezcla", name: "Mezcla de vocabulario de España y de LatAm", fix: "Elegí una región." });
  }
  return flags;
}

// Devuelve { text, lang, fixed, flags }: el texto limpio, lo que se cambió solo y lo que hay que reescribir.
export function humanize(raw, lang = detectLang(raw)) {
  const lex = lang === "en" ? EN : ES;
  const urls = [];
  let text = raw.replace(URL_RE, (u) => `\u0000URL${urls.push(u) - 1}\u0000`);
  text = passInvisible(text, lex);
  text = passTypographic(text, lex);
  const lexical = passLexical(text, lex);
  text = lexical.text.replace(/\u0000URL(\d+)\u0000/g, (_, i) => urls[i]).trim();
  return { text, lang, fixed: lexical.fixed, flags: [...lexical.flagged, ...scanStructures(text, lex)] };
}
