// Copia los léxicos del humanizador desde linkedin-agent-skill-sp, para que la extensión
// marque lo mismo que /li-human. Uso: npm run sync-lexicon [-- ruta/al/repo]
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2] || join(import.meta.dirname, "..", "..", "linkedin-agent-skill-sp");
const dir = join(repo, "skills", "li-human", "lexicons");
if (!existsSync(dir)) {
  console.error(`No encontré ${dir}. Pasá la ruta al repo: npm run sync-lexicon -- /ruta/linkedin-agent-skill-sp`);
  process.exit(1);
}
for (const f of ["es.json", "en.json"]) copyFileSync(join(dir, f), join(import.meta.dirname, "..", "src", "lexicons", f));
console.log(`Léxicos copiados desde ${dir}`);
