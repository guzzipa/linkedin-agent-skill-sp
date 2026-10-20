// Empaqueta el service worker (que usa el SDK de Anthropic) y la página de opciones,
// y copia el resto a dist/. Cargá dist/ en chrome://extensions → "Cargar descomprimida".
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const watch = process.argv.includes("--watch");
const STATIC = ["manifest.json", "content.js", "content.css", "options.html"];

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");

const copyStatic = {
  name: "copy-static",
  setup(build) {
    build.onEnd(() => {
      for (const f of STATIC) cpSync(`src/${f}`, `dist/${f}`);
      console.log(`[build] dist/ listo (${new Date().toLocaleTimeString()})`);
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ["src/background.js", "src/options.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  outdir: "dist",
  plugins: [copyStatic],
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
