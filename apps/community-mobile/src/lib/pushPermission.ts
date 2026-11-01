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
  // Registers the token right after a grant, whichever surface asked (the sign-in prompt or the settings
  // banner's Turn on).
  onGranted?(): void
}

// Android 13+ reports a POST_NOTIFICATIONS it has never asked about as denied with canAskAgain true, so a
// denial the OS can still ask about reads as undetermined: the sign-in prompt and Turn on then ask instead of
// sending the person to settings. A denial it will not ask about again (canAskAgain false, or absent) stays
// denied, and openSettings is the way back. D6 keeps push off the .dev variant, which is its own app beside
// the store one.
export function makeNativePushPermission(deps: NativePushPermissionDeps): PushPermissionCapability {
  const supported = deps.appId !== DEV_VARIANT_APP_ID
  return {
    async status(): Promise<PushPermissionStatus> {
      return supported ? capabilityStatus(await deps.getPermissionsAsync()) : "unsupported"
    },
    async request(): Promise<PushPermissionStatus> {
      if (!supported) return "unsupported"
      const status = capabilityStatus(await deps.requestPermissionsAsync())
      if (status === "granted") deps.onGranted?.()
      return status
    },
    openSettings(): Promise<void> {
      return deps.openSettings()
    },
  }
}

function capabilityStatus(
  os: Awaited<ReturnType<NativePushPermissionDeps["getPermissionsAsync"]>>,
): PushPermissionStatus {
  return os.status === "denied" && os.canAskAgain === true ? "undetermined" : os.status
}
