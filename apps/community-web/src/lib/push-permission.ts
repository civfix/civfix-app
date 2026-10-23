import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"

export const webPushPermission: PushPermissionCapability = {
  status: (): Promise<PushPermissionStatus> => Promise.reject(new Error("not implemented")),
  request: (): Promise<PushPermissionStatus> => Promise.reject(new Error("not implemented")),
}
