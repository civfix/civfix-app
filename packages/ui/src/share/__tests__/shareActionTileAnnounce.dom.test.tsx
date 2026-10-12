import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type * as ReactNative from "react-native"
import { ShareActionTile } from "../ShareActionTile"

// The icon set pulls in native-only modules; the tile's status is all this needs.
vi.mock("../../typography", async () => {
  const { Text } = await vi.importActual<typeof ReactNative>("react-native")
  return { Text, Icon: () => null, iconMap: {} }
})

const region = (priority: "polite" | "assertive") =>
  document.getElementById(`civfix-aria-live-${priority}`)?.textContent ?? ""

describe("ShareActionTile status announcement on web", () => {
  it("announces a new status politely through the page's live region", async () => {
    const tile = (status?: string) => (
      <ShareActionTile icon="Copy" label="Copy link" status={status} onPress={() => {}} />
    )
    const { rerender } = render(tile())
    rerender(tile("Link copied"))
    await waitFor(() => expect(region("polite")).toBe("Link copied"))
    expect(region("assertive")).toBe("")
  })
})
