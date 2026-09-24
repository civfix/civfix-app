"use client"

import * as React from "react"
import { HandHeart } from "lucide-react"
import { useT } from "@civfix/ui/i18n"
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
  const { t } = useT("web-signup")
  const supplied = block.url ?? page.donationUrl ?? null
  const href = supplied !== null && isSafeMarkdownHref(supplied) ? supplied : null
  if (href === null) return null

  return (
    <section className="signup-block signup-donate">
      <h2>{block.title ?? t("blocks.donate")}</h2>
      {block.blurb ? <p>{block.blurb}</p> : null}
      <a
        className="signup-donate-cta"
        href={href}
        rel="noreferrer noopener nofollow"
        target="_blank"
      >
        <HandHeart aria-hidden="true" size={18} /> {t("blocks.donate_cta")}
      </a>
      <p className="signup-hint">{t("blocks.donate_hint")}</p>
    </section>
  )
}
