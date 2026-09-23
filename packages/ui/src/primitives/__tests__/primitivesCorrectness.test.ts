/**
 * Regression coverage for the primitive correctness fixes of PR 4. Pure models are exercised directly;
 * components that cannot render under plain Node are pinned by narrow source assertions on the exact
 * line that carried the bug.
 */
import { readFileSync } from "node:fs"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sliceBetween } from "../../__tests__/sourceGuards"
import { REPORT_CATEGORY_LABELS, type EventQuestionDTO, type TicketTypeDTO } from "@civfix/shared"
import { uploadAttachErrorKey } from "../composerAttachmentId"
import { postDetailPath } from "../postActionModel"
import { emptyPollDraft, removeOption, setOption } from "../pollDraft"
import { answersWithDefaults, effectiveTicketTypeId } from "../guestRsvpModel"
import { qrTicketPath } from "../qrMatrix"
import { nativeShareResult } from "../shareResult"
import { CALENDAR_BLOB_REVOKE_MS, saveCalendarFile } from "../calendarFile.web"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const code = (rel: string): string =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")

const EN_ENUMS = JSON.parse(read("../../i18n/locales/en/enums.json")) as { category: Record<string, string> }

describe("APP-BUG-037 CategoryChip localizes its label", () => {
  const chip = code("../CategoryChip.tsx")

  it("renders the enums catalog, not the English-only contract map", () => {
    expect(chip).not.toContain("REPORT_CATEGORY_LABELS")
    expect(chip).toContain('useT("enums")')
    expect(chip).toContain("tEnums(`category.${category}`)")
  })

  it("has an en catalog entry for every category the contract defines", () => {
    for (const category of Object.keys(REPORT_CATEGORY_LABELS)) {
      expect(EN_ENUMS.category[category], category).toBeTruthy()
    }
  })

  it("keeps the decorative swatch out of the accessibility tree", () => {
    const swatch = sliceBetween(chip, "<View\n        aria-hidden", "styles.swatch")
    expect(swatch).toContain("accessibilityElementsHidden")
    expect(swatch).toContain('importantForAccessibility="no-hide-descendants"')
  })
})

