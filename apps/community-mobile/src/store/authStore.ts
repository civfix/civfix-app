import { create } from "zustand"
import type { UserDTO } from "@civfix/shared"
import { api } from "@/api/client"
import {
  SESSION_RESTORE_DEADLINE_MS,
  isRequestDeadlineError,
  withRequestDeadline,
} from "@/api/deadline"
import type { BootNetworkOutcome } from "@/boot/bootGateModel"
import { readToken, setToken, clearToken } from "@/auth/storage"
import { isForeignIdentity } from "@/lib/authLifecycle"
import { isAppError, isUnauthorized } from "@/lib/errors"
import { chatSocket } from "@/lib/ws"
import { storage } from "@/lib/mmkv"
import { clearSecureBlobs } from "@/lib/nativeSecureStore"
import { CACHED_USER_KEY, LAST_IDENTITY_KEY } from "@/lib/mmkv-keys"
import {
  signOutUnregisteringPush,
  unregisterLapsedSessionPush,
  type PushUnregisterDeps,
} from "@/lib/pushRegistration"
import { revokeServerSession, type SessionRevokeDeps } from "@/lib/sessionRevoke"
import { queryClient } from "@/query/client"
import {
  clearPersistedCache,
  purgeQueryCache,
  resumeCachePersistence,
} from "@/query/mmkv-persister"

export type AuthStatus = "idle" | "loading" | "authed" | "unauthed"

export type HydrateMode = "boot" | "foreground"

function cacheUser(user: UserDTO | null): void {
  try {
    if (user) storage.set(CACHED_USER_KEY, JSON.stringify(user))
    else storage.delete(CACHED_USER_KEY)
  } catch {
    return
  }
}

