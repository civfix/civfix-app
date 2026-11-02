import { decodePushMessageData } from "@civfix/contract"
import type { AuthStatus } from "@/lib/lifecycleTypes"

/** The slice of an expo-notifications `NotificationResponse` this file reads. */
export interface TappedNotification {
  notification: { request: { identifier: string; content: { data?: unknown } } }
}

// The injected calls keep this file free of native imports, so node --test can run it;
// src/push/useNotificationDeepLinks.ts passes the auth store, the API and the nav adapter.
export interface NotificationResponseDeps {
  authStatus(): AuthStatus
  onAuthStatus(listener: (status: AuthStatus) => void): () => void
  markRead(ids: string[]): Promise<unknown>
  open(link: string): void
  /** Response identifiers already handled: a cold start reads the same tap from the listener and the launch. */
  handled: Set<string>
}

type SettledAuth = "authed" | "unauthed"

function isSettled(status: AuthStatus): status is SettledAuth {
  return status === "authed" || status === "unauthed"
}

// A cold start opens the app before the session is restored; the read waits for it instead of going out
// without a token.
function settledAuth(deps: NotificationResponseDeps): Promise<SettledAuth> {
  const now = deps.authStatus()
  if (isSettled(now)) return Promise.resolve(now)
  return new Promise((resolve) => {
    const unsubscribe = deps.onAuthStatus((status) => {
      if (!isSettled(status)) return
      unsubscribe()
      resolve(status)
    })
  })
}

/** A tapped push opens its link and marks its notification read (D8), on a warm or a cold start. */
export async function openNotificationResponse(
  response: TappedNotification,
  deps: NotificationResponseDeps,
): Promise<void> {
  const { identifier, content } = response.notification.request
  if (deps.handled.has(identifier)) return
  const data = decodePushMessageData(content.data)
  if (data?.kind !== "notification") return
  deps.handled.add(identifier)

  if (data.link !== null) deps.open(data.link)

  if ((await settledAuth(deps)) !== "authed") return
  try {
    await deps.markRead([data.notificationId])
  } catch (err) {
    console.warn("[push] the tapped notification could not be marked read", err)
  }
}
