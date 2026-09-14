import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { makeOverlayActionGate, overlayActionsDeferUntilClosed } from "../overlayActionGate"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const GATE_HOOK = code(read("../useDeferredOverlayAction.ts"))
const MODAL_CLOSED = code(read("../useModalClosed.ts"))
const POPOVER = code(read("../PopoverMenu.tsx"))
const CARD_SHEET = code(read("../ModalCardSheet.tsx"))
const REPORT_SHEET = code(read("../ReportContentSheet.tsx"))
const SLIDE_UP = code(read("../SlideUpSheet.tsx"))
const OVERFLOW = code(read("../../bodies/PostOverflowMenu.tsx"))
const REPORT_DETAIL = code(read("../../bodies/ReportDetailBody.tsx"))
const SHARE_PROVIDER = code(read("../../share/SharePostProvider.tsx"))

describe("the overlay action gate", () => {
  it("defers only on iOS, where UIKit drops a presentation requested during another modal's teardown", () => {
    expect(overlayActionsDeferUntilClosed("ios")).toBe(true)
    expect(overlayActionsDeferUntilClosed("android")).toBe(false)
    expect(overlayActionsDeferUntilClosed("web")).toBe(false)
  })

  it("runs the chosen action immediately when not deferring", () => {
    const gate = makeOverlayActionGate(false)
    const calls: string[] = []
    gate.choose(() => calls.push("a"))
    expect(calls).toEqual(["a"])
    expect(gate.hasPending()).toBe(false)
    gate.settle()
    expect(calls).toEqual(["a"])
  })

  it("holds the action until the overlay reports it has fully closed, then runs it exactly once", () => {
    const gate = makeOverlayActionGate(true)
    const calls: string[] = []
    gate.choose(() => calls.push("report"))
    expect(calls).toEqual([])
    expect(gate.hasPending()).toBe(true)
    gate.settle()
    gate.settle()
    expect(calls).toEqual(["report"])
    expect(gate.hasPending()).toBe(false)
  })

  it("keeps only the latest choice and drops a stale one when the overlay reopens first", () => {
    const gate = makeOverlayActionGate(true)
    const calls: string[] = []
    gate.choose(() => calls.push("first"))
    gate.choose(() => calls.push("second"))
    gate.settle()
    expect(calls).toEqual(["second"])
    gate.choose(() => calls.push("stale"))
    gate.reopened()
    gate.settle()
    expect(calls).toEqual(["second"])
  })
})

describe("every house overlay reports the moment it has fully left the screen", () => {
  it("useModalClosed rides Modal.onDismiss where the platform emits it and an effect on Android", () => {
    expect(MODAL_CLOSED).toContain('export const MODAL_EMITS_DISMISS = Platform.OS !== "android"')
    expect(MODAL_CLOSED).toMatch(/if \(left && !MODAL_EMITS_DISMISS\) onClosedRef\.current\?\.\(\)/)
    expect(MODAL_CLOSED).toMatch(/return MODAL_EMITS_DISMISS \? onDismiss : undefined/)
  })

  it("the deferred-action hook closes first, parks the action, and releases it on settle", () => {
    expect(GATE_HOOK).toMatch(/onClose\(\)\s*gate\.choose\(action\)/)
    expect(GATE_HOOK).toMatch(/gate\.settle\(\)\s*onClosedRef\.current\?\.\(\)/)
    expect(GATE_HOOK).toMatch(/if \(visible\) gate\.reopened\(\)/)
  })

  it("PopoverMenu runs every row action through the gate and settles off its own Modal", () => {
    expect(POPOVER).toContain("const { run, settled } = useDeferredOverlayAction(visible, onClose, onClosed)")
    expect(POPOVER).toContain("const onModalDismiss = useModalClosed(rendered, settled)")
    expect(POPOVER).toMatch(/const handlePress = useCallback\(\(item: PopoverMenuItem\) => run\(item\.onPress\), \[run\]\)/)
    expect(POPOVER).toContain("onDismiss={onModalDismiss}")
    expect(POPOVER).not.toMatch(/onClose\(\)\s*item\.onPress\(\)/)
  })

  it("ModalCardSheet and SlideUpSheet expose onClosed through the same hook", () => {
    expect(CARD_SHEET).toContain("const onDismiss = useModalClosed(visible, onClosed)")
    expect(CARD_SHEET).toContain("onDismiss={onDismiss}")
    expect(SLIDE_UP).toContain("const onModalDismiss = useModalClosed(rendered, onClosed)")
    expect(SLIDE_UP).toContain("onDismiss={onModalDismiss}")
    expect(REPORT_SHEET).toContain("onClosed={onClosed}")
  })
})

describe("the post overflow menu stays mounted until the surface it opened has actually gone", () => {
  it("retains on activity and releases on a surface's onClosed, never on a timer", () => {
    expect(OVERFLOW).toMatch(/if \(active\) setRetained\(true\)/)
    expect(OVERFLOW).toMatch(/const onSurfaceClosed = useCallback\(\(\) => \{\s*if \(!activeRef\.current\) setRetained\(false\)/)
    expect(OVERFLOW).not.toContain("setTimeout")
    expect(OVERFLOW).not.toContain("RELEASE_AFTER_CLOSE_MS")
  })

  it("wires that release into both menus and the report sheet", () => {
    expect(OVERFLOW.match(/onClosed=\{onSurfaceClosed\}/g)).toHaveLength(3)
    expect(OVERFLOW).toMatch(/<ReportContentSheet[\s\S]*?onClosed=\{onSurfaceClosed\}/)
  })

  it("opens the report sheet from the row action, which the menu now defers until it has closed", () => {
    expect(OVERFLOW).toMatch(/const startReport = useCallback\(\s*\(\) => requireAuth\(\(\) => onReportOpenChange\(true\)/)
    expect(OVERFLOW).toMatch(/key: "report",[\s\S]*?onPress: startReport/)
  })
})

describe("callers no longer hand-roll the after-dismiss dance", () => {
  it("report detail shares straight from the row action", () => {
    expect(REPORT_DETAIL).not.toContain("pendingMenuActionRef")
    expect(REPORT_DETAIL).not.toContain("onTitleMenuDismiss")
    expect(REPORT_DETAIL).toMatch(/const onShare = useCallback\(\(\) => \{\s*void shareLink\(\{/)
  })

  it("the share provider releases its target when the sheet reports it closed, not after 400ms", () => {
    expect(SHARE_PROVIDER).not.toContain("setTimeout")
    expect(SHARE_PROVIDER).toMatch(/const release = useCallback\(\(\) => \{\s*if \(!visibleRef\.current\) setTarget\(null\)/)
    expect(SHARE_PROVIDER).toContain("onClose={close} onClosed={release}")
  })
})
