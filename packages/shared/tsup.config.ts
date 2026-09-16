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
  splitting: false,
  treeshake: true,
  target: "es2022",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" }
  },
})
