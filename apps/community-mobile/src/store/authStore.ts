import { create } from "zustand"
import { isAppErrorLike, type SessionCheckResponse, type UserDTO } from "@civfix/shared"
import { adoptViewer, discardViewerDrafts } from "@civfix/ui"
import { queryKeys } from "@civfix/ui/data"
import { api } from "@/api/client"
import type { AuthStatus } from "@/lib/lifecycleTypes"
import { SESSION_RESTORE_DEADLINE_MS, isRequestDeadlineError } from "@/api/deadline"
import { sessionCheck } from "@/api/sessionCheck"
import type { BootNetworkOutcome } from "@/boot/bootGateModel"
import { readToken, setToken, clearToken } from "@/auth/storage"
import { isForeignIdentity } from "@/lib/authLifecycle"
import { isUnauthorized } from "@/lib/errors"
import { chatSocket } from "@/lib/ws"
import { storage } from "@/lib/mmkv"
import { clearSecureBlobs } from "@/lib/nativeSecureStore"
import { CACHED_USER_KEY, LAST_IDENTITY_KEY } from "@/lib/mmkvKeys"
import {
  signOutUnregisteringPush,
  unregisterLapsedSessionPush,
  type PushUnregisterDeps,
} from "@/lib/pushRegistration"
import { queryClient } from "@/query/client"
import {
  clearPersistedCache,
  purgeQueryCache,
  resumeCachePersistence,
} from "@/query/mmkvPersister"

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

function restoreSession(): Promise<SessionCheckResponse> {
  return sessionCheck(SESSION_RESTORE_DEADLINE_MS)
}

function reachabilityOutcome(err: unknown): BootNetworkOutcome {
  if (isRequestDeadlineError(err)) return "timeout"
  if (isAppErrorLike(err)) return "ok"
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

function tearDownIdentity(set: SetAuthState): Promise<void> {
  clearPersistedCache()
  chatSocket.disconnect()
  cacheUser(null)
  const pushReleased = unregisterLapsedSessionPush(pushUnregisterDeps())
  queryClient.clear()
  discardViewerDrafts()
  set({ status: "unauthed", user: null, sessionPresent: false })
  resumeCachePersistence()
  identityTornDown = true
  return pushReleased
}

function dropForeignIdentityState(): void {
  purgeQueryCache(queryClient)
  void clearSecureBlobs()
}

// Caches a guest filled (feeds, post, report and event details, profiles) carry the guest's empty
// liked, saved, following and registration flags; a sign-in refetches them as the account.
const VIEWER_DEPENDENT_KEYS: readonly (readonly unknown[])[] = [
  queryKeys.myReportsRoot,
  queryKeys.threads,
  queryKeys.notificationsRoot,
  queryKeys.profileRoot,
  queryKeys.postsRoot,
  queryKeys.postRoot,
  queryKeys.reportRoot,
  queryKeys.cleanupRoot,
  queryKeys.chatRoot,
  ["volunteer"],
]

function invalidateViewerDependentQueries(): void {
  for (const queryKey of VIEWER_DEPENDENT_KEYS) void queryClient.invalidateQueries({ queryKey })
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
    invalidateViewerDependentQueries()
  },

  setUser: (user) => {
    cacheUser(user)
    set({ user })
  },

  signOut: async () => {
    await signOutUnregisteringPush({
      ...pushUnregisterDeps(),
      revokeSession: (bearer, signal) =>
        api.logout({
          headers: { Authorization: `Bearer ${bearer}` },
          signal,
        }),
      completeSignOut: async () => {
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

// Drafts (post, reply, report, event) belong to the account that wrote them: an account switch on a shared
// device must not hand them to the next account. Subscribing covers every path that moves `user`, the
// foreign-identity sign-in included (the registry wipes when a different account arrives); a confirmed
// teardown wipes them in tearDownIdentity, while a transient unauthed state (an unreadable Keychain)
// keeps them for the same account.
useAuthStore.subscribe((state) => adoptViewer(state.user?.id ?? null))
