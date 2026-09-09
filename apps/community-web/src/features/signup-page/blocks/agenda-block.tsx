"use client"

import * as React from "react"
import type { EventPageBlock } from "@civfix/shared"

type AgendaBlockData = Extract<EventPageBlock, { kind: "agenda" }>

export function AgendaBlock({ block }: { block: AgendaBlockData }) {
  if (block.items.length === 0) return null
  return (
    <section className="signup-block">
      <h2>{block.title ?? "Schedule"}</h2>
      <ol className="signup-agenda">
        {block.items.map((item, index) => (
          <li key={`${item.title}-${index}`}>
            {item.time ? <span className="signup-agenda-time">{item.time}</span> : null}
            <span>
              <strong>{item.title}</strong>
              {item.description ? <em>{item.description}</em> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
