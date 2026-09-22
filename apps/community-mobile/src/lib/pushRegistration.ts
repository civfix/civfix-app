import { PushPlatformSchema } from "@civfix/shared"
import type { PushPlatform } from "@civfix/shared"
import type { KeyValueStore } from "./mmkv"

export const PUSH_REGISTRATION_KEY = "civfix.push.registration"

export const PUSH_UNREGISTER_TIMEOUT_MS = 3000

export interface PersistedPushRegistration {
  platform: PushPlatform
  token: string
}

export type PushRegistrationStore = KeyValueStore

export interface PushUnregisterDeps {
  store: PushRegistrationStore
  readBearer: () => Promise<string | null>
  unregister: (
    registration: PersistedPushRegistration,
    bearer: string,
    signal: AbortSignal,
  ) => Promise<unknown>
}

export interface SignOutUnregisteringPushDeps extends PushUnregisterDeps {
  completeSignOut: () => Promise<void>
}

export function rememberPushRegistration(
  store: PushRegistrationStore,
  registration: PersistedPushRegistration,
): void {
  try {
    store.set(PUSH_REGISTRATION_KEY, JSON.stringify(registration))
  } catch {
    return
  }
}

export function readPushRegistration(
  store: PushRegistrationStore,
): PersistedPushRegistration | null {
  try {
    const raw = store.getString(PUSH_REGISTRATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { platform?: unknown; token?: unknown }
    const platform = PushPlatformSchema.safeParse(parsed.platform)
    if (!platform.success) return null
    if (typeof parsed.token !== "string" || parsed.token.length === 0) return null
    return { platform: platform.data, token: parsed.token }
  } catch {
    return null
  }
}

export function forgetPushRegistration(store: PushRegistrationStore): void {
  try {
    store.delete(PUSH_REGISTRATION_KEY)
  } catch {
    return
  }
}

function fireUnregister(
  deps: PushUnregisterDeps,
  registration: PersistedPushRegistration,
  bearer: string,
): void {
  const controller = new AbortController()
  const abort = setTimeout(() => controller.abort(), PUSH_UNREGISTER_TIMEOUT_MS)
  void (async () => {
    try {
      await deps.unregister(registration, bearer, controller.signal)
    } catch {
      return
    } finally {
      clearTimeout(abort)
    }
  })()
}

export async function signOutUnregisteringPush(
  deps: SignOutUnregisteringPushDeps,
): Promise<void> {
  const registration = readPushRegistration(deps.store)
  let bearer: string | null = null
  if (registration) {
    try {
      bearer = await deps.readBearer()
    } catch {
      bearer = null
    }
  }

  forgetPushRegistration(deps.store)
  await deps.completeSignOut()

  if (!registration || !bearer) return
  fireUnregister(deps, registration, bearer)
}

export function unregisterLapsedSessionPush(deps: PushUnregisterDeps): Promise<void> {
  const registration = readPushRegistration(deps.store)
  forgetPushRegistration(deps.store)
  if (!registration) return Promise.resolve()

  let bearer: Promise<string | null>
  try {
    bearer = Promise.resolve(deps.readBearer())
  } catch {
    return Promise.resolve()
  }

  return bearer
    .then((value) => {
      if (value) fireUnregister(deps, registration, value)
    })
    .catch(() => undefined)
}
