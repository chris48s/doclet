import { rm } from "node:fs/promises";
import * as esbuild from "esbuild";

const outdir = "dist";

const options = {
  entryPoints: [
    "src/index.html",
    "src/jsfile/index.js",
    "src/jsfile/index.html",
    "src/jsrepo/index.js",
    "src/jsrepo/index.html",
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
  await ctx.serve();
} else {
  await rm(outdir, { recursive: true, force: true });
  await esbuild.build({ ...options, minify: true });
}
