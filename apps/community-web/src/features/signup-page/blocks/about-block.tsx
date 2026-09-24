"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock } from "@civfix/shared"

import { Markdown } from "../markdown-dom"

type AboutBlockData = Extract<EventPageBlock, { kind: "about" }>

export function AboutBlock({ block }: { block: AboutBlockData }) {
  const { t } = useT("web-signup")
  return (
    <section className="signup-block">
      <h2>{block.title ?? t("blocks.about")}</h2>
      <Markdown source={block.body} />
    </section>
  )
}
