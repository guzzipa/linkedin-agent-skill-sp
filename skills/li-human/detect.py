#!/usr/bin/env python3
"""
detect.py - panel de cinco chequeos que puntúa cuán "escrito por máquina" se ve
un borrador, en español o en inglés.

Qué es:   cinco heurísticas locales basadas en las señales que miden los
detectores públicos: variación del largo de oraciones, concreción, léxico de
manual, huella tipográfica y voz. Todo se calcula en tu máquina, desde el texto.
No se sube nada.

Qué NO es:  GPTZero, Originality, Copyleaks, Winston ni Turnitin. No llama a sus
APIs y no puede prometer su veredicto. Lo único honesto que se puede decir es
que mide lo mismo que ellos miran.

Diferencias con el original (que solo entendía inglés):
  - VOZ en español no busca contracciones (no existen). Mide persona gramatical,
    marcas de oralidad y coherencia de registro: mezclar "tenés" con "tienes"
    es la señal de IA más fuerte en un texto rioplatense.
  - CONCRECIÓN no cuenta un año suelto como dato, ni la primera palabra de una
    oración (o la que sigue a ¿ o ¡) como nombre propio.
  - El léxico es por idioma y nunca cruza idiomas.

Cada chequeo devuelve un puntaje HUMANO de 0 a 100. Más alto es mejor.

Uso
  python3 detect.py borrador.txt
  python3 detect.py borrador.txt --registro voseo
  pbpaste | python3 detect.py -
  python3 detect.py borrador.txt --json
  python3 detect.py antes.txt despues.txt      # comparar dos versiones
"""

import argparse
import json
import os
import re
import statistics
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LEXDIR = os.path.join(HERE, "lexicons")

SENT_RE = re.compile(r"[^.!?\n]+[.!?]*")
WORD_RE = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+")

EN_CONTRACTIONS = re.compile(r"\b\w+'(?:s|t|re|ve|ll|d|m)\b", re.IGNORECASE)
EN_PRONOUNS = re.compile(r"\b(i|me|my|mine|we|us|our|you|your)\b", re.IGNORECASE)
ES_PERSONA = re.compile(
    r"(?<!\w)(yo|me|mi|mis|conmigo|nosotros|nosotras|nos|nuestro|nuestra|nuestros|nuestras|"
    r"vos|te|tu|tus|ti|tú|usted|ustedes|les)(?!\w)", re.IGNORECASE)
# Verbos en primera persona del pretérito, que es como se cuenta algo que te pasó.
ES_PRIMERA = re.compile(r"(?<!\w)\w{3,}(?:é|í|amos|imos)(?!\w)", re.IGNORECASE)
ES_NO_VERBO = {"café", "bebé", "comité", "puré", "chalé", "consomé", "entonces", "algunos",
               "primos", "mismos", "así", "aquí", "allí", "ahí", "aunque", "jabalí", "maniquí", "últimos", "próximos", "mínimos", "máximos", "íntimos"}

NUM_UNIT = re.compile(
    r"(?:[$€]\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:%|x\b|k\b|M\b|MM\b|USD\b|ARS\b|MXN\b|BRL\b|COP\b|CLP\b|"
    r"millones|mil\b|horas?|hs\b|días|semanas|meses|años|minutos|min\b|personas|clientes|usuarios|"
    r"equipos?|veces|puntos|pp\b|bps\b))", re.IGNORECASE)
NUM_WORDS = (r"(?:un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|"
             r"treinta|cuarenta|cincuenta|cien|mil|two|three|four|five|six|seven|eight|nine|ten|twelve)")
WORD_UNIT = re.compile(r"(?<!\w)" + NUM_WORDS + r"\s+(?:horas?|días?|semanas?|meses|mes|años?|minutos?|personas|"
                       r"clientes|veces|puntos|hours?|days?|weeks?|months?|years?|people|clients|times)(?!\w)",
                       re.IGNORECASE)
WHEN = re.compile(r"(?<!\w)(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|"
                  r"noviembre|diciembre|lunes|martes|miércoles|jueves|viernes|sábado|domingo|january|february|"
                  r"march|april|june|july|august|september|october|november|december|monday|tuesday|"
                  r"wednesday|thursday|friday|saturday|sunday)(?!\w)", re.IGNORECASE)
