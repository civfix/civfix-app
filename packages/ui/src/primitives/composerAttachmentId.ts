/**
 * Process-unique ids for picked composer attachments.
 *
 * The local `uri` CANNOT be the identity: picking the same library asset twice yields the SAME uri on both
 * platforms (and web object URLs can repeat after a revoke + re-pick), which produced duplicate React keys
 * in the thumbnail strip, applied one upload's `uploadId` to both rows, and made a remove (or an upload
 * failure) drop both copies at once. A monotonic counter - the same trick Toast uses for its ids - gives
 * every pick its own key regardless of where the bytes came from.
 */
let counter = 0

/** The next attachment id. Unique for the life of the process. */
export function nextAttachmentId(): string {
  counter += 1
  return `att-${counter}`
}

/** The `common:attach_error.*` key a composer attachment failure resolves to. */
export type AttachErrorKey = "busy" | "limit" | "library" | "camera" | "rejected" | "rate_limited" | "upload"

/**
 * The key for a failed upload, read off the AppError code. The error's own `message` is never shown:
 * it is English server or client text, not catalog copy.
 */
export function uploadAttachErrorKey(code: string | undefined): AttachErrorKey {
  if (code === "MEDIA_REJECTED") return "rejected"
  if (code === "RATE_LIMITED") return "rate_limited"
  return "upload"
}
