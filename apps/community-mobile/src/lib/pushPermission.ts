import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"
import type { PermissionStatus } from "expo-notifications"

const DEV_VARIANT_APP_ID = "org.civfix.community.dev"

// Android answers a request it will not show at once, while a person reading the dialog takes longer than
// this to act on it. A quick decline misread as no dialog only opens settings, and a slow answer with no
// dialog only costs one more tap.
const NO_DIALOG_MS = 1000

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
  // Times Turn on's ask; Date.now unless a test scripts it.
  now?(): number
}

// Android 13+ reports a POST_NOTIFICATIONS it has never asked about as denied with canAskAgain true, so a
// denial the OS can still ask about reads as undetermined, and the sign-in prompt asks. Once asked, a
// dismissed dialog (Back or a tap outside) also reads canAskAgain false, exactly like a denial Android will
// never ask about again, so status() reports both as denied and Turn on lands in openSettings. There it asks
// first: an answer that comes back without a dialog means the OS will not ask, and only then does it open
// civfix's settings page. D6 keeps push off the .dev variant, which is its own app beside the store one.
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
    async openSettings(): Promise<void> {
      if (!supported) return deps.openSettings()
      const now = deps.now ?? Date.now
      const askedAt = now()
      let answer: PushPermissionStatus
      try {
        answer = capabilityStatus(await deps.requestPermissionsAsync())
      } catch {
        // An ask the OS could not even start leaves settings as the only way to turn push on.
        return deps.openSettings()
      }
      if (answer === "granted") deps.onGranted?.()
      else if (now() - askedAt < NO_DIALOG_MS) await deps.openSettings()
    },
  }
}

function capabilityStatus(
  os: Awaited<ReturnType<NativePushPermissionDeps["getPermissionsAsync"]>>,
): PushPermissionStatus {
  return os.status === "denied" && os.canAskAgain === true ? "undetermined" : os.status
}
