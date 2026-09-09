import { describe, it, expect } from "vitest"
import { GUEST_MANAGE_TOKEN_MAX_LENGTH, GUEST_MANAGE_TOKEN_MIN_LENGTH } from "@civfix/shared"

import { readGuestManageToken } from "@/features/guest/guest-cancel-token"

const VALID = "a".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH)

describe("readGuestManageToken", () => {
  it("accepts a token inside the contract bounds", () => {
    expect(readGuestManageToken(VALID)).toBe(VALID)
    expect(readGuestManageToken("b".repeat(GUEST_MANAGE_TOKEN_MAX_LENGTH))).toHaveLength(
      GUEST_MANAGE_TOKEN_MAX_LENGTH,
    )
  })

  it("trims the surrounding whitespace a mail client can wrap into the link", () => {
    expect(readGuestManageToken(` ${VALID}\n`)).toBe(VALID)
  })

  it("rejects a missing, short or over-long token instead of calling the API", () => {
    expect(readGuestManageToken(null)).toBeNull()
    expect(readGuestManageToken(undefined)).toBeNull()
    expect(readGuestManageToken("   ")).toBeNull()
    expect(readGuestManageToken("a".repeat(GUEST_MANAGE_TOKEN_MIN_LENGTH - 1))).toBeNull()
    expect(readGuestManageToken("a".repeat(GUEST_MANAGE_TOKEN_MAX_LENGTH + 1))).toBeNull()
  })
})
