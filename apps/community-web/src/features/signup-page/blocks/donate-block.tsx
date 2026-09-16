"use client"

import * as React from "react"
import { HandHeart } from "lucide-react"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"
import { isSafeMarkdownHref } from "@civfix/shared/markdown"

type DonateBlockData = Extract<EventPageBlock, { kind: "donate" }>

export function DonateBlock({
  block,
  page,
}: {
  block: DonateBlockData
  page: PublicEventPageDTO
}) {
  const supplied = block.url ?? page.donationUrl ?? null
  const href = supplied !== null && isSafeMarkdownHref(supplied) ? supplied : null
  if (href === null) return null

  return (
    <section className="signup-block signup-donate">
      <h2>{block.title ?? "Support this work"}</h2>
      {block.blurb ? <p>{block.blurb}</p> : null}
      <a
        className="signup-donate-cta"
        href={href}
        rel="noreferrer noopener nofollow"
        target="_blank"
      >
        <HandHeart aria-hidden="true" size={18} /> Donate
      </a>
      <p className="signup-hint">
        This link goes to a site civfix does not run. civfix never handles the money.
      </p>
    </section>
  )
}
