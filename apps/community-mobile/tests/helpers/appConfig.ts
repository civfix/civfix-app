import assert from "node:assert/strict"
import { createRequire } from "node:module"

/**
 * The slice of app.config.js's output these tests read. Fields are required so a missing block still fails
 * the test the way the untyped read did; the `dark` keys exist only to be asserted absent.
 */
export interface AppConfig {
  userInterfaceStyle: string
  splash: { backgroundColor: string; image: string; dark?: unknown }
  android: {
    versionCode: number
    googleServicesFile?: string
    splash?: unknown
    adaptiveIcon: { backgroundColor: string; dark?: unknown }
  }
  plugins: unknown[]
  extra: { eas: { projectId: string } }
  owner: string
}

export type AppConfigFactory = (context: { config: Record<string, unknown> }) => AppConfig

const require = createRequire(import.meta.url)

export const appConfigFactory = require("../../app.config.js") as AppConfigFactory

const APP_CONFIG_PATH = require.resolve("../../app.config.js")

/** app.config.js reads CIVFIX_APP_VARIANT once, at load, so each variant needs a fresh module. */
export function appConfigForVariant(variant: string | undefined): AppConfig {
  const previous = process.env.CIVFIX_APP_VARIANT
  if (variant === undefined) delete process.env.CIVFIX_APP_VARIANT
  else process.env.CIVFIX_APP_VARIANT = variant
  try {
    Reflect.deleteProperty(require.cache, APP_CONFIG_PATH)
    return (require(APP_CONFIG_PATH) as AppConfigFactory)({ config: {} })
  } finally {
    if (previous === undefined) delete process.env.CIVFIX_APP_VARIANT
    else process.env.CIVFIX_APP_VARIANT = previous
    Reflect.deleteProperty(require.cache, APP_CONFIG_PATH)
  }
}

export function pluginOptions(
  config: AppConfig,
  plugin: string,
  missingMessage: string,
): Record<string, unknown> {
  const entry: unknown = config.plugins.find(
    (candidate) => Array.isArray(candidate) && candidate[0] === plugin,
  )
  assert.ok(Array.isArray(entry), missingMessage)
  return (entry as unknown[])[1] as Record<string, unknown>
}
