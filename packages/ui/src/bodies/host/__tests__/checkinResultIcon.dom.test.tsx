import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type * as ReactNative from "react-native"
import { CheckinOutcomeSchema, type CheckinOutcome, type CheckinResultDTO } from "@civfix/contract"
import { I18nProvider } from "../../../i18n"
import { CheckinResultCard } from "../checkin/CheckinDeskCards"

// The icon set pulls in native-only modules; the stub names the glyph the card asked for.
vi.mock("../../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return {
    Text,
    Icon: ({ icon }: { icon: string }) => <span data-testid="result-icon" data-icon={icon} />,
    iconMap: new Proxy({}, { get: (_target, name) => name }),
  }
})

// The primitives barrel and the skeletons also reach native-only modules; the card only needs its buttons.
vi.mock("../../../primitives", () => ({
  SecondaryButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
  StatTile: () => null,
  StatTileRow: () => null,
}))
vi.mock("../HostSkeletons", () => ({ TilesSkeleton: () => null }))

const ICON: Record<CheckinOutcome, string> = {
  checked_in: "TicketCheck",
  already: "UserCheck",
  waitlisted: "Hourglass",
  cancelled: "Ban",
  no_show: "TriangleAlert",
  wrong_event: "TriangleAlert",
  unknown_token: "TriangleAlert",
}

function iconFor(outcome: CheckinOutcome, firstTime: boolean): string | null {
  const result = { outcome, firstTime, attendeeName: null, ticketTypeName: null, partySize: null }
  const { getByTestId, unmount } = render(
    <I18nProvider locale="en" setLocale={() => {}}>
      <CheckinResultCard
        state={{ result: result as unknown as CheckinResultDTO, seatId: null }}
        undoPending={false}
        onUndo={() => {}}
        onDismiss={() => {}}
      />
    </I18nProvider>,
  )
  const icon = getByTestId("result-icon").getAttribute("data-icon")
  unmount()
  return icon
}

describe("CheckinResultCard icon", () => {
  it("pins the icon for every outcome on a first scan", () => {
    expect(Object.keys(ICON).sort()).toEqual([...CheckinOutcomeSchema.options].sort())
    for (const outcome of CheckinOutcomeSchema.options) {
      expect(iconFor(outcome, true), outcome).toBe(ICON[outcome])
    }
  })

  it("shows a repeat scan of a checked-in ticket with the already-checked-in icon", () => {
    expect(iconFor("checked_in", false)).toBe("UserCheck")
  })
})
