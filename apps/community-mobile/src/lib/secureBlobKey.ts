export const SECURE_BLOB_KEY_CHARS = 16

const KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

const KEY_SHAPE = /^[A-Za-z0-9\-_]{16}$/

export function normalizeSecureBlobKey(raw: string | null | undefined): string | null {
  return typeof raw === "string" && KEY_SHAPE.test(raw) ? raw : null
}

export function mintSecureBlobKey(randomBytes: (count: number) => Uint8Array): string | null {
  const bytes = randomBytes(SECURE_BLOB_KEY_CHARS)
  if (!bytes || bytes.length < SECURE_BLOB_KEY_CHARS) return null
  let key = ""
  for (let i = 0; i < SECURE_BLOB_KEY_CHARS; i += 1) {
    key += KEY_ALPHABET[bytes[i]! & 63]
  }
  return normalizeSecureBlobKey(key)
}
