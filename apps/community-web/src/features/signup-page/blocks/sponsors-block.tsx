"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock } from "@civfix/shared"
import { isSafeMarkdownHref } from "@civfix/shared/markdown"

type SponsorsBlockData = Extract<EventPageBlock, { kind: "sponsors" }>

export function SponsorsBlock({ block }: { block: SponsorsBlockData }) {
  const { t } = useT("web-signup")
  if (block.entries.length === 0) return null
  return (
    <section className="signup-block">
      <h2>{block.title ?? t("blocks.sponsors")}</h2>
      <ul className="signup-sponsors">
        {block.entries.map((entry, index) => {
          const label = entry.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.logoUrl} alt={entry.name} />
          ) : (
            <span>{entry.name}</span>
          )
          const href = entry.url !== null && entry.url !== undefined && isSafeMarkdownHref(entry.url)
            ? entry.url
            : null
          return (
            <li key={`${entry.name}-${index}`}>
              {href === null ? (
                label
              ) : (
                <a href={href} rel="noreferrer noopener nofollow" target="_blank">
                  {label}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
