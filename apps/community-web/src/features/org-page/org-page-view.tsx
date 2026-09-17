"use client"

import * as React from "react"
import Link from "next/link"
import { BadgeCheck, CircleAlert, Globe, HeartHandshake, Loader2 } from "lucide-react"
import { ErrorCode, SOCIAL_PLATFORM_LABELS, socialLinkUrl } from "@civfix/shared"
import type { OrganizationDTO, SocialPlatform } from "@civfix/shared"
import { useOrganization } from "@civfix/ui/data"
import { Trans, useT } from "@civfix/ui/i18n"
import {
  SOCIAL_GLYPH_PATHS,
  SOCIAL_GLYPH_VIEWBOX,
  presentSocialPlatforms,
} from "@civfix/ui/social"

import { toAppError } from "@/lib/api"
import { renderMarkdownNodes } from "@/features/signup-page/markdown-dom"
import { parseMarkdownSubset } from "@civfix/shared/markdown"

import { orgSlugFromPath } from "./org-page-slug"

const KIND_LABEL: Record<NonNullable<OrganizationDTO["verifiedKind"]>, string> = {
  nonprofit: "Verified nonprofit",
  government: "Verified government",
  community: "Verified community group",
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/** The public page's copy lives in the `host-org` namespace next to its stats (`stats.*`). */
function kindLabel(t: Translate, kind: NonNullable<OrganizationDTO["verifiedKind"]>): string {
  return t(`public.kind_${kind}`, { defaultValue: KIND_LABEL[kind] })
}

function SocialGlyph({ platform }: { platform: SocialPlatform }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={20}
      height={20}
      viewBox={`0 0 ${SOCIAL_GLYPH_VIEWBOX} ${SOCIAL_GLYPH_VIEWBOX}`}
    >
      <path d={SOCIAL_GLYPH_PATHS[platform]} fill="currentColor" />
    </svg>
  )
}

function httpsHref(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("https://")) return null
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

