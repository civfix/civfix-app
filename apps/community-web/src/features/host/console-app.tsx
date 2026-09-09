"use client"

import { Suspense, lazy, useEffect, useState } from "react"
import { useAuthState } from "@civfix/ui/data"
import { useT } from "@civfix/ui/i18n"

import { AuthModal } from "@/components/auth/auth-modal"
import { ConsoleToastProvider } from "@/components/console/overlay/toast"
import { hrefForRoute, parseConsoleRoute } from "@/components/console/route"
import type { ConsoleRoute } from "@/components/console/route"
import { LoadingState, NoAccessState } from "@/components/console/states"
import { useUiStore } from "@/store/ui-store"

import { ConsoleBootSkeleton } from "./console-boot"
import { ConsoleNavigationProvider, useConsoleNavigation } from "./console-context"
import { ConsoleErrorBoundary } from "./console-error-boundary"
import {
  readStashedInviteToken,
  stashInviteToken,
  stripInviteTokenFromUrl,
} from "./org/org-invites"

const PortfolioScreen = lazy(() =>
  import("./portfolio/portfolio-screen").then((m) => ({ default: m.PortfolioScreen })),
)
const OrgScreen = lazy(() => import("./org/org-screen").then((m) => ({ default: m.OrgScreen })))
const CreateOrgScreen = lazy(() =>
  import("./org/create-org-screen").then((m) => ({ default: m.CreateOrgScreen })),
)
const AcceptInviteScreen = lazy(() =>
  import("./org/accept-invite-screen").then((m) => ({ default: m.AcceptInviteScreen })),
)
const EventRouter = lazy(() =>
  import("./event/event-router").then((m) => ({ default: m.EventRouter })),
)

/** Where the OAuth providers are asked to land while an invite is waiting: the accept page itself. */
const INVITE_ACCEPT_RETURN_PATH = hrefForRoute({ kind: "org-invite-accept", token: null })

/**
 * The signed-out console. An org invite link is the one console URL a signed-out person is expected
 * to open, so it gets its own copy and an in-place sign-in (the auth modal keeps the URL, so the
 * token is still in the query when auth flips and the router mounts); the token is also stashed for
 * the OAuth providers, which leave the page - they are asked to return to the accept path, and the
 * console honors the stash on boot wherever they actually land.
 */
function ConsoleSignedOut() {
  const { t } = useT("host-common")
  const { t: to } = useT("host-org")
  const openAuthModal = useUiStore((s) => s.openAuthModal)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  useEffect(() => {
    const route = parseConsoleRoute(
      window.location.pathname,
      `${window.location.search}${window.location.hash}`,
    )
    if (route.kind !== "org-invite-accept" || route.token === null) return
    stashInviteToken(route.token)
    setInviteToken(route.token)
  }, [])

  const goHome = () => {
    window.location.assign("/")
  }

  if (inviteToken !== null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-token-3 bg-console-canvas p-token-5">
        <NoAccessState
          title={to("accept.signed_out_title", { defaultValue: "Sign in to accept your invitation" })}
          body={to("accept.signed_out_body", {
            defaultValue:
              "Use the email address the invitation was sent to. You'll come straight back here once you're signed in.",
          })}
          exitLabel={to("accept.sign_in", { defaultValue: "Sign in" })}
          onExit={openAuthModal}
        />
        <button
          type="button"
          onClick={goHome}
          className="text-token-13 font-semibold text-console-ink-3 underline-offset-2 hover:text-console-ink hover:underline focus-visible:outline-none focus-visible:shadow-console-ring"
        >
          {t("auth.go_home")}
        </button>
        <AuthModal oauthReturnPath={INVITE_ACCEPT_RETURN_PATH} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-console-canvas p-token-5">
      <NoAccessState
        title={t("auth.signed_out_title")}
        body={t("auth.signed_out_body")}
        exitLabel={t("auth.go_home")}
        onExit={goHome}
      />
    </div>
  )
}

