#!/usr/bin/env python3
"""
humanize.py - saca la huella de máquina de un borrador, en español o en inglés.

Cuatro pasadas, en este orden:

  1. INVISIBLES   borra los caracteres que un teclado humano no produce:
                  espacios de ancho cero, word joiners, guiones blandos, BOM,
                  caracteres de etiqueta Unicode, espacios duros y finos.
  2. TIPOGRAFÍA   raya -> coma, comillas curvas -> rectas, elipsis -> tres
                  puntos, viñeta -> guion.
  3. LÉXICO       reemplaza lo que tiene reemplazo seguro (conectores de
                  ensayo, calcos con equivalente exacto como "hace sentido")
                  y MARCA para reescribir a mano lo que depende del contexto,
                  del género o del número ("robusto/a/os/as", "potenciar").
                  Nunca mete una palabra de otro idioma.
  4. ESTRUCTURAS  reporta, sin tocar: "No es solo X, es Y", "¿El resultado?",
                  tríadas, cebo de interacción, mayúsculas de título en inglés,
                  broetry, y la mezcla de voseo/tuteo/vosotros.

El idioma se detecta solo (es/en). El registro se toma de --registro o se
infiere: si el texto mezcla "tenés" y "tienes", eso se marca siempre.

Uso
  python3 humanize.py borrador.txt
  python3 humanize.py borrador.txt --report
  python3 humanize.py borrador.txt -o limpio.txt --report --registro voseo
  pbpaste | python3 humanize.py - --report
  python3 humanize.py borrador.txt --json
"""

import argparse
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LEXDIR = os.path.join(HERE, "lexicons")

URL_RE = re.compile(r"https?://\S+|www\.\S+|\S+@\S+\.\S+")
SENT_RE = re.compile(r"[^.!?\n]+[.!?]*")

STOP_ES = {"el", "la", "los", "las", "de", "del", "que", "y", "en", "un", "una", "por", "para",
           "con", "es", "se", "no", "lo", "como", "más", "pero", "su", "al", "este", "esta"}
STOP_EN = {"the", "and", "of", "to", "a", "in", "is", "that", "for", "it", "with", "as", "was",
           "on", "are", "be", "this", "you", "i", "we", "not", "but", "at", "by"}

REGISTRO_CHOQUES = {
    # registro elegido -> formas que no deberían aparecer
    "voseo": ["tuteo", "vosotros"],
    "tuteo": ["voseo", "vosotros"],
    "usted": ["voseo", "tuteo", "vosotros"],
    "neutro": ["vosotros"],
    "espana": ["voseo"],
}


# --------------------------------------------------------------------------
# idioma y léxico

def detect_lang(text):
    toks = re.findall(r"[a-záéíóúñü]+", text.lower())
    es = sum(t in STOP_ES for t in toks) + 2 * len(re.findall(r"[ñ¿¡áéíóú]", text.lower()))
    en = sum(t in STOP_EN for t in toks)
    return "es" if es >= en else "en"


