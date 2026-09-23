const PROD_API_HOST = "api.civfix.org"

const LEGACY_NAMESPACE = ""

const UNRESOLVED_HOST = "unknown"

function hostSlug(apiUrl: string): string {
  const value = apiUrl.trim()
  let host = value
  try {
    host = new URL(value).host
  } catch {
    host = value
  }
  const slug = host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug === "" ? UNRESOLVED_HOST : slug
}

export function storageNamespace(apiUrl: string): string {
  const slug = hostSlug(apiUrl)
  return slug === hostSlug(PROD_API_HOST) ? LEGACY_NAMESPACE : slug
}

export function scopeStorageId(id: string, apiUrl: string): string {
  const namespace = storageNamespace(apiUrl)
  return namespace === LEGACY_NAMESPACE ? id : `${id}.${namespace}`
}