function websiteLabel(href: string): string {
  try {
    const parsed = new URL(href)
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`
  } catch {
    return href
  }
}

function LoadingPage() {
  const { t } = useT("host-org")
  return (
    <OrgPageState busy title={t("public.loading_title", { defaultValue: "Loading" })}>
      {t("public.loading_body", { defaultValue: "Fetching this organization." })}
    </OrgPageState>
  )
}

export function OrgPageView() {
  const { t } = useT("host-org")
  const [source, setSource] = React.useState<ReturnType<typeof orgSlugFromPath> | null>(null)

  React.useEffect(() => {
    setSource(orgSlugFromPath(window.location.pathname))
  }, [])

  if (source === null) return <LoadingPage />
  if (source.kind !== "slug") {
    return (
      <OrgPageState
        title={t("public.not_found_title", { defaultValue: "We couldn't find that organization" })}
      >
        <Trans
          t={t}
          i18nKey="public.invalid_link_body"
          defaults="This link is not valid. Check the link you followed, or find organizations on <0>civfix</0>."
          components={[<Link key="home" href="/" />]}
        />
      </OrgPageState>
    )
  }
  return <OrgDocument slug={source.slug} />
}

function OrgDocument({ slug }: { slug: string }) {
  const query = useOrganization(slug)
  const { t } = useT("host-org")

  if (query.isPending) return <LoadingPage />

  if (query.isError || !query.data) {
    const code = query.isError ? toAppError(query.error).code : ErrorCode.NOT_FOUND
    if (code === ErrorCode.NOT_FOUND) {
      return (
        <OrgPageState
          title={t("public.not_found_title", { defaultValue: "We couldn't find that organization" })}
        >
          <Trans
            t={t}
            i18nKey="public.not_found_body"
            defaults="It may have been renamed or removed. Find organizations on <0>civfix</0>."
            components={[<Link key="home" href="/" />]}
          />
        </OrgPageState>
      )
    }
    return (
      <OrgPageState
        title={t("public.error_title", { defaultValue: "We couldn't load this page" })}
        action={{
          label: t("public.retry", { defaultValue: "Try again" }),
          onClick: () => void query.refetch(),
        }}
      >
        {t("public.error_body", { defaultValue: "Check your connection and try again." })}
      </OrgPageState>
    )
  }

  const org = query.data
  const verified = org.verifiedStatus === "verified"
  const website = httpsHref(org.websiteUrl)
  const socials = presentSocialPlatforms(org.socialLinks)
  const donate = httpsHref(org.donationUrl)
  const description = org.description ? parseMarkdownSubset(org.description) : []

  return (
    <main className="orgpage">
      <div className="orgpage-shell">
        <header className="orgpage-header">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="orgpage-logo" src={org.logoUrl} alt="" width={88} height={88} />
          ) : (
            <span className="orgpage-logo orgpage-logo-fallback" aria-hidden="true">
              {org.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="orgpage-identity">
            <h1>
              {org.name}
              {verified ? (
                <BadgeCheck
                  role="img"
                  aria-label={
                    org.verifiedKind
                      ? kindLabel(t, org.verifiedKind)
                      : t("public.verified", { defaultValue: "Verified" })
                  }
                  className="orgpage-verified"
                  size={22}
                />
              ) : null}
            </h1>
            <p className="orgpage-handle">{t("header.slug", { slug: org.slug })}</p>
            <ul
              className="orgpage-stats"
              aria-label={t("public.at_a_glance", { defaultValue: "At a glance" })}
            >
              {verified && org.verifiedKind ? (
                <li className="orgpage-stat orgpage-stat-verified">
                  {kindLabel(t, org.verifiedKind)}
                </li>
              ) : null}
              {typeof org.eventCount === "number" ? (
                <li className="orgpage-stat">{t("stats.events", { count: org.eventCount })}</li>
              ) : null}
              {typeof org.memberCount === "number" ? (
                <li className="orgpage-stat">{t("stats.members", { count: org.memberCount })}</li>
              ) : null}
            </ul>
          </div>
        </header>

        {donate ? (
          <a
            className="orgpage-donate"
            href={donate}
            target="_blank"
            rel="noopener noreferrer"
          >
            <HeartHandshake aria-hidden="true" size={18} />
            {t("public.donate", { name: org.name, defaultValue: `Donate to ${org.name}` })}
          </a>
        ) : null}

        {description.length > 0 ? (
          <section
            className="orgpage-section"
            aria-label={t("public.about", { defaultValue: "About" })}
          >
            <div className="orgpage-prose">{renderMarkdownNodes(description)}</div>
          </section>
        ) : null}

        {website || socials.length > 0 ? (
          <section
            className="orgpage-section"
            aria-label={t("public.links", { defaultValue: "Links" })}
          >
            {website ? (
              <ul className="orgpage-links">
                <li>
                  <a href={website} target="_blank" rel="noopener noreferrer" className="orgpage-link">
                    <Globe aria-hidden="true" size={16} />
                    {websiteLabel(website)}
                  </a>
                </li>
              </ul>
            ) : null}
            {socials.length > 0 ? (
              <ul className="orgpage-socials">
                {socials.map((entry) => (
                  <li key={entry.platform}>
                    <a
                      href={socialLinkUrl(entry.platform, entry.value)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="orgpage-social"
                      aria-label={t("profile-view:social.link_a11y", {
                        platform: SOCIAL_PLATFORM_LABELS[entry.platform],
                      })}
                    >
                      <SocialGlyph platform={entry.platform} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <footer className="orgpage-foot">
          <p>
            <Trans
              t={t}
              i18nKey="public.footer_hosts"
              values={{ name: org.name }}
              defaults="{{name}} hosts volunteer events on <0>civfix</0>."
              components={[<Link key="home" href="/" />]}
            />
          </p>
          <p>
            <Trans
              t={t}
              i18nKey="public.footer_console"
              defaults="Run an organization? <0>Open the host console</0>."
              components={[<Link key="console" href="/manage/" />]}
            />
          </p>
        </footer>
      </div>
    </main>
  )
}

interface OrgPageStateProps {
  title: string
  busy?: boolean
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}

function OrgPageState({ title, busy, action, children }: OrgPageStateProps) {
  return (
    <main className="orgpage" aria-busy={busy ? true : undefined}>
      <div className="orgpage-shell orgpage-state">
        {busy ? (
          <Loader2 aria-hidden="true" className="orgpage-spin" size={32} />
        ) : (
          <CircleAlert aria-hidden="true" size={32} />
        )}
        <h1>{title}</h1>
        <p>{children}</p>
        {action ? (
          <button type="button" className="orgpage-button" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </main>
  )
}
