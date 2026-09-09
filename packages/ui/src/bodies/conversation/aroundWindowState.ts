import type { ChatItem } from "@civfix/shared"

export type AroundWindowState = "inactive" | "dead" | "active"

export function aroundWindowState(aroundWindow: ChatItem[] | null): AroundWindowState {
  if (aroundWindow === null) return "inactive"
  return aroundWindow.length === 0 ? "dead" : "active"
}
