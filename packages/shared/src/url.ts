const TRAILING_SLASHES = /\/+$/

export function stripTrailingSlashes(value: string): string {
  return value.replace(TRAILING_SLASHES, "")
}
