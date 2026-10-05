"use client"

import * as React from "react"

import { useMotionLoop } from "./use-motion-loop"

const GRAVITY = 2400
const DAMPING = 0.9
const SNAP_AT = 0.7
const BOLT_INSET = 22
const BAR_TOP = 14
const CHAIN = 38
/** How far the broken chain lets the sign drop: crooked, but still readable. */
const SAG = (-22 * Math.PI) / 180
const MAX_LIFT = (35 * Math.PI) / 180

type Sign = {
  angle: number
  spin: number
  snapped: boolean
  grabbed: boolean
  grabOffset: number
  lastAngle: number
  lastT: number
}

export function NotFoundStage() {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const signRef = React.useRef<HTMLDivElement>(null)
  const chainRef = React.useRef<HTMLDivElement>(null)
  const sign = React.useRef<Sign | null>(null)
  const pivot = React.useRef({ x: 0, y: 0 })

  const live = useMotionLoop(() => {
    const stage = stageRef.current
    const el = signRef.current
    if (!stage || !el) return null
    const w = el.offsetWidth
    const h = el.offsetHeight
    const reach = w - 2 * BOLT_INSET
    // Treat the sign as a rigid plate swinging on its right bolt.
    const comX = -(w / 2 - BOLT_INSET)
    const comY = h / 2
    const inertia = (w * w + h * h) / 12 + comX * comX + comY * comY
    const place = () => {
      pivot.current = { x: stage.clientWidth / 2 + w / 2 - BOLT_INSET, y: BAR_TOP + CHAIN }
    }
    place()
    window.addEventListener("resize", place)
    sign.current = { angle: 0, spin: 0, snapped: false, grabbed: false, grabOffset: 0, lastAngle: 0, lastT: 0 }
    let elapsed = 0
    return (dt) => {
      const s = sign.current!
      elapsed += dt
      if (!s.snapped && elapsed >= SNAP_AT) s.snapped = true
      if (s.snapped && !s.grabbed) {
        const rx = comX * Math.cos(s.angle) - comY * Math.sin(s.angle)
        s.spin += ((GRAVITY * rx) / inertia - s.spin * DAMPING) * dt
        s.angle += s.spin * dt
        if (s.angle < SAG) {
          s.angle = SAG
          s.spin = -s.spin * 0.35
        }
      }
      const { x, y } = pivot.current
      el.style.transform = `translate(${x - (w - BOLT_INSET)}px, ${y}px) rotate(${s.angle}rad)`
      const boltX = x - reach * Math.cos(s.angle)
      const boltY = y - reach * Math.sin(s.angle)
      const anchorX = x - reach
      const length = Math.hypot(boltX - anchorX, boltY - BAR_TOP)
      const chain = chainRef.current
      if (chain) {
        chain.style.height = `${length}px`
        chain.style.transform = `translate(${anchorX}px, ${BAR_TOP}px) rotate(${Math.atan2(anchorX - boltX, boltY - BAR_TOP)}rad)`
      }
    }
  })

  const pointerAngle = (event: React.PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect()
    const px = event.clientX - (rect?.left ?? 0) - pivot.current.x
    const py = event.clientY - (rect?.top ?? 0) - pivot.current.y
    return Math.atan2(py, px)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = sign.current
    if (!live || !s?.snapped) return
    event.currentTarget.setPointerCapture(event.pointerId)
    s.grabbed = true
    s.grabOffset = s.angle - pointerAngle(event)
    s.lastAngle = s.angle
    s.lastT = event.timeStamp
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = sign.current
    if (!s?.grabbed) return
    const target = Math.min(MAX_LIFT, Math.max(SAG, pointerAngle(event) + s.grabOffset))
    const dt = Math.max((event.timeStamp - s.lastT) / 1000, 1 / 240)
    s.spin = s.spin * 0.5 + ((target - s.lastAngle) / dt) * 0.5
    s.angle = target
    s.lastAngle = target
    s.lastT = event.timeStamp
  }

  const onPointerUp = () => {
    if (sign.current) sign.current.grabbed = false
  }

  return (
    <div ref={stageRef} className={live ? "nf-stage nf-signpost is-live" : "nf-stage nf-signpost"} aria-hidden="true">
      <div className="nf-bar" />
      <div className="nf-chain nf-chain--left" ref={chainRef} />
      <div className="nf-chain nf-chain--right" />
      <div
        ref={signRef}
        className="nf-sign"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="nf-bolt nf-bolt--left" />
        <span className="nf-bolt nf-bolt--right" />
        <span className="nf-digit nf-sign-number">404</span>
        <span className="nf-sign-street">Nowhere Ave</span>
      </div>
    </div>
  )
}