/**
 * A stashed invite token is honored wherever sign-in landed: the OAuth providers are asked to return
 * to the accept page, but a provider, a stale allowlist or a person typing `/manage/` can land the
 * signed-in session anywhere in the console. Decided once, at boot, so a later in-console navigation
 * away from the accept page (Not now, Back) is never overruled. While the redirect is pending the
 * router renders nothing rather than mounting the landing screen for a frame.
 */
function useStashedInviteRedirect(route: ConsoleRoute, go: (route: ConsoleRoute) => void): boolean {
  const [pending] = useState(
    () => route.kind !== "org-invite-accept" && readStashedInviteToken() !== null,
  )
  useEffect(() => {
    if (pending) go({ kind: "org-invite-accept", token: null })
  }, [pending, go])
  return pending && route.kind !== "org-invite-accept"
}

/**
 * The identity of the accept page while the invite token leaves the URL. The URL is the token's
 * way in, not its home: as soon as the router has read it, it is stripped from the address bar
 * (so the route re-parses to `token: null`) and the mounted page keeps working on the token it
 * was given at mount. The page is keyed by the LAST token seen, which survives the strip - keying
 * on the URL would remount (and lose) the page the moment the token left the address bar - while a
 * second, different link still remounts it. Derived during render, not in an effect: leaving for a
 * lazy screen suspends the boundary and defers effects, and Back can arrive before they run.
 */
function useInviteAcceptKey(urlToken: string | null): string {
  const [last, setLast] = useState<string | null>(urlToken)
  // Store-from-render (the React docs' "information from previous renders" pattern): the key is
  // right in the same render the new link arrives in, with no effect round trip.
  if (urlToken !== null && urlToken !== last) setLast(urlToken)
  useEffect(() => {
    if (urlToken !== null) stripInviteTokenFromUrl()
  }, [urlToken])
  return urlToken ?? last ?? ""
}

function InviteAcceptRoute({ token }: { token: string | null }) {
  const key = useInviteAcceptKey(token)
  // The page takes the token at mount and holds it itself; leaving the route unmounts the page,
  // so Back finds a fresh instance with no URL token, which falls back to the stash - and a success
  // or a dead token has already cleared that. The token is never spent twice.
  return <AcceptInviteScreen key={key} token={token} />
}

function ConsoleRouter() {
  const { route, go } = useConsoleNavigation()
  const redirecting = useStashedInviteRedirect(route, go)
  if (redirecting) return null
  switch (route.kind) {
    case "org":
      return <OrgScreen orgId={route.orgId} section={route.section} />
    case "org-new":
      return <CreateOrgScreen />
    case "org-invite-accept":
      return <InviteAcceptRoute token={route.token} />

    case "event":
    case "broadcasts":
    case "broadcast-new":
    case "broadcast":
      return <EventRouter route={route} />
    case "portfolio":
    case "not-found":
      return <PortfolioScreen notFoundPath={route.kind === "not-found" ? route.path : null} />
  }
}

export function ConsoleApp() {
  const { t } = useT("host-common")
  const { isAuthenticated, isPending } = useAuthState()

  if (isPending) return <ConsoleBootSkeleton />
  if (!isAuthenticated) return <ConsoleSignedOut />

  return (
    <ConsoleErrorBoundary
      title={t("crash.title")}
      body={t("crash.body")}
      retryLabel={t("crash.retry")}
    >
      <ConsoleToastProvider>
        <ConsoleNavigationProvider>
          <Suspense
            fallback={
              <div className="p-token-6">
                <LoadingState count={6} />
                <span className="sr-only">{t("state.loading")}</span>
              </div>
            }
          >
            <ConsoleRouter />
          </Suspense>
        </ConsoleNavigationProvider>
      </ConsoleToastProvider>
    </ConsoleErrorBoundary>
  )
}
