export type KeyboardDismissMode = "interactive" | "on-drag"

/** React Native honors "interactive" on iOS only; Android treats it as "none" and never dismisses on drag. */
export function keyboardDismissModeFor(os: string): KeyboardDismissMode {
  return os === "ios" ? "interactive" : "on-drag"
}
