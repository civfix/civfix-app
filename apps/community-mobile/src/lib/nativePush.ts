/**
 * Native PUSH capability impl - the platform-seam realization of `@civfix/ui/capabilities`
 * PushCapability for the mobile app (mirrors src/lib/nativeGeolocation.ts). It wraps the existing
 * src/push/register.ts `registerForPushNotifications()` so the shared settings push toggle
 * (NotificationPrefsBody) can mint + register a real device token instead of the FakePush no-op.
 *
 *   - isAvailable()       : true on iOS/Android (a real OS push runtime exists); false on web.
 *   - registerForToken()  : run the full permission -> token -> POST /push/register flow and return the
 *                           Expo push token when it succeeds, else null (declined / unsupported / error).
 */
import { Platform } from "react-native"
import type { PushCapability } from "@civfix/ui/capabilities"
import { registerForPushNotifications } from "@/push/register"

/** The native PushCapability singleton (built once for the app lifetime). */
export const nativePush: PushCapability = {
  isAvailable(): boolean {
    // A real OS push runtime exists on device (iOS/Android); web has none in this app.
    return Platform.OS !== "web"
  },

  async registerForToken(): Promise<string | null> {
    const result = await registerForPushNotifications()
    return result.status === "registered" ? result.token : null
  },
}
