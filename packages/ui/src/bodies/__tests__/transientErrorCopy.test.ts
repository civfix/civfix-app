import { describe, expect, it } from "vitest"
import { transientErrorCopyKey } from "../conversation/conversationModel"
import en from "../../i18n/locales/en/conversation.json"
import es from "../../i18n/locales/es/conversation.json"
import de from "../../i18n/locales/de/conversation.json"
import ko from "../../i18n/locales/ko/conversation.json"

const CATALOGS: Record<string, Record<string, unknown>> = { en, es, de, ko }

describe("transientErrorCopyKey", () => {
  it("maps every gateway policy rejection to code-aware copy, never connection-blaming text", () => {
    expect(transientErrorCopyKey("RATE_LIMITED")).toBe("room_error.rate_limited")
    expect(transientErrorCopyKey("BLOCKED")).toBe("room_error.blocked")
    expect(transientErrorCopyKey("channel_read_only")).toBe("room_error.read_only")
    expect(transientErrorCopyKey("reply_wrong_room")).toBe("room_error.reply_unavailable")
    expect(transientErrorCopyKey("reply_deleted_target")).toBe("room_error.reply_unavailable")
    expect(transientErrorCopyKey("BAD_FRAME")).toBe("room_error.send_rejected")
    expect(transientErrorCopyKey("VALIDATION")).toBe("room_error.send_rejected")
  })

  it("keeps the connection copy only for unknown codes", () => {
    expect(transientErrorCopyKey("SOME_FUTURE_CODE")).toBe("room_error.transient")
  })

  it("every key the mapping can return exists in all four shipped locales", () => {
    const keys = [
      "rate_limited",
      "blocked",
      "read_only",
      "reply_unavailable",
      "send_rejected",
      "transient",
    ]
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const section = catalog["room_error"] as Record<string, unknown> | undefined
      for (const key of keys) {
        const value = section?.[key]
        expect(typeof value, `${locale} room_error.${key}`).toBe("string")
        expect(value, `${locale} room_error.${key}`).not.toBe("")
      }
    }
  })
})
