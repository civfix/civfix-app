/**
 * React context that carries the host-injected DataContextValue to shared feature bodies.
 * A host (mobile app, web app, or a test/gallery harness with fakes) wraps its tree in
 * <ApiProvider value={...}> once - INSIDE its query-client provider so the shared mutation hooks reach
 * the same QueryClient - and shared components read it via the typed hooks below.
 *
 * Mirrors ./capabilities/context.tsx: a nullable context with a throw-if-missing accessor, plus typed
 * selector hooks so a body imports exactly the slice it needs (the api client, the auth state, the
 * requireAuth gate, or logout) rather than the whole bundle.
 */
import React, { createContext, useContext } from "react"
import type { ApiClient } from "@civfix/shared/client"
import type { AuthState, ChatSocketLike, DataContextValue } from "./types"

const DataContext = createContext<DataContextValue | null>(null)
DataContext.displayName = "DataContext"

export interface ApiProviderProps {
  /** The data bundle for this host (its api client, auth-state hook, requireAuth, logout). */
  value: DataContextValue
  children: React.ReactNode
}

export function ApiProvider({ value, children }: ApiProviderProps) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/**
 * Access the full data bundle. Throws a clear error if no provider is mounted, so a missing root
 * wrapper fails loudly instead of silently handing back undefined. Internal; prefer the typed
 * selectors below from feature code.
 */
function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext)
  if (ctx === null) {
    throw new Error(
      "useApi/useAuthState/useRequireAuth/useLogout: no ApiProvider found. Wrap your app root in " +
        "<ApiProvider value={...}> (use makeFakeDataContext() in tests).",
    )
  }
  return ctx
}

/** The host's API client singleton. Throws if no ApiProvider is mounted. */
export function useApi(): ApiClient {
  return useDataContext().api
}

/**
 * The current normalized auth state. Delegates to the host-provided `useAuthState` HOOK so the host's
 * store subscription (zustand selector) drives re-renders on sign-in/out - this is why the context
 * carries a hook rather than a value.
 */
export function useAuthState(): AuthState {
  return useDataContext().useAuthState()
}

/**
 * The auth gate: run an action if signed in, otherwise prompt to authenticate (route to /auth on
 * mobile / open the auth modal on web). Returns the host's requireAuth as-is.
 */
export function useRequireAuth(): DataContextValue["requireAuth"] {
  return useDataContext().requireAuth
}

/** Sign the viewer out (host owns any cache teardown). */
export function useLogout(): DataContextValue["logout"] {
  return useDataContext().logout
}

/**
 * The host's OPTIONAL session-user setter (or `undefined` when the host does not inject one). The shared
 * `useUpdateProfile` calls it with the freshly-returned `UserDTO` so the auth-store-backed surfaces (the
 * top-left account slot + the compact sheet header) refresh their avatar/handle/displayName in lockstep
 * with the `myProfile` query.
 */
export function useOnUserUpdated(): DataContextValue["onUserUpdated"] {
  return useDataContext().onUserUpdated
}

/**
 * The host's OPTIONAL report-create override (slice 7), or `undefined` when the host does not inject one.
 * The shared report wizard uses it to delegate the IDENTITY-specific create (web's anon/Turnstile/claim
 * path) and falls back to its built-in authed `api.createReport` when this is absent (mobile).
 */
export function useSubmitReport(): DataContextValue["submitReport"] {
  return useDataContext().submitReport
}

/**
 * The host's OPTIONAL anti-bot token minter, or `undefined` when the host does not inject one.
 *
 * The shared guest-RSVP sheet needs a Turnstile token for the PUBLIC `guestRsvpRequest` endpoint, and
 * minting one is entirely platform-specific (web renders a Cloudflare widget; a native host has no
 * equivalent yet), so it is a host capability like `submitReport` rather than anything this package
 * imports. `action` is the Turnstile action the token is scoped to (see GUEST_RSVP_TURNSTILE_ACTION).
 * A surface that requires a token MUST degrade when this is absent - it never fabricates one.
 */
export function useGetTurnstileToken(): DataContextValue["getTurnstileToken"] {
  return useDataContext().getTurnstileToken
}

/**
 * The host's OPTIONAL publishable CARTO basemap api key (web/mobile read it from their build-time env),
 * or `undefined` when the host injects none. The shared map surfaces append it to the CARTO raster tile
 * URLs; absent, they request the same keyless (CARTO-watermarked) tiles they always have, so the basemap
 * renders either way. It is a client-visible value by design - never a secret.
 */
export function useCartoApiKey(): DataContextValue["cartoApiKey"] {
  return useDataContext().cartoApiKey
}

/**
 * The host's live chat socket (normalized to ChatSocketLike). The shared `useChat` consumes this to
 * retain/join the room, send frames, subscribe to inbound messages, and track the connection status,
 * without importing either app's socket module. Throws if no ApiProvider is mounted.
 */
export function useChatSocket(): ChatSocketLike {
  return useDataContext().chatSocket
}
