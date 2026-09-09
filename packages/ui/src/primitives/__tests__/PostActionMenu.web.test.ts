import { describe, expect, it, vi } from "vitest"
import {
  createPostActionMenuWebController,
  handlePostActionMenuWebKey,
  postActionMenuAccessibility,
} from "../PostActionMenu.webBehavior"

function keyEvent(key: string, shiftKey = false) {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
}

function schedulerHarness() {
  let nextRequest = 1
  const callbacks = new Map<number, () => void>()
  return {
    scheduler: {
      request(callback: () => void) {
        const request = nextRequest++
        callbacks.set(request, callback)
        return request
      },
      cancel(request: number) {
        callbacks.delete(request)
      },
    },
    run(request: number) {
      const callback = callbacks.get(request)
      callbacks.delete(request)
      callback?.()
    },
  }
}

function controllerHarness() {
  const scheduled = schedulerHarness()
  const onDismiss = vi.fn()
  const focusInitialItem = vi.fn()
  const restoreTriggerFocus = vi.fn()
  const controller = createPostActionMenuWebController({
    onDismiss,
    focusInitialItem,
    restoreTriggerFocus,
    scheduler: scheduled.scheduler,
  })
  return { controller, onDismiss, focusInitialItem, restoreTriggerFocus, ...scheduled }
}

describe("PostActionMenu web lifecycle and accessibility seam", () => {
  it("builds dialog, modal, menu, and backdrop semantics from the LOCALIZED labels it is handed", () => {
    expect(
      postActionMenuAccessibility({ menu: "Repost options", dismiss: "Dismiss repost menu" }),
    ).toEqual({
      dialog: {
        role: "dialog",
        label: "Repost options",
        accessibilityViewIsModal: true,
        ariaModal: true,
      },
      menu: { role: "menu", label: "Repost options" },
      backdrop: { role: "button", label: "Dismiss repost menu" },
    })
  })

  it("carries no hardcoded copy of its own - a translated pair labels every surface", () => {
    const semantics = postActionMenuAccessibility({
      menu: "Opciones de republicacion",
      dismiss: "Cerrar el menu de republicacion",
    })

    expect(semantics.dialog.label).toBe("Opciones de republicacion")
    expect(semantics.menu.label).toBe("Opciones de republicacion")
    expect(semantics.backdrop.label).toBe("Cerrar el menu de republicacion")
  })

  it("dismisses through the same controller when the outside backdrop is pressed", () => {
    const { controller, onDismiss } = controllerHarness()

    expect(controller.dismissFromBackdrop()).toBe("dismiss")
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it("moves initial focus to the first item on the scheduled browser frame", () => {
    const { controller, focusInitialItem, run } = controllerHarness()

    const request = controller.open()
    expect(focusInitialItem).not.toHaveBeenCalled()

    run(request)
    expect(focusInitialItem).toHaveBeenCalledOnce()
  })

  it("cancels pending initial focus and restores trigger focus after close", () => {
    const { controller, focusInitialItem, restoreTriggerFocus, run } = controllerHarness()

    const initialRequest = controller.open()
    const restoreRequest = controller.close()
    run(initialRequest)
    expect(focusInitialItem).not.toHaveBeenCalled()

    run(restoreRequest)
    expect(restoreTriggerFocus).toHaveBeenCalledOnce()
  })
})

describe("PostActionMenu web keyboard seam", () => {
  it("dismisses on Escape and consumes the browser event", () => {
    const event = keyEvent("Escape")
    const onDismiss = vi.fn()
    const onFocus = vi.fn()

    expect(handlePostActionMenuWebKey({ event, activeIndex: 0, itemCount: 2, onDismiss, onFocus })).toBe(
      "dismiss",
    )
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onFocus).not.toHaveBeenCalled()
  })

  it("wraps Tab focus between menu items without dismissing", () => {
    const event = keyEvent("Tab")
    const onDismiss = vi.fn()
    const onFocus = vi.fn()

    expect(handlePostActionMenuWebKey({ event, activeIndex: 1, itemCount: 2, onDismiss, onFocus })).toBe(
      "focus",
    )
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(onFocus).toHaveBeenCalledWith(0)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("leaves unrelated keys untouched", () => {
    const event = keyEvent("Enter")
    const onDismiss = vi.fn()
    const onFocus = vi.fn()

    expect(handlePostActionMenuWebKey({ event, activeIndex: 0, itemCount: 2, onDismiss, onFocus })).toBe(
      "none",
    )
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
    expect(onFocus).not.toHaveBeenCalled()
  })
})
