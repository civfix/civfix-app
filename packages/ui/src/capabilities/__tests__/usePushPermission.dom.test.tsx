import { act, renderHook, waitFor } from "@testing-library/react"
import { focusManager } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CapabilitiesProvider,
  makeFakeCapabilities,
  usePushPermission,
  type FakePushPermission,
  type PlatformCapabilities,
  type PushPermissionCapability,
} from ".."

function setup(pushPermission?: PushPermissionCapability) {
  const capabilities: PlatformCapabilities = makeFakeCapabilities()
  if (pushPermission) capabilities.pushPermission = pushPermission
  const fake = capabilities.pushPermission as FakePushPermission
  const statusSpy = vi.spyOn(capabilities.pushPermission, "status")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CapabilitiesProvider value={capabilities}>{children}</CapabilitiesProvider>
  )
  return { fake, statusSpy, wrapper }
}

afterEach(() => {
  // focusManager is a process-wide singleton: hand the next test back its default (document-driven) state.
  focusManager.setFocused(undefined)
  vi.restoreAllMocks()
})

describe("usePushPermission", () => {
  it("T17: status is null until the first read settles, then the capability's status", async () => {
    const { fake, statusSpy, wrapper } = setup()
    fake.setStatus("denied")
    const { result } = renderHook(() => usePushPermission(), { wrapper })
    expect(result.current.status).toBeNull()
    await waitFor(() => expect(result.current.status).toBe("denied"))
    expect(statusSpy).toHaveBeenCalledTimes(1)
  })

  it("T18: re-reads the status when the app or tab returns to the foreground", async () => {
    const { fake, statusSpy, wrapper } = setup()
    fake.setStatus("denied")
    const { result } = renderHook(() => usePushPermission(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe("denied"))
    fake.setStatus("granted")
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(result.current.status).toBe("granted"))
    expect(statusSpy).toHaveBeenCalledTimes(2)
  })

  it("T19: request() resolves the capability's answer and the hook's status follows it", async () => {
    const { fake, wrapper } = setup()
    fake.setStatus("undetermined")
    fake.setRequestResult("granted")
    const { result } = renderHook(() => usePushPermission(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe("undetermined"))
    let answer: string | undefined
    await act(async () => {
      answer = await result.current.request()
    })
    expect(answer).toBe("granted")
    expect(result.current.status).toBe("granted")
  })

  it("T20: a capability without openSettings (web) leaves the hook's openSettings undefined", async () => {
    const webShaped: PushPermissionCapability = {
      status: async () => "undetermined",
      request: async () => "undetermined",
    }
    const { wrapper } = setup(webShaped)
    const { result } = renderHook(() => usePushPermission(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe("undetermined"))
    expect(result.current.openSettings).toBeUndefined()
  })

  it("T21: an unmounted hook stops listening for the foreground", async () => {
    const consoleError = vi.spyOn(console, "error")
    const { statusSpy, wrapper } = setup()
    const { result, unmount } = renderHook(() => usePushPermission(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe("unsupported"))
    unmount()
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(statusSpy).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
