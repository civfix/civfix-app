export const STORAGE_ENV_MARKER_KEY = "civfix.storage.env"

export const PROD_STORAGE_ENV = "prod"

export const LEGACY_STORAGE_IDS = [
  "civfix.session.token",
  "civfix.app",
  "civfix.secure",
  "civfix.secure-blobs.key",
] as const

export function storageEnvFor(namespace: string): string {
  return namespace === "" ? PROD_STORAGE_ENV : namespace
}

export function purgesLegacyStorage(namespace: string, marker: string | null): boolean {
  if (namespace !== "") return false
  if (marker === null || marker === "") return false
  return marker !== PROD_STORAGE_ENV
}
