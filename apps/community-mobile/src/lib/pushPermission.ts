import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"
import type { PermissionStatus } from "expo-notifications"

const DEV_VARIANT_APP_ID = "org.civfix.community.dev"

// The injected calls keep this file free of native imports, so node --test can run it; app/_layout.tsx
// passes the real expo-notifications and Linking calls.
export interface NativePushPermissionDeps {
  appId: string | null | undefined
  getPermissionsAsync(): Promise<{ status: `${PermissionStatus}`; canAskAgain?: boolean }>
  requestPermissionsAsync(): Promise<{ status: `${PermissionStatus}`; canAskAgain?: boolean }>
  openSettings(): Promise<void>
}

// Maps on status alone: a denial the OS will not ask about again (canAskAgain false) is still denied, and
// openSettings is the way back. D6 keeps push off the .dev variant, which is its own app beside the store one.
export function makeNativePushPermission(deps: NativePushPermissionDeps): PushPermissionCapability {
  const supported = deps.appId !== DEV_VARIANT_APP_ID
  return {
    async status(): Promise<PushPermissionStatus> {
      return supported ? (await deps.getPermissionsAsync()).status : "unsupported"
    },
    async request(): Promise<PushPermissionStatus> {
      return supported ? (await deps.requestPermissionsAsync()).status : "unsupported"
    },
    openSettings(): Promise<void> {
      return deps.openSettings()
    },
  }
}
