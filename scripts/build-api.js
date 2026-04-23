/**
 * Backend build script with tsconfig path alias resolution.
 * Uses esbuild with a custom plugin to resolve @db/* imports.
 */
import * as esbuild from "esbuild";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

/** Resolve @db/* to ./db/*.ts files */
const aliasPlugin = {
  name: "alias-plugin",
  setup(build) {
    build.onResolve({ filter: /^@db\// }, (args) => {
      const relativePath = args.path.replace("@db/", "db/");
      // Try .ts extension first
      const tsPath = path.resolve(rootDir, relativePath + ".ts");
      return { path: tsPath };
    });
  },
};

async function build() {
  await esbuild.build({
    entryPoints: [path.resolve(rootDir, "api/boot.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: path.resolve(rootDir, "dist/api.js"),
    external: [
      "hono",
      "hono/*",
      "@hono/node-server",
      "drizzle-orm",
      "drizzle-orm/*",
      "mysql2",
      "bcryptjs",
      "jose",
      "dotenv",
      "zod",
      "superjson",
      "@trpc/server",
      "@trpc/server/*",
    ],
    plugins: [aliasPlugin],
    sourcemap: true,
    target: "node20",
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
    },
  });
  console.log("[build:api] Backend built successfully -> dist/api.js");
}

build().catch((err) => {
  console.error("[build:api] Build failed:", err);
  process.exit(1);
});
