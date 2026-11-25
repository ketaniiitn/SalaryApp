// Builds the API for Vercel with the Build Output API (https://vercel.com/docs/build-output-api).
// The Express app and the billing code are bundled into one file, so Vercel does not have to resolve
// imports across server/ and billing/ the way tsx does locally.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "server/package.json"));
const { build } = require("esbuild");

const output = path.join(root, ".vercel/output");
const functionDir = path.join(output, "functions/api.func");
const region = process.env.API_REGION?.trim() || "hnd1";

await rm(output, { recursive: true, force: true });
await mkdir(functionDir, { recursive: true });

await build({
  entryPoints: [path.join(root, "server/src/vercel.ts")],
  outfile: path.join(functionDir, "index.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  legalComments: "none",
  logLevel: "warning",
  // Vercel calls the handler on module.exports, so expose the Express app itself rather than { default }.
  footer: { js: "module.exports = module.exports.default ?? module.exports;" },
});

await writeFile(
  path.join(functionDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 30,
      regions: [region],
    },
    null,
    2,
  ),
);

await writeFile(
  path.join(output, "config.json"),
  JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/api" }] }, null, 2),
);

console.log(`Built .vercel/output (function region ${region}).`);
