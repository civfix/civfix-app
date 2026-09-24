// The uri is not an identity: the same asset picked twice has the same uri.
let counter = 0

export function nextAttachmentId(): string {
  counter += 1
  return `att-${counter}`
}

export type AttachErrorKey = "busy" | "limit" | "library" | "camera" | "rejected" | "rate_limited" | "upload"

// The error's own `message` is never shown: it is English server or client text, not catalog copy.
export function uploadAttachErrorKey(code: string | undefined): AttachErrorKey {
  if (code === "MEDIA_REJECTED") return "rejected"
  if (code === "RATE_LIMITED") return "rate_limited"
  return "upload"
}
