"use client"

import * as React from "react"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"

import { AboutBlock } from "./blocks/about-block"
import { AgendaBlock } from "./blocks/agenda-block"
import { ContactBlock } from "./blocks/contact-block"
import { DonateBlock } from "./blocks/donate-block"
import { FaqBlock } from "./blocks/faq-block"
import { HeroBlock } from "./blocks/hero-block"
import { HostsBlock } from "./blocks/hosts-block"
import { LocationBlock } from "./blocks/location-block"
import { RegistrationBlock } from "./blocks/registration-block"
import { SponsorsBlock } from "./blocks/sponsors-block"

interface BlockRouterProps {
  block: EventPageBlock
  page: PublicEventPageDTO
  initialAccessCode: string | null
}

export function BlockRouter({ block, page, initialAccessCode }: BlockRouterProps) {
  switch (block.kind) {
    case "hero":
      return <HeroBlock block={block} page={page} />
    case "about":
      return <AboutBlock block={block} />
    case "agenda":
      return <AgendaBlock block={block} />
    case "hosts":
      return <HostsBlock block={block} />
    case "faq":
      return <FaqBlock block={block} />
    case "location":
      return <LocationBlock block={block} page={page} />
    case "sponsors":
      return <SponsorsBlock block={block} />
    case "donate":
      return <DonateBlock block={block} page={page} />
    case "registration":
      return (
        <RegistrationBlock block={block} page={page} initialAccessCode={initialAccessCode} />
      )
    case "contact":
      return <ContactBlock block={block} />
  }
}
