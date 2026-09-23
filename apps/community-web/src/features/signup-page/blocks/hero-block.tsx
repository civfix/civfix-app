"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"

type HeroBlockData = Extract<EventPageBlock, { kind: "hero" }>

const WHEN_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
}

export function formatEventWhen(
  startsAt: string,
  timezone: string | null,
  locale: string,
): string | null {
  const at = new Date(startsAt)
  if (Number.isNaN(at.getTime())) return null
  if (timezone !== null) {
    try {
      return new Intl.DateTimeFormat(locale, { ...WHEN_OPTIONS, timeZone: timezone }).format(at)
    } catch {
      // An unknown IANA zone from the host: fall back to the viewer's zone, which is still labelled.
    }
  }
  return new Intl.DateTimeFormat(locale, WHEN_OPTIONS).format(at)
}

export function HeroBlock({ block, page }: { block: HeroBlockData; page: PublicEventPageDTO }) {
  const { i18n } = useT("web-signup")
  const image = block.imageUrl ?? page.coverUrl
  const when = formatEventWhen(page.event.startsAt, page.event.timezone ?? null, i18n.language)

  return (
    <header className="signup-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img className="signup-hero-cover" src={image} alt="" /> : null}
      <div className="signup-hero-body">
        {page.organization ? (
          <p className="signup-hero-org">
            {page.organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.organization.logoUrl} alt="" width={24} height={24} />
            ) : null}
            {page.organization.name}
          </p>
        ) : null}
        <h1>{block.headline ?? page.event.title}</h1>
        {when === null ? null : <p className="signup-hero-when">{when}</p>}
        {block.subhead ? <p className="signup-hero-subhead">{block.subhead}</p> : null}
      </div>
    </header>
  )
}
