import * as React from "react"
import { describe, expect, it, vi } from "vitest"

// Each lazy slot keeps its loader, so a test can name the module it would load without loading it.
const lazy = vi.hoisted(() => ({ loaders: new Map<unknown, () => Promise<unknown>>() }))

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    const Lazy = () => null
    lazy.loaders.set(Lazy, loader)
    return Lazy
  },
}))

const AuthModal = vi.hoisted(() => () => null)
const WebBrandAbout = vi.hoisted(() => () => null)
const WebPushPrompt = vi.hoisted(() => () => null)

vi.mock("@/components/auth/auth-modal", () => ({ AuthModal }))
vi.mock("@/components/home/web-brand-about", () => ({ WebBrandAbout }))
vi.mock("@/components/home/web-push-prompt", () => ({ WebPushPrompt }))

vi.mock("@civfix/ui/i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock("@civfix/ui/theme", () => ({
  useLayoutMode: () => "compact",
}))

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/home/use-web-nav-adapter", () => ({ useWebNavAdapter: vi.fn() }))
vi.mock("@/components/home/use-team-invite-accept", () => ({ useTeamInviteAccept: vi.fn() }))

const { AppShellFrame } = await import("./home-shell")

type AppShellSlots = {
  map: React.ReactNode
  mapControls: React.ReactNode
  authOverlay?: React.ReactNode
  mapPrompt?: React.ReactNode
}

function isAppShellElement(child: React.ReactNode): child is React.ReactElement<AppShellSlots> {
  return (
    React.isValidElement<AppShellSlots>(child) &&
    "map" in child.props &&
    "mapControls" in child.props
  )
}

function findAppShell(nodes: React.ReactNode): React.ReactElement<AppShellSlots> | undefined {
  for (const child of React.Children.toArray(nodes)) {
    if (isAppShellElement(child)) return child
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      const nested = findAppShell(child.props.children)
      if (nested) return nested
    }
  }
  return undefined
}

function appShellSlots(): AppShellSlots {
  const appShell = findAppShell(AppShellFrame())
  if (!appShell) throw new Error("AppShellFrame did not render AppShell")
  return appShell.props
}

/** What a slot element renders: the component a lazy slot loads, or the component itself. */
async function resolvedType(node: React.ReactNode): Promise<unknown> {
  if (!React.isValidElement(node)) throw new Error("Expected a slot element")
  const loader = lazy.loaders.get(node.type)
  return loader ? loader() : node.type
}

async function resolvedChildren(slot: React.ReactNode): Promise<unknown[]> {
  if (!React.isValidElement<{ children?: React.ReactNode }>(slot)) return []
  const children = slot.type === React.Fragment ? slot.props.children : slot
  return Promise.all(React.Children.toArray(children).map(resolvedType))
}

describe("AppShellFrame's overlay slots", () => {
  it("T30: the push card goes in the map prompt slot; the auth modal and the about sheet stay in the overlay", async () => {
    const slots = appShellSlots()

    expect(await resolvedType(slots.mapPrompt)).toBe(WebPushPrompt)
    const overlay = await resolvedChildren(slots.authOverlay)
    expect(overlay).toContain(AuthModal)
    expect(overlay).toContain(WebBrandAbout)
    expect(overlay).not.toContain(WebPushPrompt)
  })
})
