#!/usr/bin/env python3
"""
Tests del humanizador. Sin dependencias: python3 tests/run_tests.py

Verifica lo que el original rompía o no veía en español:
  - nunca mete palabras en inglés en un texto en español
  - detecta la mezcla de voseo y tuteo
  - separa un texto humano real de uno de manual
  - marca las mayúsculas de título y las viñetas de emoji
  - sigue funcionando en inglés
"""

import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HUMAN = os.path.join(ROOT, "skills", "li-human")
FIX = os.path.join(ROOT, "tests", "fixtures")

ENGLISH_INTRUDERS = {"important", "solid", "using", "also", "right now", "model", "look at"}


def run(script, *args, stdin=None):
    cmd = [sys.executable, "-I", os.path.join(HUMAN, script), *args]
    return subprocess.run(cmd, input=stdin, capture_output=True, text=True)


def humanize(fixture, *extra):
    out = run("humanize.py", os.path.join(FIX, fixture), "--json", *extra)
    return json.loads(out.stdout)


def detect(fixture, *extra):
    out = run("detect.py", os.path.join(FIX, fixture), "--json", *extra)
    return json.loads(out.stdout)


def ids(report):
    return {s["id"] for s in report["structures"]}


TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


@test
def no_mete_ingles_en_espanol():
    res = humanize("slop_es.txt")
    low = res["text"].lower()
    leaked = [w for w in ENGLISH_INTRUDERS if f" {w} " in f" {low} "]
    assert not leaked, f"se coló inglés: {leaked}"
    assert res["report"]["idioma"] == "es"


@test
def detecta_mezcla_voseo_tuteo():
    assert "registro-mezcla" in ids(humanize("slop_es.txt")["report"])


@test
def registro_explicito_marca_tuteo():
    rep = humanize("slop_es.txt", "--registro", "voseo")["report"]
    assert "registro-tuteo" in ids(rep), ids(rep)


@test
def texto_humano_no_tiene_marcas():
    rep = humanize("humano_es.txt", "--registro", "voseo")["report"]
    assert not rep["lexical"] and not rep["lexical_flags"] and not rep["structures"], rep


@test
def sin_falsos_positivos_en_texto_legitimo():
    # "la potencia del servidor" es sustantivo, no el verbo "potenciar"
    rep = humanize("humano_es_2.txt", "--registro", "voseo")["report"]
    assert not rep["lexical_flags"] and not rep["structures"], rep
    assert detect("humano_es_2.txt", "--registro", "voseo")["verdict"] == "PASA"


@test
def separa_humano_de_slop():
    h, s = detect("humano_es.txt"), detect("slop_es.txt")
    assert h["verdict"] == "PASA", h
    assert s["verdict"] == "MARCADO", s
    assert h["human_score"] - s["human_score"] >= 40


@test
def estructuras_de_manual_en_espanol():
    found = ids(humanize("slop_es.txt")["report"])
    for need in ("no-es-solo", "no-se-trata", "revelacion", "apertura-anuncio", "cebo",
                 "cierre-ensayo", "hashtag-muro"):
        assert need in found, f"falta {need}: {found}"


@test
def reemplazos_seguros_y_marcas():
    rep = humanize("slop_es.txt")["report"]
    flagged = {f["find"] for f in rep["lexical_flags"]}
    assert "robusto" in flagged and "potenciar" in flagged, flagged
    # "es importante destacar que" se borra y la oración queda con mayúscula
    text = humanize("slop_es.txt")["text"]
    assert "Aprovechar los datos" in text, text


@test
def titulo_y_vinetas_emoji():
    found = ids(humanize("titulo_es.txt")["report"])
    assert {"title-case", "emoji-vinetas"} <= found, found


@test
def ingles_sigue_andando():
    res = humanize("slop_en.txt")
    assert res["report"]["idioma"] == "en"
    assert "not-just" in ids(res["report"]) or "—" not in res["text"]
    assert detect("slop_en.txt")["verdict"] == "MARCADO"


@test
def urls_intactas():
    text = "Lo dejé en https://ejemplo.com/es-importante-destacar-que—robusto y listo, es importante destacar que funciona.\n"
    out = run("humanize.py", "-", stdin=text).stdout
    assert "https://ejemplo.com/es-importante-destacar-que—robusto" in out, out


@test
def invisibles_fuera():
    text = "Hola​ mundo con espacios⁠ raros. " * 3
    out = run("humanize.py", "-", stdin=text).stdout
    assert "​" not in out and " " not in out and "⁠" not in out


def main():
    failed = 0
    for fn in TESTS:
        try:
            fn()
            print(f"  ok    {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FALLA {fn.__name__}: {e}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} ok")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