ACRONYM = re.compile(r"\b[A-Z]{2,6}\b")
GENERIC_ACRONYMS = {"IA", "AI", "ML", "CEO", "CTO", "CDO", "OK", "LATAM", "B2B", "B2C", "KPI", "KPIS", "ROI"}
QUOTE = re.compile(r'"[^"\n]{3,80}"|«[^»\n]{3,80}»|“[^”\n]{3,80}”')
BARE_NUM = re.compile(r"\b\d[\d.,]*\b")
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
PROPER = re.compile(r"(?<![.!?¿¡:]\s)(?<![¿¡])(?<!^)\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b", re.MULTILINE)
# Palabras que van en mayúscula en LinkedIn sin ser un dato concreto.
GENERIC_CAPS = {"Data", "Analytics", "Machine", "Learning", "Inteligencia", "Artificial", "LinkedIn",
                "Product", "Head", "Chief", "Officer", "Manager", "Lead", "Senior", "Business"}

STOP_ES = {"el", "la", "los", "las", "de", "del", "que", "y", "en", "un", "una", "por", "para",
           "con", "es", "se", "no", "lo", "como", "más", "pero", "su", "al", "este", "esta"}
STOP_EN = {"the", "and", "of", "to", "a", "in", "is", "that", "for", "it", "with", "as", "was",
           "on", "are", "be", "this", "you", "i", "we", "not", "but", "at", "by"}

REGISTRO_CHOQUES = {
    "voseo": ["tuteo", "vosotros"], "tuteo": ["voseo", "vosotros"],
    "usted": ["voseo", "tuteo", "vosotros"], "neutro": ["vosotros"], "espana": ["voseo"],
}


def detect_lang(text):
    toks = re.findall(r"[a-záéíóúñü]+", text.lower())
    es = sum(t in STOP_ES for t in toks) + 2 * len(re.findall(r"[ñ¿¡áéíóú]", text.lower()))
    en = sum(t in STOP_EN for t in toks)
    return "es" if es >= en else "en"


def clamp(n):
    return max(0.0, min(100.0, n))


def scale(value, human, machine):
    if human == machine:
        return 50.0
    return clamp((value - machine) / (human - machine) * 100)


