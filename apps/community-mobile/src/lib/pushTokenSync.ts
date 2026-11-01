import type { RegisterPushTokenRequest } from "@civfix/contract"
import type { PushPermissionCapability, PushPermissionStatus } from "@civfix/ui/capabilities"
import type { DevicePushToken } from "expo-notifications"
import type { KeyValueStore } from "@/lib/mmkv"
// Relative paths, not the "@/" alias: node --test loads this module without the alias hooks.
import { isConflict } from "./errors.ts"
import { readPushRegistration, rememberPushRegistration } from "./pushRegistration.ts"

// Kept beside the registration record but never cleared by sign-out: D6 asks once per device, not per
// account.
export const PUSH_ASKED_KEY = "civfix.push.asked"

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "unchanged"; token: string }
  | { status: "denied" }
  | { status: "unsupported"; reason: string }
  | { status: "conflict"; reason: string }
  | { status: "error"; reason: string }

// The injected calls keep this file free of native imports, so node --test can run it; src/push/register.ts
// passes the real expo-notifications, secure-store and API calls.
export interface PushTokenSyncDeps {
  permission: PushPermissionCapability
  getDevicePushToken(): Promise<DevicePushToken>
  deviceId(): Promise<string | null>
  registerPush(body: RegisterPushTokenRequest): Promise<unknown>
  store: KeyValueStore
}

/**
 * Registers this device's native token (APNs hex on iOS, FCM on Android) when push is allowed. It reads
 * the permission and never asks for it: only the sign-in prompt does (D6). A fetched token is always sent,
 * so a token the server dropped comes back; a `rotated` one only when it differs from the last one sent.
 */
export async function syncPushToken(
  deps: PushTokenSyncDeps,
  rotated?: DevicePushToken,
): Promise<PushRegistrationResult> {
  try {
    const status = await deps.permission.status()
    if (status === "unsupported") {
      return { status: "unsupported", reason: "push is off for this app variant" }
    }
    if (status !== "granted") return { status: "denied" }

    const native = rotated ?? (await deps.getDevicePushToken())
    if (native.type !== "ios" && native.type !== "android") {
      return { status: "unsupported", reason: `no native token on ${native.type}` }
    }
    const token: unknown = native.data
    if (typeof token !== "string" || token.length === 0) {
      return { status: "error", reason: "empty push token" }
    }

    // expo-notifications reports every fetched token to addPushTokenListener too, not only a rotation, so
    // without this each launch, return and grant would spend two of registerPush's 10 a minute.
    const last = readPushRegistration(deps.store)
    if (rotated && last?.platform === native.type && last.token === token) {
      return { status: "unchanged", token }
    }

    const deviceId = await deps.deviceId()
    await deps.registerPush({
      platform: native.type,
      token,
      ...(deviceId ? { deviceId } : {}),
    })
    rememberPushRegistration(deps.store, { platform: native.type, token })
    return { status: "registered", token }
  } catch (err) {
    if (isConflict(err)) {
      return { status: "conflict", reason: "this device's token is still owned by another account" }
    }
    return { status: "error", reason: err instanceof Error ? err.message : "unknown error" }
  }
}

export interface PushPromptDeps {
  permission: PushPermissionCapability
  store: KeyValueStore
}

/**
 * Shows the system prompt once per device, when it has never been asked. A device that already decided
 * counts as asked too, so a later revoke is never re-asked; the .dev variant, which has no push, is left
 * unmarked.
 */
export async function promptForPushAtSignIn(deps: PushPromptDeps): Promise<PushPermissionStatus> {
  const status = await deps.permission.status()
  if (status === "unsupported" || deps.store.getString(PUSH_ASKED_KEY) !== undefined) return status
  // Written before the prompt: an app killed while it is up must not prompt again on the next sign-in.
  deps.store.set(PUSH_ASKED_KEY, "1")
  if (status !== "undetermined") return status
  return deps.permission.request()
}

/**
 * Keeps one registration in flight. A trigger that arrives meanwhile runs once more afterwards, with the
 * newest rotated token, so a rotation is never lost behind a slower launch sync.
 */
export function makeSerialPushSync(
  sync: (rotated?: DevicePushToken) => Promise<void>,
): (rotated?: DevicePushToken) => Promise<void> {
  let running: Promise<void> | null = null
  let queued: { rotated: DevicePushToken | undefined } | null = null

  const drain = async (rotated: DevicePushToken | undefined): Promise<void> => {
    let next: { rotated: DevicePushToken | undefined } | null = { rotated }
    while (next) {
      const current: DevicePushToken | undefined = next.rotated
      queued = null
      await sync(current)
      next = queued
    }
  }

  return (rotated) => {
    if (running) {
      queued = { rotated: rotated ?? queued?.rotated }
      return running
    }
    running = drain(rotated).finally(() => {
      running = null
    })
    return running
  }
}
