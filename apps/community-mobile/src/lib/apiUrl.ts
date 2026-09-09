/**
 * API base-URL resolution, kept in its own DEPENDENCY-FREE module so it is unit-testable: src/config.ts
 * imports expo-constants at module load, which a plain `node --test` run cannot resolve.
 *
 * WHY THIS IS A TYPE GUARD AND NOT A NULL CHECK. `app.config.js` once set
 * `apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null`. Expo did NOT bake that null through as null - it
 * landed in EXConstants.bundle/app.config as `{}`. The resolution was
 * `extra.apiUrl ?? (__DEV__ ? DEV : PROD)`, and `{} ?? fallback` does not fall through, because `??`
 * only triggers on null/undefined. So the base URL resolved to an OBJECT and every request went to
 * "[object Object]/v1/..." - the build could not reach the backend at all, while web (its own config)
 * was fine.
 *
 * So: accept ONLY a non-empty string; anything else falls back to the environment default.
 * app.config.js also omits the key entirely when unset rather than emitting a null, so both layers
 * would have to regress for this to return.
 */

export const DEV_API_URL = "http://localhost:8080"
export const PROD_API_URL = "https://api.civfix.org"

export function resolveApiUrl(configured: unknown, isDev: boolean): string {
  if (typeof configured === "string" && configured.trim() !== "") return configured.trim()
  return isDev ? DEV_API_URL : PROD_API_URL
}
