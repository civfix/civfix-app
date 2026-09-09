import { describe, expect, it } from "vitest"
import { resolveComposerSubmit, type ComposerSubmitMode } from "../composerSubmit"

const editMode = (originalBody: string, messageId = "m1"): ComposerSubmitMode => ({
  kind: "edit",
  messageId,
  originalBody,
})

describe("resolveComposerSubmit", () => {
  describe("no mode (plain composer)", () => {
    it("routes text to send (trimmed)", () => {
      expect(resolveComposerSubmit(null, "  hello  ")).toEqual({ action: "send", body: "hello" })
    })

    it("empty draft with no media is a noop (button disabled)", () => {
      expect(resolveComposerSubmit(null, "")).toEqual({ action: "noop" })
      expect(resolveComposerSubmit(null, "   ")).toEqual({ action: "noop" })
    })

    it("empty draft WITH ready media sends (attachment-only message)", () => {
      expect(resolveComposerSubmit(null, "", true)).toEqual({ action: "send", body: "" })
    })
  })

  describe("edit mode", () => {
    it("changed non-empty text routes to edit with the target message id", () => {
      expect(resolveComposerSubmit(editMode("old text"), "new text")).toEqual({
        action: "edit",
        messageId: "m1",
        body: "new text",
      })
    })

    it("unchanged text is a noop (matches the old modal's save gate)", () => {
      expect(resolveComposerSubmit(editMode("same"), "same")).toEqual({ action: "noop" })
    })

    it("whitespace-only differences still count as unchanged", () => {
      expect(resolveComposerSubmit(editMode(" same "), "same  ")).toEqual({ action: "noop" })
    })

    it("empty text is a noop (cannot edit a message to nothing)", () => {
      expect(resolveComposerSubmit(editMode("old"), "")).toEqual({ action: "noop" })
      expect(resolveComposerSubmit(editMode("old"), "   ")).toEqual({ action: "noop" })
    })

    it("ignores ready media - edits are text-only", () => {
      // Unchanged + media must NOT unlock the button the way it would for a send.
      expect(resolveComposerSubmit(editMode("same"), "same", true)).toEqual({ action: "noop" })
      expect(resolveComposerSubmit(editMode("old"), "", true)).toEqual({ action: "noop" })
    })

    it("trims the edited body before comparing and submitting", () => {
      expect(resolveComposerSubmit(editMode("old"), "  new  ")).toEqual({
        action: "edit",
        messageId: "m1",
        body: "new",
      })
    })
  })

  describe("reply mode (P2 quoted replies)", () => {
    it("routes like a send - the caller attaches the reply reference", () => {
      expect(
        resolveComposerSubmit({ kind: "reply", messageId: "m2", originalBody: "quoted" }, "hi"),
      ).toEqual({ action: "send", body: "hi" })
    })

    it("empty reply draft is a noop", () => {
      expect(
        resolveComposerSubmit({ kind: "reply", messageId: "m2", originalBody: "quoted" }, "  "),
      ).toEqual({ action: "noop" })
    })

    it("empty reply draft WITH ready media sends (attachment-only reply)", () => {
      expect(
        resolveComposerSubmit({ kind: "reply", messageId: "m2", originalBody: "quoted" }, "", true),
      ).toEqual({ action: "send", body: "" })
    })
  })
})
