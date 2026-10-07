"use client"

// Mounts the real shell over a fake backend, signed in by default. The production CORS allowlist excludes
// localhost, so a locally run web app can never sign in, and this is the only place the populated
// landscape shell can be seen.
//
// The capability seam is fake too, so camera capture and geolocation are inert here; verify those on the
// real routes. The QueryClient is fresh rather than the app's, whose persisted cache would blend real rows
// into the fake ones and write fakes back out to storage.
//
// Params come from window.location because useSearchParams would force a Suspense boundary under
// output: "export": `?signedout=1` renders the signed-out experience and `?path=/cleanups` seeds the nav
// store from any product path. The address bar is never synced, so a reload returns to the harness.

import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  ApiProvider,
  makeFakeChatSocket,
  makeFakeDataContext,
  type DataContextValue,
} from "@civfix/ui/data"
import { CapabilitiesProvider, makeFakeCapabilities } from "@civfix/ui/capabilities"
import { entryFromPath, useNavStore } from "@civfix/ui/nav"

import { AppShellFrame } from "@/components/home/home-shell"
import { liveMode } from "@/components/home/live-layout-mode"
import { GALLERY_VIEWER } from "@/components/dev/fixtures"
import { landscapeFakeApi } from "@/components/dev/landscape-fake-api"
import { makeQueryClient } from "@/lib/query"

function searchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

const fakeCapabilities = makeFakeCapabilities()

/**
 * The shared default `requireAuth` runs the action, which would let the signed-out arm like and RSVP.
 * Signed out it is a no-op instead: the real auth modal drives an auth store this harness does not own.
 */
function makeFakeData(signedOut: boolean): DataContextValue {
  return makeFakeDataContext({
    api: landscapeFakeApi,
    chatSocket: makeFakeChatSocket(),
    auth: signedOut
      ? { isAuthenticated: false, user: null, isPending: false }
      : { isAuthenticated: true, user: GALLERY_VIEWER, isPending: false },
    ...(signedOut ? { requireAuth: () => {} } : {}),
  })
}

export default function LandscapePreview() {
  const [client] = React.useState(() => makeQueryClient())
  const [signedOut] = React.useState(() => searchParams().get("signedout") === "1")
  const [data] = React.useState(() => makeFakeData(signedOut))

  // A layout effect seeds before first paint, so a deep-linked harness never flashes the home card.
  React.useLayoutEffect(() => {
    useNavStore.getState().seed(entryFromPath(searchParams().get("path")), liveMode())
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={data}>
        <CapabilitiesProvider value={fakeCapabilities}>
          {/* display: contents adds an anchor for the verification scripts without adding a box to the
              layout being measured. */}
          <div data-civfix-fake-shell={signedOut ? "signed-out" : "signed-in"} style={{ display: "contents" }}>
            <AppShellFrame />
          </div>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}