def load_lexicon(lang=None, path=None):
    path = path or os.path.join(LEXDIR, f"{lang}.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def entry_regex(entry):
    body = entry.get("pattern") or re.escape(entry["find"]).replace(r"\ ", r"\s+")
    return re.compile(r"(?<!\w)(?:" + body + r")(?!\w)", re.IGNORECASE)


def entry_label(entry):
    return entry.get("label") or entry.get("find") or entry.get("pattern")


def word_regex(word):
    return re.compile(r"(?<!\w)" + re.escape(word) + r"(?!\w)", re.IGNORECASE)


def _cp(spec):
    if "-" in spec:
        a, b = spec.split("-")
        return (int(a[2:], 16), int(b[2:], 16))
    return int(spec[2:], 16)


# --------------------------------------------------------------------------
# URLs fuera del alcance de todas las pasadas

def protect_urls(text):
    found = []

    def stash(m):
        found.append(m.group(0))
        return f"\x00URL{len(found) - 1}\x00"

    return URL_RE.sub(stash, text), found


def restore_urls(text, found):
    for i, url in enumerate(found):
        text = text.replace(f"\x00URL{i}\x00", url)
    return text


# --------------------------------------------------------------------------
# pasadas

def pass_invisible(text, lex):
    hits = []
    for entry in lex["invisible"]:
        cp = _cp(entry["cp"])
        if isinstance(cp, tuple):
            pattern = "[" + re.escape(chr(cp[0])) + "-" + re.escape(chr(cp[1])) + "]"
        else:
            pattern = re.escape(chr(cp))
        n = len(re.findall(pattern, text))
        if n:
            hits.append({"name": entry["cp"] + " " + entry["name"], "count": n,
                         "action": entry["action"]})
            text = re.sub(pattern, "" if entry["action"] == "delete" else " ", text)
    stray = [c for c in text if unicodedata.category(c) == "Cf"]
    if stray:
        hits.append({"name": "otros caracteres de formato invisibles", "count": len(stray),
                     "action": "delete"})
        text = "".join(c for c in text if unicodedata.category(c) != "Cf")
    return text, hits


def pass_typographic(text, lex):
    hits = []
    for entry in lex["typographic"]:
        ch = entry["from"]
        n = text.count(ch)
        if not n:
            continue
        hits.append({"name": f"{ch} {entry['name']}", "count": n,
                     "to": entry["to"].strip() or "(espacio)"})
        if ch == "—":
            # "un inciso — así — en medio" y "palabra—palabra" pasan a coma.
            text = re.sub(r"\s*—\s*", ", ", text)
        elif ch == "–":
            text = re.sub(r"\s*–\s*(?=\d)", "-", text)
            text = re.sub(r"\s+–\s+", ", ", text)
            text = text.replace("–", "-")
        else:
            text = text.replace(ch, entry["to"])
    text = re.sub(r",\s*([,.;:!?])", r"\1", text)
    text = re.sub(r",\s*\n", "\n", text)
    text = re.sub(r"(?m)^,\s*", "", text)
    return text, hits


def _match_case(src, repl):
    if not repl:
        return repl
    if src.isupper() and len(src) > 1:
        return repl.upper()
    if src[0].isupper():
        return repl[0].upper() + repl[1:]
    return repl


def _recapitalize(text):
    """Después de borrar una frase al inicio de oración, la oración queda en minúscula."""
    return re.sub(r"(^|[.!?]\s+|\n\s*|[¿¡])([a-záéíóúñ])",
                  lambda m: m.group(1) + m.group(2).upper(), text)


def pass_lexical(text, lex):
    """Reemplaza lo seguro y marca lo que necesita criterio. Frases más largas primero."""
    fixed, flagged = [], []
    entries = sorted(lex["phrases"] + lex["words"],
                     key=lambda e: len(e.get("find") or e.get("pattern")), reverse=True)
    deleted = False
    for entry in entries:
        rx = entry_regex(entry)
        found = rx.findall(text)
        if not found:
            continue
        if entry["replace"] is None:
            flagged.append({"find": entry_label(entry), "count": len(found),
                            "family": entry["family"], "nota": entry.get("nota", ""),
                            "ejemplos": sorted({f.strip() for f in found})[:3]})
            continue
        fixed.append({"find": entry_label(entry), "replace": entry["replace"] or "(borrado)",
                      "count": len(found), "family": entry["family"]})
        if not entry["replace"]:
            deleted = True
        text = rx.sub(lambda m: _match_case(m.group(0), entry["replace"]), text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"(?m)^[ \t]*([,.;:])\s*", "", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"(?m)^[ \t]+$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if deleted:
        text = _recapitalize(text)
    # Una raya que pasó a coma seguida de conector deja una oración pegada.
    text = re.sub(r",\s*(también|así que|por eso|igual|aun así|also|so|still|in the end)\s*,\s*",
                  lambda m: ". " + m.group(1)[0].upper() + m.group(1)[1:] + ", ", text)
    return text, fixed, flagged


# --------------------------------------------------------------------------
# estructuras (se reportan, no se reescriben)

def scan_registro(text, lex, registro="auto"):
    """Devuelve (flags, conteos). Marca formas que chocan con el registro, o la mezcla."""
    regs = lex.get("registros") or {}
    if not regs:
        return [], {}
    counts = {}
    for name, forms in regs.items():
        hits = []
        for w in forms:
            hits += [m.group(0) for m in word_regex(w).finditer(text)]
        counts[name] = hits
    flags = []
    if registro in REGISTRO_CHOQUES:
        for other in REGISTRO_CHOQUES[registro]:
            if counts.get(other):
                flags.append({
                    "id": f"registro-{other}",
                    "name": f"Formas de {other} en un texto en {registro}",
                    "count": len(counts[other]),
                    "fix": "Pasalas a tu registro: " + ", ".join(sorted(set(counts[other]))[:6]) + ".",
                })
    else:
        present = [k for k in ("voseo", "tuteo", "vosotros") if counts.get(k)]
        if len(present) > 1:
            flags.append({
                "id": "registro-mezcla",
                "name": "Mezcla de registros (" + " + ".join(present) + ")",
                "count": sum(len(counts[k]) for k in present),
                "fix": "Una persona no mezcla \"tenés\" con \"tienes\". Es la marca más clara de IA "
                       "en un texto rioplatense. Elegí uno: "
                       + "; ".join(f"{k}: {', '.join(sorted(set(counts[k]))[:4])}" for k in present) + ".",
            })
    return flags, {k: len(v) for k, v in counts.items()}


def scan_broetry(text):
    """Broetry: casi todos los párrafos son una sola oración corta."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip() and not p.strip().startswith("#")]
    if len(paras) < 8:
        return None
    single = [p for p in paras
              if len([s for s in SENT_RE.findall(p) if s.strip()]) <= 1 and len(p.split()) <= 14]
    share = len(single) / len(paras)
    if share >= 0.8:
        return {"id": "broetry", "name": f"Broetry ({len(single)} de {len(paras)} párrafos son una frase suelta)",
                "count": len(single),
                "fix": "Uní dos o tres frases en un párrafo de verdad. El blanco ayuda; un poema de una línea por renglón cansa."}
    return None


def scan_structures(text, lex, registro="auto", lang="es"):
    flags = []
    for s in lex["structures"]:
        try:
            pattern = re.compile(s["regex"], re.MULTILINE)
        except re.error:
            continue
        found = pattern.findall(text)
        if len(found) >= s.get("min", 1):
            flags.append({"id": s["id"], "name": s["name"], "count": len(found), "fix": s["fix"]})
    lens = [len(s.split()) for s in SENT_RE.findall(text)
            if re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{2}", s) and not s.strip().startswith("#")]
    if len(lens) >= 4:
        mean = sum(lens) / len(lens)
        var = sum((n - mean) ** 2 for n in lens) / len(lens)
        cv = (var ** 0.5) / mean if mean else 0
        if cv < 0.35:
            flags.append({
                "id": "uniforme",
                "name": f"Largo de oraciones uniforme (variación {cv:.2f})",
                "count": len(lens),
                "fix": "Partí una oración al medio. Dejá que otra se estire. La máquina escribe parejo.",
            })
    b = scan_broetry(text)
    if b:
        flags.append(b)
    reg_flags, _ = scan_registro(text, lex, registro)
    flags += reg_flags
    return flags


# --------------------------------------------------------------------------

def humanize(text, lex, registro="auto", lang="es"):
    text, urls = protect_urls(text)
    text, inv = pass_invisible(text, lex)
    text, typo = pass_typographic(text, lex)
    text, fixed, flagged = pass_lexical(text, lex)
    text = restore_urls(text, urls)
    return text.strip() + "\n", {
        "idioma": lang,
        "invisible": inv,
        "typographic": typo,
        "lexical": fixed,
        "lexical_flags": flagged,
        "structures": scan_structures(text, lex, registro, lang),
    }


def render_report(report, out=sys.stderr):
    def head(title):
        print(f"\n{title}\n" + "-" * len(title), file=out)

    total = sum(h["count"] for k in ("invisible", "typographic", "lexical") for h in report[k])
    to_rewrite = len(report["lexical_flags"]) + len(report["structures"])

    head(f"INFORME DEL HUMANIZADOR  [idioma: {report['idioma']}]")
    print(f"{total} artefactos de máquina corregidos, {to_rewrite} cosas para reescribir a mano", file=out)

    if report["invisible"]:
        head("1. CARACTERES INVISIBLES  (borrados)")
        for h in report["invisible"]:
            print(f"  {h['count']:>3}x  {h['name']}", file=out)
    if report["typographic"]:
        head("2. TIPOGRAFÍA  (corregida)")
        for h in report["typographic"]:
            print(f"  {h['count']:>3}x  {h['name']}  -> {h['to']}", file=out)
    if report["lexical"]:
        head("3. LÉXICO  (reemplazado)")
        for h in report["lexical"]:
            print(f"  {h['count']:>3}x  {h['find']}  -> {h['replace']}   [{h['family']}]", file=out)
    if report["lexical_flags"]:
        head("4. LÉXICO PARA REESCRIBIR  (no se toca solo: depende del contexto)")
        for h in report["lexical_flags"]:
            ej = ", ".join(f'"{e}"' for e in h["ejemplos"])
            print(f"  {h['count']:>3}x  {h['find']}   [{h['family']}]  en: {ej}", file=out)
            if h["nota"]:
                print(f"        {h['nota']}", file=out)
    if report["structures"]:
        head("5. ESTRUCTURAS  (reescribilas vos)")
        for h in report["structures"]:
            print(f"  {h['count']:>3}x  {h['name']}\n        {h['fix']}", file=out)
    if not total and not to_rewrite:
        head("LIMPIO")
        print("  No hay nada que sacar.", file=out)
    print("", file=out)


def main():
    ap = argparse.ArgumentParser(description="Saca la huella de máquina de un borrador.")
    ap.add_argument("input", nargs="?", default="-", help="archivo, o - para stdin")
    ap.add_argument("-o", "--out", help="escribir el texto limpio acá en vez de stdout")
    ap.add_argument("--report", action="store_true", help="mostrar qué cambió (por stderr)")
    ap.add_argument("--json", action="store_true", help="emitir {text, report} en JSON")
    ap.add_argument("--lang", default="auto", choices=["auto", "es", "en"])
    ap.add_argument("--registro", default="auto",
                    choices=["auto", "voseo", "tuteo", "usted", "neutro", "espana"],
                    help="registro del autor; auto = solo marca mezclas")
    ap.add_argument("--lexicon", help="ruta a un léxico propio (pisa --lang)")
    args = ap.parse_args()

    raw = sys.stdin.read() if args.input == "-" else open(args.input, encoding="utf-8").read()
    lang = detect_lang(raw) if args.lang == "auto" else args.lang
    lex = load_lexicon(lang, args.lexicon)
    clean, report = humanize(raw, lex, args.registro, lang)

    if args.json:
        print(json.dumps({"text": clean, "report": report}, indent=2, ensure_ascii=False))
        return
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(clean)
        print(f"escrito: {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(clean)
    if args.report:
        render_report(report)


if __name__ == "__main__":
    main()