describe("APP-BUG-038 composer attachment errors are catalog keys", () => {
  const hook = code("../useComposerAttachments.ts")

  it("maps the AppError code, never the error's own message", () => {
    expect(uploadAttachErrorKey("MEDIA_REJECTED")).toBe("rejected")
    expect(uploadAttachErrorKey("RATE_LIMITED")).toBe("rate_limited")
    expect(uploadAttachErrorKey("INTERNAL")).toBe("upload")
    expect(uploadAttachErrorKey(undefined)).toBe("upload")
    expect(hook).not.toContain("err.message")
    expect(hook).toContain("uploadAttachErrorKey(appErrorCode(err))")
  })

  it("holds no hard-coded English copy", () => {
    expect(hook).not.toMatch(/setAttachError\("/)
    expect(hook).not.toMatch(/setAttachError\(`/)
    expect(hook).not.toContain("Could not open")
    expect(hook).toContain("t(`attach_error.${attachError.key}`, attachError.params)")
  })

  it("keeps the guard shapes the conversation wiring test pins", () => {
    expect(hook).toMatch(/if \(uploading\) \{\s*setAttachError\(/)
    expect(hook).toMatch(/if \(attachments\.length >= maxAttachments\) \{\s*setAttachError\(/)
  })
})

describe("APP-BUG-039 a signed-out Like/Repost/Save returns to the post", () => {
  const bar = code("../PostActionBar.tsx")

  it("defaults the sign-in return path to the post detail route, not the map home", () => {
    expect(postDetailPath("p1")).toBe("/post/p1")
    expect(bar).not.toContain('{ next: "/" }')
    expect(bar).toContain("const authNext = nextPath ?? postDetailPath(postId)")
    expect(bar.match(/\{ next: authNext \}/g)).toHaveLength(3)
  })

  it("keeps the repost inner shape the PostActionBar test pins", () => {
    expect(bar).toMatch(/if \(!onQuote\) \{\s*repostMutate\(currently\)/)
  })
})

describe("APP-BUG-040 poll option rows keep their identity across a remove", () => {
  it("gives every row a distinct id", () => {
    const draft = setOption(emptyPollDraft(), 1, "B")
    const ids = draft.options.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("moves the surviving rows' ids up with them instead of re-deriving them from position", () => {
    let draft = setOption(emptyPollDraft(), 0, "A")
    draft = setOption(draft, 1, "B")
    const [, second, third] = draft.options
    const removed = removeOption(draft, 0)
    expect(removed.options.map((o) => o.id)).toEqual([second!.id, third!.id])
    expect(removed.options.map((o) => o.text)).toEqual(["B", ""])
  })

  it("keys and focuses the rendered row by that id", () => {
    const sheet = code("../PollCreateSheet.tsx")
    expect(sheet).toContain("<View key={opt.id} style={styles.optionRow}>")
    expect(sheet).toContain("onFocus={() => setFocusedField(opt.id)}")
    expect(sheet).not.toContain("key={idx}")
  })
})

describe("APP-BUG-041/042/043 conditional rows keep their own keys", () => {
  it("React.Children.toArray keys survive a sibling above them disappearing", () => {
    const keysOf = (children: React.ReactNode) =>
      React.Children.toArray(children)
        .filter(Boolean)
        .map((child) => (React.isValidElement(child) ? child.key : null))
    const b = React.createElement("b")
    const c = React.createElement("i")
    const before = keysOf([React.createElement("a"), b, c])
    const after = keysOf([false, b, c])
    expect(after).toEqual(before.slice(1))
  })

  it.each([
    ["../SectionCard.tsx", "<React.Fragment key={React.isValidElement(row) && row.key != null ? row.key : index}>"],
    ["../SettingsRow.tsx", "<React.Fragment key={React.isValidElement(row) && row.key != null ? row.key : index}>"],
    ["../StatTile.tsx", "key={React.isValidElement(cell) && cell.key != null ? cell.key : index}"],
  ])("%s keys by the child's own key", (file, line) => {
    const source = code(file)
    expect(source).toContain(line)
    expect(source).not.toMatch(/<React\.Fragment key=\{index\}>/)
    expect(source).not.toMatch(/<View key=\{index\}/)
  })
})

const ticket = (id: string, sortOrder: number, open = true): TicketTypeDTO =>
  ({ id, sortOrder, salesOpen: open, soldOut: false, maxPartySize: 1 }) as unknown as TicketTypeDTO

describe("APP-BUG-044 a guest registration always carries a ticket type", () => {
  it("falls back to the default when the picked type is no longer offered", () => {
    const types = [ticket("a", 0), ticket("b", 1)]
    expect(effectiveTicketTypeId(types, "b")).toBe("b")
    expect(effectiveTicketTypeId(types, "gone")).toBe("a")
  })

  it("picks the default for types that arrived after the sheet opened", () => {
    expect(effectiveTicketTypeId([], null)).toBeNull()
    expect(effectiveTicketTypeId([ticket("late", 0)], null)).toBe("late")
  })

  it("derives the sheet's ticket type rather than trusting the state seeded on open", () => {
    const sheet = code("../GuestRsvpSheet.tsx")
    expect(sheet).toContain("const ticketTypeId = effectiveTicketTypeId(types, chosenTicketTypeId)")
    expect(sheet).not.toContain("setTicketTypeId(defaultTicketTypeId(types))")
  })
})

describe("APP-BUG-045 guest answers derive their defaults", () => {
  const question = (id: string, kind: string): EventQuestionDTO => ({ id, kind }) as unknown as EventQuestionDTO

  it("fills every question's default under what the viewer typed", () => {
    const questions = [question("opt", "checkbox"), question("name", "text")]
    expect(answersWithDefaults(questions, {})).toEqual({ opt: false, name: "" })
    expect(answersWithDefaults(questions, { name: "Ana" })).toEqual({ opt: false, name: "Ana" })
  })

  it("no longer mirrors the questions prop into state from an effect", () => {
    const sheet = code("../GuestRsvpSheet.tsx")
    expect(sheet).not.toContain("seedAnswers")
    expect(sheet).toContain("answersWithDefaults(questions, typedAnswers)")
  })
})

describe("APP-BUG-046 sheets reset while rendering the open, not one commit later", () => {
  it.each(["../CancelEventSheet.tsx", "../ReportContentSheet.tsx", "../RequestResourcesSheet.tsx", "../PollCreateSheet.tsx"])(
    "%s resets through useResetOnOpen",
    (file) => {
      const sheet = code(file)
      expect(sheet).toContain("useResetOnOpen(visible, ")
      expect(sheet).not.toMatch(/useEffect\(\(\) => \{\s*if \(visible\)/)
    },
  )

  it("resets inside render on the false to true edge", () => {
    const hook = code("../useModalClosed.ts")
    expect(hook).toMatch(
      /if \(visible !== wasVisible\) \{\s*setWasVisible\(visible\)\s*if \(visible\) reset\(\)\s*\}/,
    )
  })
})

describe("APP-BUG-047 / APP-A11Y-023 poll result bars", () => {
  const bubble = code("../PollBubble.tsx")

  it("stops the bar animation when the fractions change or the bubble unmounts", () => {
    expect(bubble).toContain("return () => run.stop()")
  })

  it("jumps straight to the result under reduced motion", () => {
    expect(bubble).toContain("const barsStill = reducedMotion !== false")
    expect(bubble).toContain("barsRef.current.forEach((v, i) => v.setValue(fractions[i] ?? 0))")
  })
})

describe("APP-BUG-048 an unencodable ticket shows a visible fallback", () => {
  it("returns null for a value over QR capacity instead of throwing", () => {
    expect(qrTicketPath("x".repeat(5000))).toBeNull()
    expect(qrTicketPath("")).toBeNull()
  })

  it("draws a real code for a ticket token", () => {
    expect(qrTicketPath("tkt_0123456789abcdef")?.path.length ?? 0).toBeGreaterThan(0)
  })

  it("renders the fallback copy in place of a blank plate", () => {
    const qr = code("../QrTicket.tsx")
    expect(qr).toContain('t("qr_ticket.unavailable")')
    expect(qr).not.toContain("<View style={styles.fallback} />")
  })
})

describe("APP-BUG-049 social links open through the capability and say when they fail", () => {
  const row = code("../SocialLinksRow.tsx")

  it("never swallows the failure or bypasses the OpenExternal seam", () => {
    expect(row).not.toContain("Linking")
    expect(row).not.toContain(".catch(() => {})")
    expect(row).toContain('toast.show(t("social.link_failed"), { variant: "error" })')
    expect(row).toContain("void openExternal.open(url).catch(failed)")
  })
})

describe("APP-BUG-050 web calendar download is not cancelled by an early revoke", () => {
  const revoke = vi.fn()
  const click = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    const anchor = { click, href: "", download: "", rel: "" }
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })
    vi.stubGlobal("URL", { createObjectURL: () => "blob:ics", revokeObjectURL: revoke })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    revoke.mockReset()
  })

  it("keeps the blob URL alive past the click, then releases it", async () => {
    await expect(saveCalendarFile({ filename: "e.ics", ics: "BEGIN:VCALENDAR" })).resolves.toBe("downloaded")
    expect(click).toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(CALENDAR_BLOB_REVOKE_MS)
    expect(revoke).toHaveBeenCalledWith("blob:ics")
  })
})

describe("APP-BUG-052 an iOS share sheet the user closed is a cancel", () => {
  it("maps dismissedAction to cancelled and anything else to shared", () => {
    expect(nativeShareResult("dismissedAction", "dismissedAction")).toBe("cancelled")
    expect(nativeShareResult("sharedAction", "dismissedAction")).toBe("shared")
  })

  it("reads the resolved action instead of assuming a share", () => {
    const share = code("../share.ts")
    expect(share).toContain("return nativeShareResult(shared.action, Share.dismissedAction)")
  })
})
