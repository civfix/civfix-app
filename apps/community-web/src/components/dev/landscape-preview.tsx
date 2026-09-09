"use client"

// THE /landscape VERIFICATION ROUTE (landscape redesign, spec D18 / WS7).
//
// Mounts the REAL <AppShell/> - the same composition the product routes render, map and map controls
// included - over the fake backend in ./landscape-fake-api, signed in by default. It exists because the
// landscape shell cannot be judged empty: the redesign is about how the card holds a FULL feed beside a
// live map, and the production CORS allowlist excludes localhost, so a locally-run web app can never sign
// in to fill it. This route is the only surface where the populated landscape shell can be seen at all.
//
// WHAT IS REAL AND WHAT IS FAKE:
//   - REAL: <AppShell/> (via AppShellFrame - the exact slot wiring home-shell.tsx uses), the shared bodies,
//     the nav store, the sidebar/width store, the map (CARTO raster basemap over the network).
//   - FAKE: the data seam (<ApiProvider> = makeFakeDataContext over the canned client + makeFakeChatSocket)
//     and the platform seam (<CapabilitiesProvider> = makeFakeCapabilities). NOTE the capability swap is a
//     real difference from the product: camera capture and geolocation are inert here, so the report
//     wizard's photo step and the map's Locate do nothing. Verify those on the real routes.
//   - FRESH QueryClient: NOT the app's. The root <Providers/> client restores the PERSISTED cache from a
//     previous real session, which would blend real rows into the fake ones and, worse, write fakes back
//     out to storage. A client created here starts cold and is thrown away with the route.
//
// URL PARAMS (read from window.location, not next/navigation: this app is output:"export" and
// useSearchParams would force a Suspense boundary into a client-only dev route for no gain):
//   ?signedout=1     - render the signed-out experience (no viewer, and gated actions do nothing).
//   ?path=/cleanups  - seed the nav store from a product path, so every deep link (/map, /search, /report,
//                      /messages, /pin/post_text, ...) is reachable here without leaving /landscape.
//
// The address bar is deliberately NOT synced: `useWebNavAdapter` is not mounted (see AppShellFrame), so
// in-app navigation never pushes a product path over this one. Reload always comes back to the harness.

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
import { layoutModeFor } from "@civfix/ui"

import { AppShellFrame } from "@/components/home/home-shell"
import { landscapeFakeApi, FAKE_VIEWER } from "@/components/dev/landscape-fake-api"
import { makeQueryClient } from "@/lib/query"

/** The live layout mode, by the shared `layoutModeFor` rule (landscape AND wide enough). */
function liveMode(): "compact" | "expanded" {
  if (typeof window === "undefined") return "expanded"
  return layoutModeFor(window.innerWidth, window.innerHeight)
}

function searchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

const fakeCapabilities = makeFakeCapabilities()

/**
 * The fake data seam for one mount. Signed in unless `?signedout=1`.
 *
 * `requireAuth` differs per arm on purpose: the shared default RUNS the action (a gallery treats the
 * viewer as able to act), which would let the signed-out arm like and RSVP - the opposite of the state it
 * is there to show. Signed out it is a no-op, which is the honest local stand-in for the product's
 * "open the auth modal" (the real modal drives the real auth store, which this harness does not own).
 */
function makeFakeData(signedOut: boolean): DataContextValue {
  return makeFakeDataContext({
    api: landscapeFakeApi,
    chatSocket: makeFakeChatSocket(),
    auth: signedOut
      ? { isAuthenticated: false, user: null, isPending: false }
      : { isAuthenticated: true, user: FAKE_VIEWER, isPending: false },
    ...(signedOut ? { requireAuth: () => {} } : {}),
  })
}

export default function LandscapePreview() {
  const [client] = React.useState(() => makeQueryClient())
  const [signedOut] = React.useState(() => searchParams().get("signedout") === "1")
  const [data] = React.useState(() => makeFakeData(signedOut))

  // Seed the nav store from `?path=` before first paint (layout effect, as the product adapter does), so a
  // deep-linked harness never flashes the home card for a frame. Mount-only: this route owns no URL sync,
  // so nothing re-seeds afterwards.
  React.useLayoutEffect(() => {
    useNavStore.getState().seed(entryFromPath(searchParams().get("path")), liveMode())
  }, [])

  return (
    <QueryClientProvider client={client}>
      <ApiProvider value={data}>
        <CapabilitiesProvider value={fakeCapabilities}>
          {/* display:contents so the marker adds an anchor for the verification scripts without adding a
              box to the layout the shell is being measured in. */}
          <div data-civfix-fake-shell={signedOut ? "signed-out" : "signed-in"} style={{ display: "contents" }}>
            <AppShellFrame />
          </div>
        </CapabilitiesProvider>
      </ApiProvider>
    </QueryClientProvider>
  )
}
