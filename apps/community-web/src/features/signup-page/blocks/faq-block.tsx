"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock } from "@civfix/contract"

import { keyedByValue } from "@/lib/list-keys"

type FaqBlockData = Extract<EventPageBlock, { kind: "faq" }>

export function FaqBlock({ block }: { block: FaqBlockData }) {
  const { t } = useT("web-signup")
  if (block.items.length === 0) return null
  return (
    <section className="signup-block">
      <h2>{block.title ?? t("blocks.faq")}</h2>
      <dl className="signup-faq">
        {keyedByValue(block.items, (item) => item.question).map(({ entry: item, key }) => (
          <div key={key}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
