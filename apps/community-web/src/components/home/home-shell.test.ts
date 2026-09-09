import * as React from "react"
import { describe, expect, it, vi } from "vitest"

const dynamicImportCounts = vi.hoisted(() => ({ map: 0, mapControls: 0 }))

vi.mock("@/features/map/home-map", () => {
  dynamicImportCounts.map += 1
  return { HomeMap: () => null }
})

vi.mock("@/components/home/web-map-controls", () => {
  dynamicImportCounts.mapControls += 1
  return { WebMapControls: () => null }
})

vi.mock("@civfix/ui/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("@civfix/ui/theme", () => ({
  useLayoutMode: () => "compact",
}))

vi.mock("@/components/home/use-web-nav-adapter", () => ({
  useWebNavAdapter: vi.fn(),
}))

const { HomeShell, AppShellFrame } = await import("./home-shell")

type AppShellSlots = {
  map: React.ReactNode
  mapControls: React.ReactNode
}

function isMainElement(
  child: React.ReactNode,
): child is React.ReactElement<{ id?: string; children?: React.ReactNode }> {
  return React.isValidElement<{ id?: string; children?: React.ReactNode }>(child) && child.props.id === "main"
}

function isAppShellElement(child: React.ReactNode): child is React.ReactElement<AppShellSlots> {
  return (
    React.isValidElement<AppShellSlots>(child) && "map" in child.props && "mapControls" in child.props
  )
}

function asElement<Props>(node: React.ReactNode): React.ReactElement<Props> {
  if (!React.isValidElement<Props>(node)) throw new Error("Expected an AppShell slot element")
  return node
}

function renderShell(): React.ReactElement<{ children?: React.ReactNode }> {
  const delegated = HomeShell()
  expect(delegated.type).toBe(AppShellFrame)
  return AppShellFrame()
}

function appShellSlots(): AppShellSlots {
  const shell = renderShell()
  const shellChildren = React.Children.toArray(shell.props.children)
  const content = shellChildren.find(isMainElement)
  const appShell = React.Children.toArray(content?.props.children ?? shellChildren).find(isAppShellElement)

  if (!appShell) throw new Error("HomeShell did not render AppShell")
  return appShell.props
}

function lazySlotType(slot: React.ReactNode): React.ReactElement["type"] {
  const wrapper = asElement<{ children: React.ReactNode }>(slot)
  return asElement(wrapper.props.children).type
}

describe("HomeShell map composition", () => {
  it("constructs distinct lazy map slots without evaluating their modules", () => {
    const slots = appShellSlots()

    expect(lazySlotType(slots.map)).not.toBe(lazySlotType(slots.mapControls))
    expect(dynamicImportCounts).toEqual({ map: 0, mapControls: 0 })
  })

  it("keeps supplying stable map slots across host renders for expanded AppShell reuse", () => {
    const firstSlots = appShellSlots()
    const secondSlots = appShellSlots()

    expect(lazySlotType(secondSlots.map)).toBe(lazySlotType(firstSlots.map))
    expect(lazySlotType(secondSlots.mapControls)).toBe(lazySlotType(firstSlots.mapControls))
    expect(dynamicImportCounts).toEqual({ map: 0, mapControls: 0 })
  })
})
