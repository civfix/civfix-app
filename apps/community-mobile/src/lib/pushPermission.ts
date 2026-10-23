import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"

export interface NativePushPermissionDeps {
  appId: string | null | undefined
  getPermissionsAsync(): Promise<{ status: string; canAskAgain?: boolean }>
  requestPermissionsAsync(): Promise<{ status: string; canAskAgain?: boolean }>
  openSettings(): Promise<void>
}

export function makeNativePushPermission(_deps: NativePushPermissionDeps): PushPermissionCapability {
  return {
    status: (): Promise<PushPermissionStatus> => Promise.reject(new Error("not implemented")),
    request: (): Promise<PushPermissionStatus> => Promise.reject(new Error("not implemented")),
  }
}
