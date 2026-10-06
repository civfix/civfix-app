"use client"

import * as React from "react"
import { useT } from "@civfix/ui/i18n"

import { useMotionLoop } from "./use-motion-loop"

const GRAVITY = 2400
const DAMPING = 0.9
const SNAP_AT = 0.7
const BOLT_INSET = 22
const CHAIN = 38
/** How far the broken chain lets the sign drop: crooked, but still readable. */
const SAG = (-22 * Math.PI) / 180

/**
 * The sign is laid out by CSS hanging level; only its tilt about the right bolt
 * and the stretched left chain are set here. Reduced motion shows the crooked
 * rest pose straight away, so the still keeps the joke.
 */
export function SignStage({ live }: { live: boolean }) {
  const { t } = useT("not-found")
  const signRef = React.useRef<HTMLDivElement>(null)
  const chainRef = React.useRef<HTMLDivElement>(null)
  const angle = React.useRef(live ? 0 : SAG)

  const pose = React.useCallback(() => {
    const sign = signRef.current
    const chain = chainRef.current
    if (!sign || !chain) return
    const reach = sign.offsetWidth - 2 * BOLT_INSET
    const a = angle.current
    sign.style.transform = `rotate(${a}rad)`
    const dx = reach * Math.cos(a) - reach
    const dy = CHAIN - reach * Math.sin(a)
    chain.style.height = `${Math.hypot(dx, dy)}px`
    chain.style.transform = `rotate(${Math.atan2(dx, dy)}rad)`
  }, [])

  // Covers the first paint and a resize across the phone breakpoint, which
  // changes the sign's size after the fall has stopped.
  React.useLayoutEffect(() => {
    const sign = signRef.current
    if (!sign) return
    pose()
    const observer = new ResizeObserver(pose)
    observer.observe(sign)
    return () => observer.disconnect()
  }, [pose])

  useMotionLoop(live, () => {
    const sign = signRef.current
    if (!sign) return null
    const w = sign.offsetWidth
    const h = sign.offsetHeight
    // Treat the sign as a rigid plate swinging on its right bolt.
    const comX = -(w / 2 - BOLT_INSET)
    const comY = h / 2
    const inertia = (w * w + h * h) / 12 + comX * comX + comY * comY
    let spin = 0
    let elapsed = 0
    return (dt) => {
      elapsed += dt
      if (elapsed < SNAP_AT) return true
      const rx = comX * Math.cos(angle.current) - comY * Math.sin(angle.current)
      spin += ((GRAVITY * rx) / inertia - spin * DAMPING) * dt
      angle.current += spin * dt
      if (angle.current < SAG) {
        angle.current = SAG
        spin = -spin * 0.35
      }
      const settled = angle.current - SAG < 0.002 && Math.abs(spin) < 0.2
      if (settled) angle.current = SAG
      pose()
      return !settled
    }
  })

  return (
    <div className="nf-scene nf-signpost">
      <div className="nf-bar" />
      <div className="nf-chain nf-chain--left" ref={chainRef} />
      <div className="nf-chain nf-chain--right" />
      <div ref={signRef} className="nf-sign">
        <span className="nf-bolt nf-bolt--left" />
        <span className="nf-bolt nf-bolt--right" />
        <span className="nf-digit nf-sign-number">404</span>
        <span className="nf-sign-street">{t("sign_street")}</span>
      </div>
    </div>
  )
}
