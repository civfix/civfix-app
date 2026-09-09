export type SecondaryShellBackAction = "pop-detail" | "system"

export function secondaryShellBackAction(stackLength: number, canPopRoute: boolean): SecondaryShellBackAction {
  if (stackLength > 1) return "pop-detail"
  if (stackLength === 1 && !canPopRoute) return "pop-detail"
  return "system"
}
