"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarPlus, CircleAlert, Loader2 } from "lucide-react"
import { ErrorCode, type PublicEventPageDTO } from "@civfix/shared"
import { buildIcs, eventIcsUid } from "@civfix/shared/ics"

import { api, toAppError } from "@/lib/api"
import { downloadBlob } from "@/lib/download-blob"
import { accentVars } from "./page-theme"
import { BlockRouter } from "./block-router"
import { RegistrationWidget } from "./registration-widget"
import { accessCodeFromSearch, signupSlugFromPath } from "./signup-slug"

type ViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "not_found" }
  | { readonly kind: "offline" }
  | { readonly kind: "ready"; readonly page: PublicEventPageDTO }

export function SignupView() {
  const [state, setState] = React.useState<ViewState>({ kind: "loading" })
  const [accessCode, setAccessCode] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [slug, setSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    const source = signupSlugFromPath(window.location.pathname)
    setAccessCode(accessCodeFromSearch(window.location.search))
    if (source.kind !== "slug") {
      setState({ kind: "not_found" })
      return
    }
    setSlug(source.slug)
  }, [])

  React.useEffect(() => {
    if (slug === null) return
    let cancelled = false
    setState({ kind: "loading" })
    api
      .getPublicEventPage({ slug })
      .then((page) => {
        if (!cancelled) setState({ kind: "ready", page })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState(toAppError(error).code === ErrorCode.NOT_FOUND ? { kind: "not_found" } : { kind: "offline" })
      })
    return () => {
      cancelled = true
    }
  }, [slug, reloadKey])

  const viewedSlug = state.kind === "ready" ? state.page.slug : null

  React.useEffect(() => {
    if (viewedSlug === null) return
    void api
      .recordEventPageView({ slug: viewedSlug, source: pageViewSource(document.referrer) })
      .catch(() => undefined)
  }, [viewedSlug])

  if (state.kind === "loading") {
    return (
      <SignupState busy title="Loading">
        Fetching this event&rsquo;s page.
      </SignupState>
    )
  }

  if (state.kind === "not_found") {
    return (
      <SignupState title="We couldn't find that page">
        This signup link is not valid, or the page has been taken down. Find the event on{" "}
        <Link href="/">civfix</Link>.
      </SignupState>
    )
  }

  if (state.kind === "offline") {
    return (
      <SignupState
        title="We couldn't load this page"
        action={{ label: "Try again", onClick: () => setReloadKey((key) => key + 1) }}
      >
        Check your connection and try again.
      </SignupState>
    )
  }

  return <SignupDocument page={state.page} initialAccessCode={accessCode} />
}

function SignupDocument({
  page,
  initialAccessCode,
}: {
  page: PublicEventPageDTO
  initialAccessCode: string | null
}) {
  const style = React.useMemo(
    () => accentVars(page.theme.accent) as React.CSSProperties,
    [page.theme.accent],
  )
  const hasHero = page.blocks.some((block) => block.kind === "hero")
  const hasRegistration = page.blocks.some((block) => block.kind === "registration")
  const ordered = page.blocks

  return (
    <main className="signup-page" style={style}>
      <div className="signup-shell">
        {hasHero ? null : <FallbackHero page={page} />}

        {ordered.map((block) => (
          <BlockRouter
            key={block.id}
            block={block}
            page={page}
            initialAccessCode={initialAccessCode}
          />
        ))}

        {hasRegistration ? null : (
          <div className="signup-block" id="register">
            <RegistrationWidget page={page} initialAccessCode={initialAccessCode} />
          </div>
        )}

        <CalendarButton page={page} />

        <footer className="signup-foot">
          Hosted on <Link href="/">civfix</Link> · <a href="/legal/terms">Terms</a> ·{" "}
          <a href="/legal/privacy">Privacy</a>
        </footer>
      </div>
    </main>
  )
}

function FallbackHero({ page }: { page: PublicEventPageDTO }) {
  return (
    <header className="signup-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {page.coverUrl ? <img className="signup-hero-cover" src={page.coverUrl} alt="" /> : null}
      <div className="signup-hero-body">
        {page.organization ? <p className="signup-hero-org">{page.organization.name}</p> : null}
        <h1>{page.event.title}</h1>
      </div>
    </header>
  )
}

function CalendarButton({ page }: { page: PublicEventPageDTO }) {
  const download = React.useCallback(() => {
    const ics = buildIcs({
      uid: eventIcsUid(page.event.id),
      title: page.event.title,
      ...(page.event.description ? { description: page.event.description } : {}),
      startsAt: page.event.startsAt,
      ...(page.event.endsAt ? { endsAt: page.event.endsAt } : {}),
      ...(page.event.timezone ? { timezone: page.event.timezone } : {}),
      ...(page.event.address ? { location: page.event.address } : {}),
      url: `${window.location.origin}/e/${encodeURIComponent(page.slug)}/`,
      status: page.event.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    })
    downloadBlob(`${page.slug}.ics`, new Blob([ics], { type: "text/calendar;charset=utf-8" }))
  }, [page])

  return (
    <button type="button" className="signup-secondary" onClick={download}>
      <CalendarPlus aria-hidden="true" size={16} /> Add to calendar
    </button>
  )
}

interface SignupStateProps {
  title: string
  busy?: boolean
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}

function SignupState({ title, busy, action, children }: SignupStateProps) {
  return (
    <main className="signup-page" aria-busy={busy ? true : undefined}>
      <div className="signup-shell signup-state">
        {busy ? (
          <Loader2 aria-hidden="true" className="signup-spin" size={32} />
        ) : (
          <CircleAlert aria-hidden="true" size={32} />
        )}
        <h1>{title}</h1>
        <p>{children}</p>
        {action ? (
          <button type="button" className="signup-secondary" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </main>
  )
}

export function pageViewSource(
  referrer: string | null | undefined,
): "direct" | "search" | "social" | "referral" {
  if (!referrer) return "direct"
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return "direct"
  }
  if (typeof window !== "undefined" && host === window.location.hostname) return "direct"
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\./.test(host)) return "search"
  if (
    /(^|\.)(facebook|instagram|x|twitter|t|linkedin|reddit|nextdoor|threads|bsky|tiktok|whatsapp)\./.test(
      host,
    )
  ) {
    return "social"
  }
  return "referral"
}
