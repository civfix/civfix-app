import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import {
  SECURE_BLOB_KEY_CHARS,
  mintSecureBlobKey,
  normalizeSecureBlobKey,
} from "./secureBlobKey.ts"

test("the key protecting the seat-token outbox spends its whole 16-byte MMKV slot", () => {
  const key = mintSecureBlobKey((n) => new Uint8Array(randomBytes(n)))
  assert.equal(key?.length, SECURE_BLOB_KEY_CHARS)
  assert.match(key!, /^[A-Za-z0-9\-_]{16}$/)
  assert.equal(Buffer.byteLength(key!, "utf8"), 16)
})

test("every character is drawn from the random bytes, with no constant positions", () => {
  const seen = Array.from({ length: SECURE_BLOB_KEY_CHARS }, () => new Set<string>())
  for (let i = 0; i < 200; i += 1) {
    const key = mintSecureBlobKey((n) => new Uint8Array(randomBytes(n)))!
    for (let c = 0; c < SECURE_BLOB_KEY_CHARS; c += 1) seen[c]!.add(key[c]!)
  }
  for (const position of seen) assert.ok(position.size > 8)
})

test("a source that cannot produce enough randomness yields no key at all", () => {
  assert.equal(mintSecureBlobKey(() => new Uint8Array(4)), null)
  assert.equal(mintSecureBlobKey(() => new Uint8Array(0)), null)
})

test("a key already in the keychain is honoured verbatim, including the older hex shape", () => {
  assert.equal(normalizeSecureBlobKey("0123456789abcdef"), "0123456789abcdef")
  assert.equal(normalizeSecureBlobKey("aZ09-_aZ09-_aZ09"), "aZ09-_aZ09-_aZ09")
  assert.equal(normalizeSecureBlobKey("0123456789abcde"), null)
  assert.equal(normalizeSecureBlobKey("0123456789abcdef0"), null)
  assert.equal(normalizeSecureBlobKey("0123456789abcde!"), null)
  assert.equal(normalizeSecureBlobKey(null), null)
  assert.equal(normalizeSecureBlobKey(undefined), null)
})
