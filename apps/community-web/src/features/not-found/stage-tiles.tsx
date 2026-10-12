"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"

import { useMotionLoop } from "./use-motion-loop"

const DIGITS = [
  { char: "4", tone: "bloom" },
  { char: "0", tone: "sky" },
  { char: "4", tone: "moss" },
] as const

const GRAVITY = 2600
const BOUNCE = 0.42
const TILE_BOUNCE = 0.3
const AIR_DRAG = 0.4
const FLOOR_FRICTION = 6
const MAX_FLING = 2800

type Body = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  grabbed: boolean
  grabDx: number
  grabDy: number
  lastPointerX: number
  lastPointerY: number
  lastPointerT: number
}

export function TilesStage({ live }: { live: boolean }) {
  const { t } = useT("not-found")
  const stageRef = React.useRef<HTMLDivElement>(null)
  const tileRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const bodies = React.useRef<Body[]>([])
  const size = React.useRef({ width: 0, height: 0, tile: 0 })

  useMotionLoop(live, () => {
    const stage = stageRef.current
    const firstTile = tileRefs.current[0]
    if (!stage || !firstTile) return null
    const measure = () => {
      size.current = { width: stage.clientWidth, height: stage.clientHeight, tile: firstTile.offsetWidth }
    }
    measure()
    const { width, tile } = size.current
    const gap = tile * 0.14
    const rowStart = width / 2 - tile * 1.5 - gap
    // Staggered heights and tilts so the tiles land one after another, not as a block.
    bodies.current = DIGITS.map((_, i) => ({
      x: rowStart + tile / 2 + i * (tile + gap),
      y: -tile * (0.8 + i * 0.9),
      vx: 0,
      vy: 0,
      angle: [-18, 12, -8][i] ?? 0,
      spin: [90, -140, 60][i] ?? 0,
      grabbed: false,
      grabDx: 0,
      grabDy: 0,
      lastPointerX: 0,
      lastPointerY: 0,
      lastPointerT: 0,
    }))
    return (dt) => {
      // Read before any write this frame, so following a resize costs no extra layout.
      measure()
      step(bodies.current, size.current, dt)
      bodies.current.forEach((b, i) => {
        const el = tileRefs.current[i]
        if (el) {
          el.style.transform = `translate(${b.x - size.current.tile / 2}px, ${b.y - size.current.tile / 2}px) rotate(${b.angle}deg)`
        }
      })
      // Keeps running: a tile can be thrown at any time.
      return true
    }
  })

  const pointFor = (event: React.PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  const onPointerDown = (i: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodies.current[i]
    if (!live || !body) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const p = pointFor(event)
    Object.assign(body, {
      grabbed: true,
      grabDx: body.x - p.x,
      grabDy: body.y - p.y,
      lastPointerX: p.x,
      lastPointerY: p.y,
      lastPointerT: event.timeStamp,
      vx: 0,
      vy: 0,
    })
  }

  const onPointerMove = (i: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    const body = bodies.current[i]
    if (!body?.grabbed) return
    const p = pointFor(event)
    const dt = Math.max((event.timeStamp - body.lastPointerT) / 1000, 1 / 240)
    body.vx = body.vx * 0.5 + ((p.x - body.lastPointerX) / dt) * 0.5
    body.vy = body.vy * 0.5 + ((p.y - body.lastPointerY) / dt) * 0.5
    body.x = p.x + body.grabDx
    body.y = p.y + body.grabDy
    body.lastPointerX = p.x
    body.lastPointerY = p.y
    body.lastPointerT = event.timeStamp
  }

  const onPointerUp = (i: number) => () => {
    const body = bodies.current[i]
    if (!body) return
    body.grabbed = false
    const speed = Math.hypot(body.vx, body.vy)
    if (speed > MAX_FLING) {
      body.vx *= MAX_FLING / speed
      body.vy *= MAX_FLING / speed
    }
    body.spin += body.vx * 0.15
  }

  return (
    <>
      <div ref={stageRef} className={live ? "nf-tiles is-live" : "nf-tiles"}>
        {DIGITS.map((digit, i) => (
          <div
            key={i}
            ref={(el) => {
              tileRefs.current[i] = el
            }}
            className={`nf-tile nf-digit nf-tile--${digit.tone}`}
            onPointerDown={onPointerDown(i)}
            onPointerMove={onPointerMove(i)}
            onPointerUp={onPointerUp(i)}
            onPointerCancel={onPointerUp(i)}
          >
            {digit.char}
          </div>
        ))}
      </div>
      <div className="nf-ground" />
      {live ? <p className="nf-hint">{t("tiles_hint")}</p> : null}
    </>
  )
}

export function step(bodies: Body[], box: { width: number; height: number; tile: number }, dt: number) {
  const half = box.tile / 2
  const floor = box.height - half
  for (const b of bodies) {
    if (b.grabbed) {
      b.angle += (b.vx * 0.012 - b.angle) * Math.min(1, dt * 10)
      continue
    }
    b.vy += GRAVITY * dt
    b.vx *= 1 - AIR_DRAG * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.angle += b.spin * dt

    const grounded = b.y >= floor - 0.5
    if (b.y > floor) {
      b.y = floor
      b.vy = Math.abs(b.vy) > 120 ? -b.vy * BOUNCE : 0
      b.spin = b.spin * 0.5 + b.vx * 0.2
    }
    if (b.x < half || b.x > box.width - half) {
      b.x = Math.min(Math.max(b.x, half), box.width - half)
      b.vx = -b.vx * BOUNCE
      b.spin -= b.vy * 0.1
    }
    if (b.y < half - box.tile * 4) b.vy = Math.max(b.vy, 0)
    if (grounded) {
      // Grounded tiles right themselves, so a thrown tile settles upright.
      const target = Math.round(b.angle / 360) * 360
      b.spin += ((target - b.angle) * 120 - b.spin * 14) * dt
      b.vx *= 1 - Math.min(1, FLOOR_FRICTION * dt)
    } else {
      b.spin *= 1 - 0.6 * dt
    }
  }

  const minDist = box.tile * 0.98
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!
      const b = bodies[j]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      if (dist >= minDist) continue
      // A narrowing stage clamps tiles onto the same wall spot, where the centre
      // line has no direction; split them sideways in reading order instead.
      const nx = dist > 0 ? dx / dist : 1
      const ny = dist > 0 ? dy / dist : 0
      const overlap = minDist - dist
      const aShare = a.grabbed ? 0 : b.grabbed ? 1 : 0.5
      const bShare = 1 - aShare
      a.x -= nx * overlap * aShare
      a.y -= ny * overlap * aShare
      b.x += nx * overlap * bShare
      b.y += ny * overlap * bShare
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (rel < 0) {
        const impulse = -(1 + TILE_BOUNCE) * rel
        if (!a.grabbed) {
          a.vx -= nx * impulse * aShare
          a.vy -= ny * impulse * aShare
          a.spin -= impulse * 0.08
        }
        if (!b.grabbed) {
          b.vx += nx * impulse * bShare
          b.vy += ny * impulse * bShare
          b.spin += impulse * 0.08
        }
      }
    }
  }
  for (const b of bodies) {
    if (!b.grabbed && b.y > floor) b.y = floor
  }
}
