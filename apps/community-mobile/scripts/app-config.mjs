import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// app.config.js resolved the way the build scripts need it: from its own defaults, with no app.json.
export async function loadAppConfig() {
  const { default: appConfigFor } = await import("../app.config.js")
  return appConfigFor({
    projectRoot: join(dirname(fileURLToPath(import.meta.url)), ".."),
    staticConfigPath: null,
    packageJsonPath: null,
    config: {},
  })
}
