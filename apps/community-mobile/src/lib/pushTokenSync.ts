import type { RegisterPushTokenRequest } from "@civfix/contract"
import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"
import type { DevicePushToken } from "expo-notifications"
import type { KeyValueStore } from "@/lib/mmkv"

export const PUSH_ASKED_KEY = "civfix.push.asked"

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "conflict"; reason: string }
  | { status: "error"; reason: string }

export interface PushTokenSyncDeps {
  permission: PushPermissionCapability
  getDevicePushToken(): Promise<DevicePushToken>
  deviceId(): Promise<string | null>
  registerPush(body: RegisterPushTokenRequest): Promise<unknown>
  store: KeyValueStore
}

export function syncPushToken(
  _deps: PushTokenSyncDeps,
  _rotated?: DevicePushToken,
): Promise<PushRegistrationResult> {
  throw new Error("not implemented")
}

export interface PushPromptDeps {
  permission: PushPermissionCapability
  store: KeyValueStore
}

export function promptForPushAtSignIn(_deps: PushPromptDeps): Promise<PushPermissionStatus> {
  throw new Error("not implemented")
}
