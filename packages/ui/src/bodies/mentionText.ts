/** Handles travel with or without the leading `@` depending on the source DTO; normalize both. */
export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "")
}

/** A handle is user text, so it is escaped before it is spliced into a `new RegExp` pattern. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
