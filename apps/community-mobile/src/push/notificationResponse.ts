import type { AuthStatus } from "@/lib/lifecycleTypes"

export interface TappedNotification {
  notification: { request: { identifier: string; content: { data?: unknown } } }
}

export interface NotificationResponseDeps {
  authStatus(): AuthStatus
  onAuthStatus(listener: (status: AuthStatus) => void): () => void
  markRead(ids: string[]): Promise<unknown>
  open(link: string): void
  handled: Set<string>
}

export function openNotificationResponse(
  _response: TappedNotification,
  _deps: NotificationResponseDeps,
): Promise<void> {
  throw new Error("not implemented")
}
