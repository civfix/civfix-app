// Same shape and case-insensitivity as zod's `.uuid()` behind IdSchema and the backend's cursor check,
// so a value this accepts is one IdSchema accepts.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}
