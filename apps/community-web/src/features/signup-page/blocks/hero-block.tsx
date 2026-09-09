"use client"

import * as React from "react"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"

type HeroBlockData = Extract<EventPageBlock, { kind: "hero" }>

const WHEN = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
})

export function formatEventWhen(startsAt: string, timezone: string | null): string | null {
  const at = new Date(startsAt)
  if (Number.isNaN(at.getTime())) return null
  if (timezone === null) return WHEN.format(at)
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timezone,
    }).format(at)
  } catch {
    return WHEN.format(at)
  }
}

export function HeroBlock({ block, page }: { block: HeroBlockData; page: PublicEventPageDTO }) {
  const image = block.imageUrl ?? page.coverUrl
  const when = formatEventWhen(page.event.startsAt, page.event.timezone ?? null)

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
