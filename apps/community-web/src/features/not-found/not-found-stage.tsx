"use client"

import * as React from "react"

import { useMotionLoop } from "./use-motion-loop"

const GRAVITY = 3000

/**
 * Each piece is laid out at rest by CSS; the loop only animates an offset and a
 * tilt relative to that rest, so the still (reduced-motion) frame and the end
 * of the animation are the same picture.
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
  pin: { delay: 1.35, angle: 0, spin: 0, restAngle: 0, bounce: 0.45 },
} as const

type PieceName = keyof typeof PIECES
const ORDER = Object.keys(PIECES) as PieceName[]

export function NotFoundStage() {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const refs = React.useRef<Partial<Record<PieceName, HTMLElement | null>>>({})
  const pieces = React.useRef<Record<PieceName, Piece> | null>(null)

  const live = useMotionLoop(() => {
    const stage = stageRef.current
    if (!stage) return null
    const drop = stage.clientHeight + 40
    pieces.current = Object.fromEntries(
      ORDER.map((name) => [
        name,
        { ...PIECES[name], dy: -drop, vy: 0, squash: 0 },
      ]),
    ) as Record<PieceName, Piece>
    let elapsed = 0
    return (dt) => {
      elapsed += dt
      for (const name of ORDER) {
        const piece = pieces.current![name]
        if (elapsed >= piece.delay) fall(piece, dt)
        const el = refs.current[name]
        if (el) {
          const stretch = 1 - piece.squash
          el.style.transform = `translateY(${piece.dy}px) rotate(${piece.angle}deg) scale(${2 - stretch}, ${stretch})`
        }
      }
    }
  })

  const kickZero = () => {
    const zero = pieces.current?.zero
    if (!live || !zero || zero.dy < -4) return
    // Popping out of the hole, then (inevitably) back in.
    zero.vy = -1150
    zero.spin = zero.angle > 0 ? -260 : 260
  }

  const bind = (name: PieceName) => (el: HTMLElement | null) => {
    refs.current[name] = el
  }

  return (
    <div ref={stageRef} className={live ? "nf-stage nf-street is-live" : "nf-stage nf-street"} aria-hidden="true">
      <div className="nf-road">
        <div className="nf-lane" />
      </div>
      <div className="nf-row">
        <span ref={bind("firstFour")} className="nf-digit nf-glyph">
          4
        </span>
        <span className="nf-hole-slot">
          <span className="nf-pothole" />
          <span className="nf-hole-clip" onPointerDown={kickZero}>
            <span ref={bind("zero")} className="nf-digit nf-glyph nf-glyph--zero">
              0
            </span>
          </span>
          <span ref={bind("pin")} className="nf-pin">
            <span className="nf-pin-head">
              <span className="nf-pin-dot" />
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
