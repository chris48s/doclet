import { rm } from "node:fs/promises";
import * as esbuild from "esbuild";

const outdir = "dist";

const options = {
  entryPoints: [
    "src/index.html",
    "src/jsdoc/index.js",
    "src/jsdoc/index.html",
    "src/css/styles.css",
  ],
  outbase: "src",
  outdir,
  bundle: true,
  format: "esm",
  loader: { ".html": "copy" },
  logLevel: "info",
};

if (process.argv.includes("--serve")) {
  const ctx = await esbuild.context(options);
  // Serve only generated output so source files can't shadow the bundles
  const { hosts, port } = await ctx.serve();
  console.log(`Serving at http://${hosts[0]}:${port}/jsdoc/index.html`);
} else {
  await rm(outdir, { recursive: true, force: true });
  await esbuild.build({ ...options, minify: true });
}
