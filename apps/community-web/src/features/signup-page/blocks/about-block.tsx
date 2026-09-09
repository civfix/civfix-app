"use client"

import * as React from "react"
import type { EventPageBlock } from "@civfix/shared"

import { Markdown } from "../markdown-dom"

type AboutBlockData = Extract<EventPageBlock, { kind: "about" }>

export function AboutBlock({ block }: { block: AboutBlockData }) {
  return (
    <section className="signup-block">
      <h2>{block.title ?? "About this event"}</h2>
      <Markdown source={block.body} />
    </section>
  )
}
