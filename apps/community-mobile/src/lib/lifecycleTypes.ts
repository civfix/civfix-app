// RN's AppStateStatus restated so the lifecycle policies stay free of react-native and unit-testable.
export type AppLifecycleState = "active" | "background" | "inactive" | "unknown" | "extension"

export type AuthStatus = "idle" | "loading" | "authed" | "unauthed"
