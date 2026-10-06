"use client"

import * as React from "react"
import Link from "next/link"
import { useT } from "@civfix/ui/i18n"
import { useReducedMotion } from "@civfix/ui/theme"

import { Wordmark } from "@/components/brand"

import { pickNotFoundVariant, type NotFoundVariant } from "./not-found-variant"
import { PotholeStage } from "./stage-pothole"
import { SignStage } from "./stage-sign"
import { TilesStage } from "./stage-tiles"

const STAGES: Record<NotFoundVariant, React.ComponentType<{ live: boolean }>> = {
  tiles: TilesStage,
  pothole: PotholeStage,
  sign: SignStage,
}

export function NotFoundView() {
  const { t } = useT("not-found")
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

  return (
    <main className="nf-page">
      <header className="nf-top">
        <Link href="/" aria-label={t("home_label")}>
          <Wordmark />
        </Link>
      </header>
      <div className={variant ? "nf-body is-picked" : "nf-body"} data-variant={variant ?? undefined}>
        <div className="nf-stage" aria-hidden="true">
          {Stage ? <Stage live={reduced === false} /> : null}
        </div>
        <div className="nf-copy">
          <p className="nf-eyebrow">{t("eyebrow")}</p>
          <div className="nf-message">
            {variant ? (
              <>
                <h1>{t(`variants.${variant}.headline`)}</h1>
                <p className="nf-sub">{t(`variants.${variant}.supporting`)}</p>
              </>
            ) : null}
          </div>
          <Link className="btn primary lg nf-cta" href="/map/">
            {t("cta")}
          </Link>
        </div>
      </div>
    </main>
  )
}
