// El port JS tiene que marcar lo mismo que skills/li-human/humanize.py.
// Si el repo de skills está al lado, compara contra Python; si no, corre solo los casos fijos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { humanize, pyRegex } from "../src/humanize.js";

const SKILLS = join(import.meta.dirname, "..", "..", "linkedin-agent-skill-sp");
const PY = join(SKILLS, "skills", "li-human", "humanize.py");
const FIX = join(SKILLS, "tests", "fixtures");
const IGNORAR = new Set(["uniforme", "broetry"]); // chequeos de post largo que la extensión no corre

test("todas las regex del léxico compilan en JS", () => {
  const lex = JSON.parse(readFileSync(join(import.meta.dirname, "..", "src", "lexicons", "es.json"), "utf8"));
  for (const s of lex.structures) assert.doesNotThrow(() => pyRegex(s.regex, "gm"), s.id);
});

test("limpia rayas, comillas y relleno, y respeta el diálogo", () => {
  const r = humanize("Cabe destacar que la clave — y esto importa — es otra.\n—Nos vamos —me dijo.");
  assert.equal(r.text, "La clave, y esto importa, es otra.\n—Nos vamos —me dijo.");
});

test("las tildes no rompen los bordes de palabra", () => {
  // "potencia" es sustantivo: no debe marcarse como el verbo "potenciar"
  const r = humanize("Medimos la potencia del servidor y la potenciación del equipo en marzo.");
  assert.ok(!r.flags.some((f) => /potenci/i.test(f.name)), JSON.stringify(r.flags));
});

test("marca lo mismo que la versión en Python", { skip: !existsSync(PY) && "no está linkedin-agent-skill-sp al lado" }, () => {
  for (const f of readdirSync(FIX).filter((f) => f.endsWith("_es.txt") || f.endsWith("_mx.txt") || f.endsWith("_esp.txt"))) {
    const text = readFileSync(join(FIX, f), "utf8");
    const py = JSON.parse(execFileSync("python3", ["-I", PY, join(FIX, f), "--json"], { encoding: "utf8" }));
    const js = humanize(text);
    const pyIds = new Set([...py.report.structures.map((s) => s.id).filter((id) => !IGNORAR.has(id)),
                           ...py.report.lexical_flags.map((l) => "lexico:" + l.find)]);
    const jsIds = new Set(js.flags.map((s) => (s.id === "lexico" ? "lexico:" + s.name : s.id)));
    assert.deepEqual([...jsIds].sort(), [...pyIds].sort(), f);
    assert.equal(js.text, py.text.trim(), f);
  }
});
