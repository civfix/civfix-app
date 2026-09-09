import { resolvePostActionMenuFocus, resolvePostActionMenuKey } from "./postActionModel"

export interface PostActionMenuWebScheduler {
  request: (callback: () => void) => number
  cancel: (request: number) => void
}

/**
 * The dialog/menu/backdrop accessibility names. The strings are LOCALIZED by the component (useT) and
 * handed in, so this behaviour module stays copy-free and the web menu is not the one English island in a
 * four-locale app.
 */
export interface PostActionMenuWebLabels {
  /** The menu + dialog accessible name (e.g. "Repost options"). */
  menu: string
  /** The backdrop button's accessible name (e.g. "Dismiss repost menu"). */
  dismiss: string
}

/**
 * Build the dialog/menu/backdrop semantics the web menu spreads onto its views. Pure + called on every
 * render (not captured once in the controller) so switching the app language re-labels a menu that is
 * already open.
 */
export function postActionMenuAccessibility(labels: PostActionMenuWebLabels) {
  return {
    dialog: {
      role: "dialog",
      label: labels.menu,
      accessibilityViewIsModal: true,
      ariaModal: true,
    },
    menu: { role: "menu", label: labels.menu },
    backdrop: { role: "button", label: labels.dismiss },
  } as const
}

export function createPostActionMenuWebController({
  onDismiss,
  focusInitialItem,
  restoreTriggerFocus,
  scheduler,
}: {
  onDismiss: () => void
  focusInitialItem: () => void
  restoreTriggerFocus: () => void
  scheduler: PostActionMenuWebScheduler
}) {
  let initialFocusRequest: number | null = null
  const dismiss = () => onDismiss()

  return {
    dismiss,
    dismissFromBackdrop(): "dismiss" {
      dismiss()
      return "dismiss"
    },
    open(): number {
      if (initialFocusRequest != null) scheduler.cancel(initialFocusRequest)
      initialFocusRequest = scheduler.request(() => {
        initialFocusRequest = null
        focusInitialItem()
      })
      return initialFocusRequest
    },
    close(): number {
      if (initialFocusRequest != null) scheduler.cancel(initialFocusRequest)
      initialFocusRequest = null
      return scheduler.request(restoreTriggerFocus)
    },
  }
}

export interface PostActionMenuWebKeyEvent {
  key: string
  shiftKey: boolean
  preventDefault: () => void
  stopPropagation: () => void
}

export function handlePostActionMenuWebKey({
  event,
  activeIndex,
  itemCount,
  onDismiss,
  onFocus,
}: {
  event: PostActionMenuWebKeyEvent
  activeIndex: number
  itemCount: number
  onDismiss: () => void
  onFocus: (index: number) => void
}): "dismiss" | "focus" | "none" {
  if (resolvePostActionMenuKey(event.key) === "dismiss") {
    event.preventDefault()
    event.stopPropagation()
    onDismiss()
    return "dismiss"
  }

  const focusIndex = resolvePostActionMenuFocus({
    key: event.key,
    shiftKey: event.shiftKey,
    activeIndex,
    itemCount,
  })
  if (focusIndex == null) return "none"

  event.preventDefault()
  onFocus(focusIndex)
  return "focus"
}
