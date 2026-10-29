"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/contract"
import { safeDateFormat } from "@civfix/contract/datetime"

type HeroBlockData = Extract<EventPageBlock, { kind: "hero" }>

const WHEN_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
}

/**
 * The start in the event's own zone. An event without a usable one (a row from before events had a
 * zone) is shown in the visitor's zone, which the label still names. "" for an unreadable instant.
 */
export function formatEventWhen(startsAt: string, timezone: string | null | undefined, locale: string): string {
  return safeDateFormat(startsAt, locale, WHEN_OPTIONS, timezone)
}

export function HeroBlock({ block, page }: { block: HeroBlockData; page: PublicEventPageDTO }) {
  const { i18n } = useT("web-signup")
  const image = block.imageUrl ?? page.coverUrl
  const when = formatEventWhen(page.event.startsAt, page.event.timezone, i18n.language)

  return (
    <header className="signup-hero">
      {image ? <img className="signup-hero-cover" src={image} alt="" /> : null}
      <div className="signup-hero-body">
        {page.organization ? (
          <p className="signup-hero-org">
            {page.organization.logoUrl ? (
              <img src={page.organization.logoUrl} alt="" width={24} height={24} />
            ) : null}
            {page.organization.name}
          </p>
        ) : null}
        <h1>{block.headline ?? page.event.title}</h1>
        {when === "" ? null : <p className="signup-hero-when">{when}</p>}
        {block.subhead ? <p className="signup-hero-subhead">{block.subhead}</p> : null}
      </div>
    </header>
  )
}
