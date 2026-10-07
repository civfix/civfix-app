"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"
import type { EventPageBlock, PublicEventPageDTO } from "@civfix/shared"

type LocationBlockData = Extract<EventPageBlock, { kind: "location" }>

export function LocationBlock({
  block,
  page,
}: {
  block: LocationBlockData
  page: PublicEventPageDTO
}) {
  const { t } = useT("web-signup")
  const address = page.event.address
  const hasPoint = typeof page.event.lat === "number" && typeof page.event.lng === "number"
  const mapsHref = hasPoint
    ? `https://www.google.com/maps/search/?api=1&query=${page.event.lat},${page.event.lng}`
    : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null

  return (
    <section className="signup-block">
      <h2>{block.title ?? t("blocks.location")}</h2>
      {address ? <p className="signup-address">{address}</p> : null}
      {block.note ? <p>{block.note}</p> : null}
      {block.showMap && mapsHref !== null ? (
        <p>
          <a href={mapsHref} rel="noreferrer noopener nofollow" target="_blank">
            {t("blocks.open_in_maps")}
          </a>
        </p>
      ) : null}
    </section>
  )
}
