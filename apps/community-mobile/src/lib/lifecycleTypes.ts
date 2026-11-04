// RN's AppStateStatus restated so the lifecycle policies stay free of react-native and unit-testable.
export type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"

const APP_LIFECYCLE_STATES: readonly AppLifecycleState[] = [
  "active",
  "background",
  "inactive",
  "unknown",
  "extension",
]

/** React Native's strict types give AppState.currentState as any string, or null before the first report. */
export function appLifecycleState(state: string | null | undefined): AppLifecycleState {
  return APP_LIFECYCLE_STATES.find((known) => known === state) ?? "unknown"
}

export type AuthStatus = "idle" | "loading" | "authed" | "unauthed"
