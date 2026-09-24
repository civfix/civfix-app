"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"
import { formatEventInstant } from "@civfix/shared/datetime"

type HeroBlockData = Extract<EventPageBlock, { kind: "hero" }>

export function HeroBlock({ block, page }: { block: HeroBlockData; page: PublicEventPageDTO }) {
  const { i18n } = useT("web-signup")
  const image = block.imageUrl ?? page.coverUrl
  const when = formatEventInstant(page.event.startsAt, page.event.timezone, "long", i18n.language)

  return (
    <header className="signup-hero">
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image optimization is unavailable under output: "export" */}
      {image ? <img className="signup-hero-cover" src={image} alt="" /> : null}
      <div className="signup-hero-body">
        {page.organization ? (
          <p className="signup-hero-org">
            {page.organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- next/image optimization is unavailable under output: "export"
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
