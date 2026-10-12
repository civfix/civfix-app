import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { CheckinResultDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { ScanResultCard } from "./checkin-sections"

afterEach(() => {
  cleanup()
})

function scan(outcome: CheckinResultDTO["outcome"], firstTime: boolean): CheckinResultDTO {
  return { outcome, firstTime } as CheckinResultDTO
}

describe("ScanResultCard", () => {
  it("shows a repeat scan the server reports as checked in as checked in, in moss", () => {
    render(<ScanResultCard result={scan("checked_in", false)} onDismiss={() => {}} />)
    const card = screen.getByRole("status")
    expect(card.textContent).toContain("result.checked_in_title")
    expect(card.className).toContain("bg-console-moss-soft")
  })

  it.each([
    ["checked_in", "bg-console-moss-soft"],
    ["already", "bg-console-sky-soft"],
    ["waitlisted", "bg-console-sun-soft"],
    ["cancelled", "bg-console-bloom-soft"],
    ["no_show", "bg-console-bloom-soft"],
    ["wrong_event", "bg-console-bloom-soft"],
    ["unknown_token", "bg-console-bloom-soft"],
  ] as const)("tints %s with %s", (outcome, tint) => {
    render(<ScanResultCard result={scan(outcome, true)} onDismiss={() => {}} />)
    expect(screen.getByRole("status").className).toContain(tint)
  })

  it("titles an unrecognised ticket with the unknown copy", () => {
    render(<ScanResultCard result={scan("unknown_token", true)} onDismiss={() => {}} />)
    expect(screen.getByRole("status").textContent).toContain("result.unknown_title")
  })
})
