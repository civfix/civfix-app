"use client"

import * as React from "react"
import type { EventPageBlock } from "@civfix/shared"

type FaqBlockData = Extract<EventPageBlock, { kind: "faq" }>

export function FaqBlock({ block }: { block: FaqBlockData }) {
  if (block.items.length === 0) return null
  return (
    <section className="signup-block">
      <h2>{block.title ?? "Questions"}</h2>
      <dl className="signup-faq">
        {block.items.map((item, index) => (
          <div key={`${item.question}-${index}`}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