function readCachedUser(): UserDTO | null {
  try {
    const raw = storage.getString(CACHED_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserDTO
  } catch {
    return null
  }
}

function readLastIdentity(): string | null {
  try {
    return storage.getString(LAST_IDENTITY_KEY) ?? null
  } catch {
    return null
  }
}

function rememberIdentity(id: string | null): void {
  try {
    if (id) storage.set(LAST_IDENTITY_KEY, id)
    else storage.delete(LAST_IDENTITY_KEY)
  } catch {
    return
  }
}

let identityTornDown = false
let foregroundHydrationInFlight = false
let sessionRetryInFlight = false

type SetAuthState = (next: {
  status?: AuthStatus
  user?: UserDTO | null
  guestSmsEnabled?: boolean | undefined
  sessionPresent?: boolean | null
  networkOutcome?: BootNetworkOutcome
  restoreStartedAt?: number
}) => void

function restoreSession(): Promise<Awaited<ReturnType<typeof api.session>>> {
  return withRequestDeadline(SESSION_RESTORE_DEADLINE_MS, (signal) => api.session({ signal }))
}

function reachabilityOutcome(err: unknown): BootNetworkOutcome {
  if (isRequestDeadlineError(err)) return "timeout"
  if (isAppError(err)) return "ok"
  return "error"
}

function refreshGuestCapabilities(set: SetAuthState): void {
  void restoreSession()
    .then((session) => set({ guestSmsEnabled: session.guestSmsEnabled, networkOutcome: "ok" }))
    .catch((err) => set({ networkOutcome: reachabilityOutcome(err) }))
}

function pushUnregisterDeps(): PushUnregisterDeps {
  return {
    store: storage,
    readBearer: async () => {
      const read = await readToken()
      return read.ok ? read.token : null
    },
    unregister: (registration, bearer, signal) =>
      api.pushUnregister(registration, {
        headers: { Authorization: `Bearer ${bearer}` },
        signal,
      }),
  }
}

function sessionRevokeDeps(): SessionRevokeDeps {
  return {
    readBearer: async () => {
      const read = await readToken()
      return read.ok ? read.token : null
    },
    revoke: (bearer, signal) =>
      api.logout({
        headers: { Authorization: `Bearer ${bearer}` },
        signal,
      }),
  }
}

function tearDownIdentity(set: SetAuthState): Promise<void> {
  clearPersistedCache()
  chatSocket.disconnect()
  cacheUser(null)
  const pushReleased = unregisterLapsedSessionPush(pushUnregisterDeps())
  queryClient.clear()
  set({ status: "unauthed", user: null, sessionPresent: false })
  resumeCachePersistence()
  identityTornDown = true
  return pushReleased
}

function dropForeignIdentityState(): void {
  purgeQueryCache(queryClient)
  void clearSecureBlobs()
}

function adoptIdentity(user: UserDTO, set: SetAuthState): void {
  cacheUser(user)
  rememberIdentity(user.id)
  set({ status: "authed", user, sessionPresent: true })
  identityTornDown = false
}

interface AuthState {
  status: AuthStatus
  user: UserDTO | null
  guestSmsEnabled: boolean | undefined
  sessionPresent: boolean | null
  networkOutcome: BootNetworkOutcome
  restoreStartedAt: number
  hydrate: (mode?: HydrateMode) => Promise<void>
  retryHydration: () => Promise<void>
  retrySessionRestore: () => Promise<void>
  signIn: (token: string, user: UserDTO) => Promise<void>
  setUser: (user: UserDTO) => void
  signOut: () => Promise<void>
  markUnauthed: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  guestSmsEnabled: undefined,
  sessionPresent: null,
  networkOutcome: "pending",
  restoreStartedAt: Date.now(),

  hydrate: async (mode = "boot") => {
    if (mode === "boot") set({ restoreStartedAt: Date.now(), networkOutcome: "pending" })
    const read = await readToken()

    if (!read.ok) {
      set({ status: "unauthed", user: null, sessionPresent: false })
      refreshGuestCapabilities(set)
      return
    }

    if (read.token === null) {
      void tearDownIdentity(set)
      refreshGuestCapabilities(set)
      return
    }

    const cached = readCachedUser()
    set({ sessionPresent: true })
    if (cached) set({ status: "authed", user: cached })
    else if (mode === "boot") set({ status: "loading" })

    try {
      const session = await restoreSession()
      set({ guestSmsEnabled: session.guestSmsEnabled, networkOutcome: "ok" })
      if (session.authenticated && session.user) {
        const previousIdentity = readLastIdentity() ?? cached?.id ?? null
        if (isForeignIdentity(previousIdentity, session.user.id)) dropForeignIdentityState()
        adoptIdentity(session.user, set)
        return
      }
      await tearDownIdentity(set)
      await clearToken()
    } catch (err) {
      if (isUnauthorized(err)) {
        set({ networkOutcome: "ok" })
        await tearDownIdentity(set)
        await clearToken()
        return
      }
      set({ networkOutcome: reachabilityOutcome(err) })
      if (cached) return
      set({ status: "unauthed", user: null })
    }
  },

  retrySessionRestore: async () => {
    if (sessionRetryInFlight) return
    sessionRetryInFlight = true
    try {
      await get().hydrate("boot")
    } finally {
      sessionRetryInFlight = false
    }
  },

  retryHydration: async () => {
    if (get().status !== "unauthed") return
    if (identityTornDown) return
    if (foregroundHydrationInFlight) return
    foregroundHydrationInFlight = true
    try {
      const read = await readToken()
      if (read.ok && read.token === null) return
      await get().hydrate("foreground")
    } finally {
      foregroundHydrationInFlight = false
    }
  },

  signIn: async (token, user) => {
    const previousIdentity = readLastIdentity() ?? readCachedUser()?.id ?? null
    if (isForeignIdentity(previousIdentity, user.id)) dropForeignIdentityState()
    await setToken(token)
    adoptIdentity(user, set)
  },

  setUser: (user) => {
    cacheUser(user)
    set({ user })
  },

  signOut: async () => {
    await signOutUnregisteringPush({
      ...pushUnregisterDeps(),
      completeSignOut: async () => {
        await revokeServerSession(sessionRevokeDeps())
        await tearDownIdentity(set)
        rememberIdentity(null)
        await clearSecureBlobs()
        await clearToken()
      },
    })
  },

  markUnauthed: () => {
    if (identityTornDown) return
    void tearDownIdentity(set)
  },
}))
