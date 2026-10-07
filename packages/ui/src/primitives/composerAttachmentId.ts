import { ErrorCode, byErrorCode, type ErrorCodeTable } from "@civfix/shared"

// The uri is not an identity: the same asset picked twice has the same uri.
let counter = 0

export function nextAttachmentId(): string {
  counter += 1
  return `att-${counter}`
}

export type AttachErrorKey = "busy" | "limit" | "library" | "camera" | "rejected" | "rate_limited" | "upload"

// The error's own `message` is never shown: it is English server or client text, not catalog copy.
const UPLOAD_ATTACH_ERROR_KEYS: ErrorCodeTable<AttachErrorKey> = {
  [ErrorCode.MEDIA_REJECTED]: "rejected",
  [ErrorCode.RATE_LIMITED]: "rate_limited",
}

export function uploadAttachErrorKey(code: string | undefined): AttachErrorKey {
  return byErrorCode(code, UPLOAD_ATTACH_ERROR_KEYS, "upload")
}
