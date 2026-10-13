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


@test
def aperturas_y_contrastes_comunes():
    text = ("En el mundo actual, hay que aprovechar el poder de la IA.\n"
            "No se trata solo de herramientas, se trata de criterio.\n"
            "Cabe destacar que la gente lo nota.\n")
    res = json.loads(run("humanize.py", "-", "--json", stdin=text).stdout)
    assert res["text"].startswith("Hoy, hay que"), res["text"]
    assert "\nLa gente lo nota." in res["text"], "borrar una frase no debe dejar sangría"
    assert any("aprovechar" in f["find"] for f in res["report"]["lexical_flags"])
    assert "no-es-solo" in ids(res["report"])


@test
def textos_de_otras_regiones_sin_falsos_positivos():
    for fixture, registro in (("humano_mx.txt", "tuteo"), ("humano_esp.txt", "espana"),
                              ("dialogo_es.txt", "voseo")):
        rep = humanize(fixture, "--registro", registro)["report"]
        assert not rep["lexical_flags"] and not rep["structures"], (fixture, rep)
        assert detect(fixture, "--registro", registro)["verdict"] == "PASA", fixture


@test
def oralidad_de_cualquier_region_suma():
    # "la neta", "ahorita", "chamba": un texto mexicano no pierde voz por no ser rioplatense
    assert detect("humano_mx.txt")["checks"]["VOZ"]["score"] >= 90


@test
def raya_de_dialogo_se_respeta():
    text = ("—Nos vamos con alguien más barato —me dijo.\n"
            "Le contesté: —Perfecto.\n"
            "La clave — y esto importa — es otra.\n")
    out = run("humanize.py", "-", stdin=text).stdout
    assert out.startswith("—Nos vamos con alguien más barato —me dijo."), out
    assert "Le contesté: —Perfecto." in out, out
    assert "La clave, y esto importa, es otra." in out, out
    assert detect("dialogo_es.txt")["checks"]["HUELLA"]["score"] == 100


@test
def marcas_del_espanol_de_traduccion():
    text = ("En primer lugar, migramos el sistema en Enero, logrando bajar los costos.\n"
            "El proyecto fue desarrollado por el equipo y fue aprobado por la dirección.\n"
            "Lo hicimos rápidamente y eficientemente. Levanté mi mano en la reunión.\n"
            "En segundo lugar, al día de hoy es por ello que medimos en una base diaria.\n")
    res = json.loads(run("humanize.py", "-", "--json", stdin=text).stdout)
    found = ids(res["report"])
    for need in ("gerundio-posterioridad", "pasiva-por", "adverbios-mente", "posesivo-calco",
                 "mayuscula-calco", "andamiaje"):
        assert need in found, f"falta {need}: {found}"
    assert "hoy por eso medimos" in res["text"].lower(), res["text"]
    assert any("base diaria" in f["find"] for f in res["report"]["lexical_flags"])


@test
def vocabulario_regional():
    mezcla = "Dejé el ordenador en la oficina y contesté todo desde el celular, como siempre.\n"
    assert "vocabulario-mezcla" in ids(json.loads(run("humanize.py", "-", "--json", stdin=mezcla).stdout)["report"])
    latam = "Contesté todo desde el celular, como siempre.\n"
    rep = json.loads(run("humanize.py", "-", "--json", "--registro", "espana", stdin=latam).stdout)["report"]
    assert "vocabulario-latam" in ids(rep), rep


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
