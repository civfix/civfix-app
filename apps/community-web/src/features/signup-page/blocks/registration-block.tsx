"use client"

import * as React from "react"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"

import { RegistrationWidget } from "../registration-widget"

type RegistrationBlockData = Extract<EventPageBlock, { kind: "registration" }>

export function RegistrationBlock({
  block,
  page,
  initialAccessCode,
}: {
  block: RegistrationBlockData
  page: PublicEventPageDTO
  initialAccessCode: string | null
}) {
  return (
    <div className="signup-block" id="register">
      {block.title ? <h2 className="signup-block-title">{block.title}</h2> : null}
      {block.note ? <p>{block.note}</p> : null}
      <RegistrationWidget page={page} initialAccessCode={initialAccessCode} />
    </div>
  )
}
