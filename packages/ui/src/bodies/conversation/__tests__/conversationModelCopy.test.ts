import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"
import { colorSchemes } from "@civfix/shared/tokens"
import { contrastRatio } from "@civfix/shared/chip-contrast"
import { editErrorCopyKey, senderColor, senderNameColor } from "../conversationModel"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const AUTHORS = Array.from({ length: 60 }, (_, i) => `user-${i}-${(i * 7919).toString(36)}`)

describe("sender name colour", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`meets 4.5:1 on the ${scheme} paper and card for every palette hue`, () => {
      const { paper, card } = colorSchemes[scheme].neutral
      for (const id of AUTHORS) {
        const ink = senderNameColor(id, scheme)
        expect(contrastRatio(ink, paper), `${id} on paper`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(ink, card), `${id} on card`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it("keeps the sender's hue: the same author maps to the same chip ink family", () => {
    const light = colorSchemes.light
    for (const id of AUTHORS) {
      const hue = (["bloom", "moss", "sun", "sky", "lilac"] as const).find(
        (name) => light.brand[name] === senderColor(id),
      )
      expect(hue).toBeDefined()
      expect(senderNameColor(id, "light")).toBe(light.chipInk[hue!])
      expect(senderNameColor(id, "dark")).toBe(colorSchemes.dark.chipInk[hue!])
    }
  })

  it("colours name TEXT with the AA ink, never the raw brand hue", () => {
    const bubble = code(read("../MessageBubble.tsx"))
    expect(bubble).toContain("{ color: senderNameColor(from.id, th.scheme) }")
    expect(bubble).not.toContain("senderColor(from.id)")
    const body = code(read("../../ConversationBody.tsx"))
    expect(body).toContain('senderNameColor(chat.typingUserIds[0] ?? "", th.scheme)')
  })
})

describe("edit-save failure copy", () => {
  it("says the message is gone when the edit target no longer exists", () => {
    expect(editErrorCopyKey(new AppError(ErrorCode.NOT_FOUND, "That message is no longer available."))).toBe(
      "composer.edit_unavailable",
    )
  })

  it("falls back to the localized save error for every other failure", () => {
    expect(editErrorCopyKey(new AppError(ErrorCode.FORBIDDEN, "raw server text"))).toBe("composer.save_error")
    expect(editErrorCopyKey(new Error("Network request failed"))).toBe("composer.save_error")
    expect(editErrorCopyKey(undefined)).toBe("composer.save_error")
  })

  it("never toasts the error's own (English, possibly server) message", () => {
    const hook = code(read("../useComposerMode.ts"))
    expect(hook).not.toContain("err.message")
    expect(hook).toContain('toast.show(t(editErrorCopyKey(err)), { variant: "error" })')
  })
})
