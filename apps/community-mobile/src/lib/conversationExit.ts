export type ConversationExitPlan =
  | { type: "back"; seedView: "messaging" | null }
  | { type: "home"; seedView: "messaging" }

export interface ConversationExitInput {
  canGoBack: boolean
  rootShellSeen: boolean
}

export function conversationExitPlan({
  canGoBack,
  rootShellSeen,
}: ConversationExitInput): ConversationExitPlan {
  if (!canGoBack) return { type: "home", seedView: "messaging" }
  if (!rootShellSeen) return { type: "back", seedView: "messaging" }
  return { type: "back", seedView: null }
}
