import { describe, expect, it } from "vitest"
import { constantTimeEqual, hmacSha256Hex, sha256Hex, toHex } from "../hmac.js"

describe("sha256", () => {
  it("matches the FIPS 180-4 vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    )
  })

  it("handles inputs that straddle the 55/56/64 byte padding boundaries", () => {
    expect(sha256Hex("a".repeat(55))).toBe(
      "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318",
    )
    expect(sha256Hex("a".repeat(56))).toBe(
      "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a",
    )
    expect(sha256Hex("a".repeat(64))).toBe(
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    )
  })

  it("hashes multi-byte UTF-8 the same way as its byte form", () => {
    expect(sha256Hex("héllo 🌍")).toBe(sha256Hex(new TextEncoder().encode("héllo 🌍")))
  })
})

describe("hmacSha256", () => {
  it("matches the RFC 4231 vectors", () => {
    expect(hmacSha256Hex(new Uint8Array(20).fill(0x0b), "Hi There")).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    )
    expect(hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    )
    expect(hmacSha256Hex(new Uint8Array(131).fill(0xaa), "Test Using Larger Than Block-Size Key - Hash Key First")).toBe(
      "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54",
    )
  })

  it("is deterministic and key-sensitive", () => {
    expect(hmacSha256Hex("k", "m")).toBe(hmacSha256Hex("k", "m"))
    expect(hmacSha256Hex("k", "m")).not.toBe(hmacSha256Hex("K", "m"))
  })
})

describe("toHex / constantTimeEqual", () => {
  it("pads every byte to two hex digits", () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff")
  })

  it("compares equal-length strings without an early exit and rejects length mismatch", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true)
    expect(constantTimeEqual("abc", "abd")).toBe(false)
    expect(constantTimeEqual("abc", "ab")).toBe(false)
    expect(constantTimeEqual("", "")).toBe(true)
  })
})
