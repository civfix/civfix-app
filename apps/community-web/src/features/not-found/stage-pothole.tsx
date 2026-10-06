"use client"

import * as React from "react"

import { useMotionLoop } from "./use-motion-loop"

const GRAVITY = 3000

/**
 * Each piece is laid out at rest by CSS; the loop only animates an offset and a
 * tilt relative to that rest, so the still (reduced-motion) frame and the end
 * of the fall are the same picture.
 */
type Piece = {
  delay: number
  dy: number
  vy: number
  angle: number
  spin: number
  restAngle: number
  bounce: number
  squash: number
}

const PIECES = {
  firstFour: { delay: 0, angle: -14, spin: 40, restAngle: 0, bounce: 0.38 },
  zero: { delay: 0.45, angle: 20, spin: -30, restAngle: -9, bounce: 0.12 },
  lastFour: { delay: 0.2, angle: 10, spin: -50, restAngle: 0, bounce: 0.38 },
} as const

type PieceName = keyof typeof PIECES
const ORDER = Object.keys(PIECES) as PieceName[]

export function PotholeStage({ live }: { live: boolean }) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const refs = React.useRef<Partial<Record<PieceName, HTMLElement | null>>>({})

  useMotionLoop(live, () => {
    const stage = stageRef.current
    if (!stage) return null
    const drop = stage.clientHeight + 40
    const pieces = ORDER.map((name) => ({
      name,
      piece: { ...PIECES[name], dy: -drop, vy: 0, squash: 0 } satisfies Piece,
    }))
    let elapsed = 0
    return (dt) => {
      elapsed += dt
      let moving = false
      for (const { name, piece } of pieces) {
        if (elapsed >= piece.delay) fall(piece, dt)
        if (!atRest(piece)) moving = true
        const el = refs.current[name]
        if (el) {
          const stretch = 1 - piece.squash
          el.style.transform = `translateY(${piece.dy}px) rotate(${piece.angle}deg) scale(${2 - stretch}, ${stretch})`
        }
      }
      if (!moving) {
        // Hand the final pose back to the CSS rest layout: nothing moves after the fall.
        for (const name of ORDER) refs.current[name]?.style.removeProperty("transform")
      }
      return moving
    }
  })

  const bind = (name: PieceName) => (el: HTMLElement | null) => {
    refs.current[name] = el
  }

  return (
    <div ref={stageRef} className={live ? "nf-scene nf-street is-live" : "nf-scene nf-street"}>
      <div className="nf-road">
        <div className="nf-lane" />
      </div>
      <div className="nf-row">
        <span ref={bind("firstFour")} className="nf-digit nf-glyph">
          4
        </span>
        <span className="nf-hole-slot">
          <span className="nf-pothole" />
          <span className="nf-hole-clip">
            <span ref={bind("zero")} className="nf-digit nf-glyph nf-glyph--zero">
              0
            </span>
          </span>
        </span>
        <span ref={bind("lastFour")} className="nf-digit nf-glyph">
          4
        </span>
      </div>
    </div>
  )
}

function atRest(piece: Piece) {
  return (
    piece.dy === 0 &&
    piece.vy === 0 &&
    Math.abs(piece.angle - piece.restAngle) < 0.05 &&
    Math.abs(piece.spin) < 0.5 &&
    piece.squash < 0.002
  )
}

function fall(piece: Piece, dt: number) {
  piece.vy += GRAVITY * dt
  piece.dy += piece.vy * dt
  piece.angle += piece.spin * dt
  if (piece.dy >= 0) {
    piece.dy = 0
    if (piece.vy > 160) {
      piece.squash = Math.min(0.22, piece.vy / 9000)
      piece.vy = -piece.vy * piece.bounce
      piece.spin *= 0.4
    } else {
      piece.vy = 0
    }
  }
  if (piece.dy >= -2) {
    piece.spin += ((piece.restAngle - piece.angle) * 160 - piece.spin * 12) * dt
  }
  piece.squash *= 1 - Math.min(1, dt * 14)
}
