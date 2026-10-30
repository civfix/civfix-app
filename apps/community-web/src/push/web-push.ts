import { webPushPermission, onPushPermissionGranted } from "@/lib/push-permission"
import { isConfirmedSignedOut, useAuthStore, type AuthState } from "@/store/auth-store"
import { warnPush } from "@/push/log"
import { startMarkingClicks } from "@/push/notification-clicks"
import { closeReadNotifications } from "@/push/reconcile"
import { serviceWorkerContainer, syncSubscription, unsubscribeBrowser } from "@/push/subscription"

/** A session check that got no answer keeps the snapshot and is not a sign-out (see isConfirmedSignedOut). */
function signedOut(state: AuthState): boolean {
  return state.status === "anonymous" && isConfirmedSignedOut(state)
}

/** Everything web push does while someone is signed in; the returned function ends it. */
function startSession(): () => void {
  let active = true
  let started = false
  let starting: Promise<void> | null = null
  // A click needs only a session to mark it read, not the key or the worker's registration.
  const stops: (() => void)[] = [startMarkingClicks()]
  const stillWanted = () => active

  async function start(): Promise<void> {
    const container = serviceWorkerContainer()
    if (!container || (await webPushPermission.status()) === "unsupported" || !active) return
    const registration = await container.register("/sw.js", { scope: "/" })
    if (!active) return
    started = true

    const sync = () => {
      syncSubscription(registration, stillWanted).catch((err: unknown) =>
        warnPush("subscribing", err),
      )
    }
    const reconcile = () => {
      closeReadNotifications(registration).catch((err: unknown) =>
        warnPush("closing read notifications", err),
      )
    }
    sync()
    reconcile()
    stops.push(onPushPermissionGranted(sync))
    window.addEventListener("focus", reconcile)
    stops.push(() => window.removeEventListener("focus", reconcile))
  }

  // A start that could not read the backend's key tries again the next time the tab gains focus.
  const attempt = () => {
    if (started || starting) return
    starting = start()
      .catch((err: unknown) => warnPush("starting", err))
      .finally(() => {
        starting = null
      })
  }
  attempt()
  window.addEventListener("focus", attempt)
  stops.push(() => window.removeEventListener("focus", attempt))

  return () => {
    active = false
    for (const stop of stops.splice(0)) stop()
  }
}

/**
 * Runs web push for the signed-in account and drops this browser's subscription on any confirmed
 * sign-out (useLogout also unregisters it with the server first; a 401 cannot).
 */
export function installWebPush(): () => void {
  let stopSession: (() => void) | null = null
  let wasSignedOut = signedOut(useAuthStore.getState())

  const follow = (state: AuthState) => {
    if (state.status === "authenticated") stopSession ??= startSession()
    else if (state.status === "anonymous" && stopSession) {
      stopSession()
      stopSession = null
    }

    const nowSignedOut = signedOut(state)
    if (nowSignedOut && !wasSignedOut) {
      const container = serviceWorkerContainer()
      if (container)
        unsubscribeBrowser(container).catch((err: unknown) => warnPush("unsubscribing", err))
    }
    wasSignedOut = nowSignedOut
  }

  follow(useAuthStore.getState())
  const unsubscribe = useAuthStore.subscribe(follow)
  return () => {
    unsubscribe()
    stopSession?.()
    stopSession = null
  }
}
