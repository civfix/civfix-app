import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const read = (rel: string): string => code(readFileSync(new URL(rel, import.meta.url), "utf8"))

const block = read("../registration/RegistrationBlock.tsx")
const ticket = read("../MyTicketBody.tsx")

describe("cancelling a registration asks first", () => {
  it.each([
    ["RegistrationBlock", block, "onCancelSeat"],
    ["MyTicketBody", ticket, "onCancel"],
  ])("%s opens the confirm sheet instead of cancelling on the first tap", (_name, src, handler) => {
    expect(src).not.toContain(`onPress={${handler}}`)
    expect(src).toContain("onPress={() => setConfirmingCancel(true)}")
    expect(src).toContain("<CancelRegistrationSheet")
    expect(src).toContain(`onConfirm={${handler}}`)
    expect(src).toContain("pending={cancel.isPending}")
    expect(src).toContain("waitlisted={waitlisted}")
  })

  it.each([
    ["RegistrationBlock", block],
    ["MyTicketBody", ticket],
  ])("%s closes the sheet whether the cancel lands or fails", (_name, src) => {
    expect(src.match(/setConfirmingCancel\(false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})

describe("CancelRegistrationSheet", () => {
  const sheet = block.slice(block.indexOf("export function CancelRegistrationSheet"))

  it("cannot be dismissed or confirmed twice while the cancel is in flight", () => {
    expect(sheet).toContain("if (!pending) onClose()")
    expect(sheet).toContain("if (!pending) onConfirm()")
    expect(sheet).toContain("backdropDismissDisabled={pending}")
    expect(sheet).toContain("loading={pending}")
  })

  it("keeps the destructive action distinct from the way out", () => {
    expect(sheet).toContain('label={t("mine.cancel_keep")}')
    expect(sheet).toContain('variant="destructive"')
  })

  it("words the waitlist case as leaving the line, not giving up a seat", () => {
    expect(sheet).toContain('waitlisted ? t("mine.cancel_waitlist_title") : t("mine.cancel_title")')
    expect(sheet).toContain('waitlisted ? t("mine.cancel_waitlist_body") : t("mine.cancel_body")')
  })
})
