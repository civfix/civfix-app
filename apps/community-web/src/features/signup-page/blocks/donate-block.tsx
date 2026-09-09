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
  const internal = page.donateSlug
    ? `/donate/${encodeURIComponent(page.donateSlug)}/?event=${encodeURIComponent(page.event.id)}`
    : null
  const supplied = block.url ?? page.donationUrl ?? null
  const href = internal ?? (supplied !== null && isSafeMarkdownHref(supplied) ? supplied : null)
  if (href === null) return null

  const external = internal === null

  return (
    <section className="signup-block signup-donate">
      <h2>{block.title ?? "Support this work"}</h2>
      {block.blurb ? <p>{block.blurb}</p> : null}
      <a
        className="signup-donate-cta"
        href={href}
        {...(external ? { rel: "noreferrer noopener nofollow", target: "_blank" } : {})}
      >
        <HandHeart aria-hidden="true" size={18} /> Donate
      </a>
      {page.donateSlug ? (
        <p className="signup-hint">
          Donations go to {page.organization?.name ?? "the host organization"}, which is the merchant
          of record. civfix charges a disclosed platform fee and never holds the funds.
        </p>
      ) : null}
    </section>
  )
}
