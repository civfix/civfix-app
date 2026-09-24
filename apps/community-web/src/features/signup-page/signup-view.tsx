"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarPlus } from "lucide-react"
import { ErrorCode, type PublicEventPageDTO, toAppError } from "@civfix/shared"
import { buildIcs, eventIcsUid } from "@civfix/shared/ics"
import { Trans, useT } from "@civfix/ui/i18n"

import { PublicPageState, type PublicPageStateClasses } from "@/components/public-page-state"
import { api } from "@/lib/api"
import { downloadBlob } from "@/lib/download-blob"
import { accentVars } from "./page-theme"
import { BlockRouter } from "./block-router"
import { RegistrationWidget } from "./registration-widget"
import { accessCodeFromSearch, signupSlugFromPath } from "./signup-slug"

const SIGNUP_STATE_CLASSES: PublicPageStateClasses = {
  page: "signup-page",
  shell: "signup-shell signup-state",
  spin: "signup-spin",
  action: "signup-secondary",
}

type ViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "not_found" }
  | { readonly kind: "offline" }
  | { readonly kind: "ready"; readonly page: PublicEventPageDTO }

export function SignupView() {
  const { t } = useT("web-signup")
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
    // Best-effort analytics for the host: a lost page-view count must never disturb the visitor.
    void api
      .recordEventPageView({ slug: viewedSlug, source: pageViewSource(document.referrer) })
      .catch(() => undefined)
  }, [viewedSlug])

  if (state.kind === "loading") {
    return (
      <PublicPageState classes={SIGNUP_STATE_CLASSES} busy title={t("state.loading_title")}>
        {t("state.loading_body")}
      </PublicPageState>
    )
  }

  if (state.kind === "not_found") {
    return (
      <PublicPageState classes={SIGNUP_STATE_CLASSES} title={t("state.not_found_title")}>
        <Trans t={t} i18nKey="state.not_found_body" components={[<Link key="home" href="/" />]} />
      </PublicPageState>
    )
  }

  if (state.kind === "offline") {
    return (
      <PublicPageState
        classes={SIGNUP_STATE_CLASSES}
        title={t("state.offline_title")}
        action={{ label: t("state.retry"), onClick: () => setReloadKey((key) => key + 1) }}
      >
        {t("state.offline_body")}
      </PublicPageState>
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
  const { t } = useT("web-signup")
  const style = React.useMemo(
    () => accentVars(page.theme.accent) as React.CSSProperties,
    [page.theme.accent],
  )
  const hasHero = page.blocks.some((block) => block.kind === "hero")
  const hasRegistration = page.blocks.some((block) => block.kind === "registration")

  return (
    <main className="signup-page" style={style}>
      <div className="signup-shell">
        {hasHero ? null : <FallbackHero page={page} />}

        {page.blocks.map((block) => (
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
          <Trans
            t={t}
            i18nKey="footer"
            components={[
              <Link key="home" href="/" />,
              <a key="terms" href="/legal/terms" />,
              <a key="privacy" href="/legal/privacy" />,
            ]}
          />
        </footer>
      </div>
    </main>
  )
}

function FallbackHero({ page }: { page: PublicEventPageDTO }) {
  return (
    <header className="signup-hero">
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image optimization is unavailable under output: "export" */}
      {page.coverUrl ? <img className="signup-hero-cover" src={page.coverUrl} alt="" /> : null}
      <div className="signup-hero-body">
        {page.organization ? <p className="signup-hero-org">{page.organization.name}</p> : null}
        <h1>{page.event.title}</h1>
      </div>
    </header>
  )
}

function CalendarButton({ page }: { page: PublicEventPageDTO }) {
  const { t } = useT("web-signup")
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
      <CalendarPlus aria-hidden="true" size={16} /> {t("calendar")}
    </button>
  )
}

function pageViewSource(
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