def sentences(text):
    """Oraciones con al menos una palabra real. Las cortas cuentan: "Funcionaba." es la marca humana."""
    out = []
    for s in SENT_RE.findall(text):
        real = [w for w in s.split() if re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", w) and not w.startswith("#")]
        if real:
            out.append(" ".join(real))
    return out


def words(text):
    return WORD_RE.findall(text)


def entry_regex(entry):
    body = entry.get("pattern") or re.escape(entry["find"]).replace(r"\ ", r"\s+")
    return re.compile(r"(?<!\w)(?:" + body + r")(?!\w)", re.IGNORECASE)


def word_regex(w):
    return re.compile(r"(?<!\w)" + re.escape(w) + r"(?!\w)", re.IGNORECASE)


# --------------------------------------------------------------------------
# chequeos

def check_burstiness(text, lang):
    lens = [len(s.split()) for s in sentences(text)]
    if len(lens) < 4:
        return 50.0, "muy corto para juzgar"
    mean = statistics.mean(lens)
    cv = statistics.pstdev(lens) / mean if mean else 0
    score = scale(cv, human=0.60, machine=0.22)
    return score, f"variación {cv:.2f} en {len(lens)} oraciones (ideal 0.55+)"


def check_specificity(text, lang):
    w = words(text)
    if len(w) < 25:
        return 50.0, "muy corto para juzgar"
    with_unit = NUM_UNIT.findall(text)
    bare = [n for n in BARE_NUM.findall(text) if not YEAR.fullmatch(n)]
    years = YEAR.findall(text)
    names = {p for p in PROPER.findall(text) if p not in GENERIC_CAPS and not WHEN.fullmatch(p)}
    names |= {a for a in ACRONYM.findall(text) if a not in GENERIC_ACRONYMS}
    worded = WORD_UNIT.findall(text)
    when = WHEN.findall(text)
    quotes = QUOTE.findall(text)
    nums = len(with_unit) + len(worded)
    hits = (nums + 0.5 * max(0, len(bare) - len(with_unit)) + 0.25 * len(years)
            + len(names) + 0.5 * len(when) + 0.5 * len(quotes))
    density = hits * 100 / len(w)
    score = scale(density, human=4.5, machine=0.5)
    return score, (f"{nums} cifras con unidad, {len(names)} nombres propios o siglas, "
                   f"{len(when)} fechas, {len(quotes)} citas: {density:.1f} marcas cada 100 palabras (ideal 3+)")


def check_slop(text, lex, lang):
    w = words(text)
    if not w:
        return 50.0, "vacío"
    hits, found = 0, []
    for entry in lex["words"] + lex["phrases"]:
        n = len(entry_regex(entry).findall(text))
        if n:
            hits += n
            found.append(entry.get("label") or entry.get("find") or entry.get("pattern"))
    density = hits * 100 / len(w)
    score = scale(density, human=0.0, machine=4.0)
    detail = f"{hits} términos de manual, {density:.1f} cada 100 palabras"
    if found:
        detail += " (" + ", ".join(sorted(found)[:4]) + (", ..." if len(found) > 4 else "") + ")"
    return score, detail


def check_fingerprint(text, lang):
    invisible = sum(1 for c in text if unicodedata.category(c) == "Cf")
    em = text.count("—")
    curly = sum(text.count(c) for c in "‘’“”")
    ellip = text.count("…")
    nbsp = sum(text.count(c) for c in "   ")
    total = invisible * 4 + em * 2 + curly + ellip + nbsp
    per1k = total * 1000 / max(len(text), 1)
    score = scale(per1k, human=0.0, machine=12.0)
    return score, (f"{invisible} invisibles, {em} rayas, {curly} comillas curvas, "
                   f"{ellip} elipsis, {nbsp} espacios duros")


def structural_tells(text, lex):
    tells, names = 0, []
    for s in lex["structures"]:
        try:
            n = len(re.compile(s["regex"], re.MULTILINE).findall(text))
        except re.error:
            continue
        if n >= s.get("min", 1):
            tells += n
            names.append(s["id"])
    return tells, names


def registro_problems(text, lex, registro):
    regs = lex.get("registros") or {}
    counts = {k: sum(len(word_regex(w).findall(text)) for w in forms) for k, forms in regs.items()}
    if registro in REGISTRO_CHOQUES:
        bad = {k: counts.get(k, 0) for k in REGISTRO_CHOQUES[registro] if counts.get(k)}
    else:
        present = {k: counts[k] for k in ("voseo", "tuteo", "vosotros") if counts.get(k)}
        bad = present if len(present) > 1 else {}
    return bad, counts


def check_voice(text, lex, lang, registro):
    w = words(text)
    if len(w) < 25:
        return 50.0, "muy corto para juzgar"
    per100 = 100 / len(w)
    tells, names = structural_tells(text, lex)
    bullets = [len(b.split()) for b in re.findall(r"(?m)^\s*[-*•]\s+(.+)$", text)]
    uniform = len(bullets) >= 3 and statistics.pstdev(bullets) < 1.6

    if lang == "en":
        contractions = len(EN_CONTRACTIONS.findall(text)) * per100
        person = len(EN_PRONOUNS.findall(text)) * per100
        score = (scale(contractions, 3.0, 0.0) * 0.35 + scale(person, 8.0, 1.0) * 0.35
                 + clamp(100 - tells * 22) * 0.30)
        detail = (f"{contractions:.1f} contracciones, {person:.1f} pronombres personales "
                  f"cada 100 palabras, {tells} estructura(s) de manual")
    else:
        persona = len(ES_PERSONA.findall(text))
        primera = len([m for m in ES_PRIMERA.findall(text) if m.lower() not in ES_NO_VERBO])
        person = (persona + primera) * per100
        oral = sum(len(word_regex(m).findall(text)) for m in lex.get("oralidad", []))
        oral += text.count("(")  # los apartes entre paréntesis son muy humanos
        oral100 = oral * per100
        bad, _ = registro_problems(text, lex, registro)
        reg_pen = min(100, 35 * sum(bad.values())) if bad else 0
        score = (scale(person, 7.0, 1.0) * 0.40 + scale(oral100, 1.2, 0.0) * 0.20
                 + clamp(100 - tells * 20) * 0.40) - reg_pen * 0.5
        detail = (f"{person:.1f} marcas de persona y {oral100:.1f} de oralidad cada 100 palabras, "
                  f"{tells} estructura(s) de manual")
        if bad:
            names.insert(0, "registro:" + "+".join(bad))
    if uniform:
        score -= 12
        names.append("viñetas-uniformes")
    if names:
        detail += " [" + ", ".join(names[:4]) + "]"
    return clamp(score), detail


CHECKS = ["VARIACIÓN", "CONCRECIÓN", "LÉXICO", "HUELLA", "VOZ"]


def run(text, lex, lang, registro="auto"):
    results = {
        "VARIACIÓN": check_burstiness(text, lang),
        "CONCRECIÓN": check_specificity(text, lang),
        "LÉXICO": check_slop(text, lex, lang),
        "HUELLA": check_fingerprint(text, lang),
        "VOZ": check_voice(text, lex, lang, registro),
    }
    scores = [results[c][0] for c in CHECKS]
    overall = statistics.mean(scores) * 0.6 + min(scores) * 0.4
    verdict = "PASA" if overall >= 70 and min(scores) >= 55 else (
        "REVISAR" if overall >= 50 else "MARCADO")
    return results, overall, verdict


def bar(score, width=24):
    filled = round(score / 100 * width)
    return "#" * filled + "." * (width - filled)


def render(results, overall, verdict, lang, label=None, out=sys.stdout):
    title = f"PANEL DE DETECCIÓN  [idioma: {lang}]" + (f"  -  {label}" if label else "")
    print("\n" + title, file=out)
    print("=" * max(len(title), 62), file=out)
    for name in CHECKS:
        score, detail = results[name]
        print(f"  {name:<12} {bar(score)} {score:5.1f}", file=out)
        print(f"  {'':<12} {detail}", file=out)
    print("-" * 62, file=out)
    print(f"  {'PUNTAJE':<12} {bar(overall)} {overall:5.1f}   {verdict}", file=out)
    if verdict != "PASA":
        weakest = min(CHECKS, key=lambda c: results[c][0])
        print(f"\n  Señal más débil: {weakest}. Arreglá eso primero.", file=out)
    print("", file=out)


def main():
    ap = argparse.ArgumentParser(description="Puntúa cuán escrito por máquina se ve un borrador.")
    ap.add_argument("input", nargs="?", default="-", help="archivo, o - para stdin")
    ap.add_argument("compare", nargs="?", help="segundo archivo, para ver antes/después")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--lang", default="auto", choices=["auto", "es", "en"])
    ap.add_argument("--registro", default="auto",
                    choices=["auto", "voseo", "tuteo", "usted", "neutro", "espana"])
    ap.add_argument("--lexicon", help="ruta a un léxico propio (pisa --lang)")
    args = ap.parse_args()

    read = lambda p: sys.stdin.read() if p == "-" else open(p, encoding="utf-8").read()
    targets = [(args.input, read(args.input))]
    if args.compare:
        targets.append((args.compare, read(args.compare)))

    payload, runs = [], []
    for name, text in targets:
        lang = detect_lang(text) if args.lang == "auto" else args.lang
        path = args.lexicon or os.path.join(LEXDIR, f"{lang}.json")
        lex = json.load(open(path, encoding="utf-8"))
        results, overall, verdict = run(text, lex, lang, args.registro)
        runs.append((results, overall, verdict, lang))
        payload.append({
            "source": name,
            "idioma": lang,
            "checks": {k: {"score": round(v[0], 1), "detail": v[1]} for k, v in results.items()},
            "human_score": round(overall, 1),
            "verdict": verdict,
        })

    if args.json:
        print(json.dumps(payload if args.compare else payload[0], indent=2, ensure_ascii=False))
        return

    for (name, _), (results, overall, verdict, lang) in zip(targets, runs):
        render(results, overall, verdict, lang, label=os.path.basename(name) if args.compare else None)
    if args.compare:
        a, b = payload
        delta = b["human_score"] - a["human_score"]
        print(f"  {a['human_score']:.1f} {a['verdict']}  ->  "
              f"{b['human_score']:.1f} {b['verdict']}   ({delta:+.1f})\n")

    sys.exit(0 if payload[-1]["verdict"] == "PASA" else 1)


if __name__ == "__main__":
    main()
