"use client"

import * as React from "react"
import Link from "next/link"
import { useReducedMotion } from "@civfix/ui/theme"

import { Wordmark } from "@/components/brand"

import { NOT_FOUND_COPY, pickNotFoundVariant, type NotFoundVariant } from "./not-found-copy"
import { PotholeStage } from "./stage-pothole"
import { SignStage } from "./stage-sign"
import { TilesStage } from "./stage-tiles"

const STAGES: Record<NotFoundVariant, React.ComponentType<{ live: boolean }>> = {
  tiles: TilesStage,
  pothole: PotholeStage,
  sign: SignStage,
}

export function NotFoundView() {
  const reduced = useReducedMotion()
  const [picked, setPicked] = React.useState<NotFoundVariant | null>(null)

  // The export prerenders one HTML file, so the pick can only happen after
  // hydration; the body stays hidden until it lands and the motion preference
  // is known, so the stage mounts once, in the right mode.
  React.useEffect(() => {
    setPicked(pickNotFoundVariant())
  }, [])

  const variant = reduced === null ? null : picked
  const Stage = variant ? STAGES[variant] : null
  const copy = variant ? NOT_FOUND_COPY.variants[variant] : null

  return (
    <main className="nf-page">
      <header className="nf-top">
        <Link href="/" aria-label="civfix home">
          <Wordmark />
        </Link>
      </header>
      <div className={copy ? "nf-body is-picked" : "nf-body"} data-variant={variant ?? undefined}>
        <div className="nf-stage" aria-hidden="true">
          {Stage ? <Stage live={reduced === false} /> : null}
        </div>
        <div className="nf-copy">
          <p className="nf-eyebrow">{NOT_FOUND_COPY.eyebrow}</p>
          <div className="nf-message">
            {copy ? (
              <>
                <h1>{copy.headline}</h1>
                <p className="nf-sub">{copy.supporting}</p>
              </>
            ) : null}
          </div>
          <Link className="btn primary lg nf-cta" href="/map/">
            {NOT_FOUND_COPY.cta}
          </Link>
        </div>
      </div>
    </main>
  )
}
