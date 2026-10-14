import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/tokens/design-tokens.ts",
    "src/interfaces/index.ts",
    "src/fakes/index.ts",
    "src/client/index.ts",
    "src/avatar.ts",
    "src/datetime.ts",
    "src/geocode.ts",
    "src/chat/index.ts",
    "src/ws/index.ts",
    "src/host/index.ts",
    "src/markdown/index.ts",
    "src/ics/index.ts",
    "src/legal/index.ts",
    "src/tokens/chip-contrast.ts",
  ],
  outDir: "dist",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Entries share one copy of each module: unsplit, every subpath re-bundled its imports (the client
  // entry alone carried the schemas and its own AppError), so Metro shipped both copies and `instanceof`
  // failed across subpaths. CJS splitting is experimental in tsup: re-check `require` of every exports
  // entry after a tsup upgrade.
  splitting: true,
  treeshake: true,
  target: "es2022",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" }
  },
})
