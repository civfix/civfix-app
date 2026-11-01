import type { NotificationDTO, PushMessageData } from "@civfix/contract"
import type { NotificationBehavior } from "expo-notifications"

export type ClearMessage = Extract<PushMessageData, { kind: "clear" }>

export interface DeliveredNotification {
  request: { identifier: string; content: { data?: unknown } }
}

export interface DeliveredDeps {
  presented(): Promise<readonly DeliveredNotification[]>
  dismiss(identifier: string): Promise<unknown>
  listFirstPage(): Promise<readonly Pick<NotificationDTO, "id" | "read">[]>
}

export function decodeRemotePushData(_payload: unknown, _os: string): PushMessageData | null {
  throw new Error("not implemented")
}

export function clearDelivered(_message: ClearMessage, _deps: DeliveredDeps): Promise<void> {
  throw new Error("not implemented")
}

export function reconcileDelivered(_deps: DeliveredDeps): Promise<void> {
  throw new Error("not implemented")
}

export function notificationPresentation(_data: unknown): NotificationBehavior {
  throw new Error("not implemented")
}
