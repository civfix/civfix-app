"use client"

import * as React from "react"
import type { EventPageBlock } from "@civfix/shared"

type ContactBlockData = Extract<EventPageBlock, { kind: "contact" }>

const EMAIL_SHAPE = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

export function contactMailtoAddress(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const address = value.trim()
  if (address.length === 0 || address.length > 254) return null
  return EMAIL_SHAPE.test(address) ? address : null
}

export function ContactBlock({ block }: { block: ContactBlockData }) {
  const email = contactMailtoAddress(block.replyTo)
  return (
    <section className="signup-block">
      <h2>{block.title ?? "Get in touch"}</h2>
      {block.body ? <p>{block.body}</p> : null}
      {email ? (
        <p>
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      ) : null}
    </section>
  )
}
