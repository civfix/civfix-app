import { create } from "zustand"
import type { UserDTO } from "@civfix/shared"
import { api } from "@/api/client"
import { readToken, setToken, clearToken } from "@/auth/storage"
import { isForeignIdentity } from "@/lib/authLifecycle"
import { isUnauthorized } from "@/lib/errors"
import { chatSocket } from "@/lib/ws"
import { storage } from "@/lib/mmkv"
import { clearSecureBlobs } from "@/lib/nativeSecureStore"
import { CACHED_USER_KEY, LAST_IDENTITY_KEY } from "@/lib/mmkv-keys"
import { forgetPushRegistration, signOutUnregisteringPush } from "@/lib/pushRegistration"
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

type SetAuthState = (next: { status: AuthStatus; user: UserDTO | null }) => void

type SetGuestCapabilities = (next: { guestSmsEnabled: boolean | undefined }) => void

function refreshGuestCapabilities(set: SetGuestCapabilities): void {
  void api
    .session()
    .then((session) => set({ guestSmsEnabled: session.guestSmsEnabled }))
    .catch(() => undefined)
}

function tearDownIdentity(set: SetAuthState): void {
  clearPersistedCache()
  chatSocket.disconnect()
  cacheUser(null)
  forgetPushRegistration(storage)
  queryClient.clear()
  set({ status: "unauthed", user: null })
  resumeCachePersistence()
  identityTornDown = true
}

function dropForeignIdentityState(): void {
  purgeQueryCache(queryClient)
  void clearSecureBlobs()
}

function adoptIdentity(user: UserDTO, set: SetAuthState): void {
  cacheUser(user)
  rememberIdentity(user.id)
  set({ status: "authed", user })
  identityTornDown = false
}

interface AuthState {
  status: AuthStatus
  user: UserDTO | null
  guestSmsEnabled: boolean | undefined
  hydrate: (mode?: HydrateMode) => Promise<void>
  retryHydration: () => Promise<void>
  signIn: (token: string, user: UserDTO) => Promise<void>
  setUser: (user: UserDTO) => void
  signOut: () => Promise<void>
  markUnauthed: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  guestSmsEnabled: undefined,

  hydrate: async (mode = "boot") => {
    const read = await readToken()

    if (!read.ok) {
      set({ status: "unauthed", user: null })
      refreshGuestCapabilities(set)
      return
    }

    if (read.token === null) {
      tearDownIdentity(set)
      refreshGuestCapabilities(set)
      return
    }

    const cached = readCachedUser()
    if (cached) set({ status: "authed", user: cached })
    else if (mode === "boot") set({ status: "loading" })

    try {
      const session = await api.session()
      set({ guestSmsEnabled: session.guestSmsEnabled })
      if (session.authenticated && session.user) {
        const previousIdentity = readLastIdentity() ?? cached?.id ?? null
        if (isForeignIdentity(previousIdentity, session.user.id)) dropForeignIdentityState()
        adoptIdentity(session.user, set)
        return
      }
      tearDownIdentity(set)
      await clearToken()
    } catch (err) {
      if (isUnauthorized(err)) {
        tearDownIdentity(set)
        await clearToken()
        return
      }
      if (cached) return
      set({ status: "unauthed", user: null })
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
      store: storage,
      readBearer: async () => {
        const read = await readToken()
        return read.ok ? read.token : null
      },
      completeSignOut: async () => {
        tearDownIdentity(set)
        rememberIdentity(null)
        await clearSecureBlobs()
        await clearToken()
      },
      unregister: (registration, bearer, signal) =>
        api.pushUnregister(registration, {
          headers: { Authorization: `Bearer ${bearer}` },
          signal,
        }),
    })
  },

  markUnauthed: () => {
    if (identityTornDown) return
    tearDownIdentity(set)
  },
}))
