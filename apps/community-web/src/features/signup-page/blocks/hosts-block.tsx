"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock } from "@civfix/shared"

type HostsBlockData = Extract<EventPageBlock, { kind: "hosts" }>

export function HostsBlock({ block }: { block: HostsBlockData }) {
  const { t } = useT("web-signup")
  if (block.entries.length === 0) return null
  return (
    <section className="signup-block">
      <h2>{block.title ?? t("blocks.hosts")}</h2>
      <ul className="signup-hosts">
        {block.entries.map((entry, index) => (
          <li key={`${entry.name}-${index}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" width={44} height={44} /> : null}
            <span>
              <strong>{entry.name}</strong>
              {entry.role ? <em>{entry.role}</em> : null}
              {entry.bio ? <span className="signup-host-bio">{entry.bio}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
