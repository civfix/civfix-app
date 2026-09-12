import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { View, type ViewStyle } from "react-native"
import { motion } from "../theme"
import type { BodyTransitionDirection, BodyTransitionProps } from "./BodyTransition.types"
import { bodyTransitionPlan, translateRatio } from "./bodyTransitionModel"
import { BODY_TIMING } from "./bodyTransitionTiming"
import { cssTransitionParts } from "./motionCss"
import { prefersReducedMotion } from "./webMedia"

const IN_DURATION = motion.bodyPush.duration
const OUT_DURATION = motion.bodyExit.duration
const SETTLE_FALLBACK_MS = IN_DURATION + 60

interface LayerStyle {
  transform: string
  opacity: number
}

interface Phase {
  incomingFrom: LayerStyle
  incomingTo: LayerStyle
  outgoingFrom: LayerStyle
  outgoingTo: LayerStyle
  incomingTransition: string
  outgoingTransition: string
}

const SETTLED: LayerStyle = { transform: translateRatio(0), opacity: 1 }
const OUTGOING_FROM: LayerStyle = { transform: translateRatio(0), opacity: 1 }

function phaseFor(direction: BodyTransitionDirection): Phase {
  const plan = bodyTransitionPlan(direction, false, BODY_TIMING)
  return {
    incomingFrom: { transform: translateRatio(plan.fromRatio), opacity: 0 },
    incomingTo: SETTLED,
    outgoingFrom: OUTGOING_FROM,
    outgoingTo: { transform: translateRatio(plan.exitRatio), opacity: 0 },
    incomingTransition: plan.slide
      ? cssTransitionParts([
          ["transform", plan.duration],
          ["opacity", plan.fadeDuration],
        ])
      : cssTransitionParts([["opacity", plan.fadeDuration]]),
    outgoingTransition: plan.slide
      ? cssTransitionParts([
          ["transform", plan.exitDuration],
          ["opacity", plan.exitDuration],
        ])
      : cssTransitionParts([["opacity", plan.exitDuration]]),
  }
}

const PHASES: Record<BodyTransitionDirection, Phase> = {
  push: phaseFor("push"),
  pop: phaseFor("pop"),
  replace: phaseFor("replace"),
}

function castLayerStyle(layer: LayerStyle, transition: string): ViewStyle {
  return {
    transform: layer.transform,
    opacity: layer.opacity,
    transition,
  } as unknown as ViewStyle
}

export function BodyTransition({ children, transitionKey, direction }: BodyTransitionProps) {
  const [settledKey, setSettledKey] = useState(transitionKey)
  const [anim, setAnim] = useState<{
    outgoing: React.ReactNode
    outgoingKey: string
    direction: BodyTransitionDirection
    flipped: boolean
    outDropped: boolean
  } | null>(null)

  const prevChildRef = useRef<React.ReactNode>(children)
  const prevKeyRef = useRef<string>(transitionKey)
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outDropRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inRef = useRef<any>(null)
  const outRef = useRef<any>(null)

  useLayoutEffect(() => {
    if (transitionKey === prevKeyRef.current) return
    const outgoing = prevChildRef.current
    const outgoingKey = prevKeyRef.current
    prevChildRef.current = children
    prevKeyRef.current = transitionKey

    if (prefersReducedMotion()) {
      if (fallbackRef.current) clearTimeout(fallbackRef.current)
      fallbackRef.current = null
      if (outDropRef.current) clearTimeout(outDropRef.current)
      outDropRef.current = null
      setAnim(null)
      setSettledKey(transitionKey)
      return
    }

    setSettledKey(transitionKey)
    setAnim({ outgoing, outgoingKey, direction, flipped: false, outDropped: false })

    if (fallbackRef.current) clearTimeout(fallbackRef.current)
    if (typeof window !== "undefined") {
      fallbackRef.current = setTimeout(() => {
        fallbackRef.current = null
        setAnim(null)
      }, SETTLE_FALLBACK_MS)
    }
  }, [transitionKey])

  useEffect(() => {
    if (!anim) {
      prevChildRef.current = children
      prevKeyRef.current = settledKey
    }
  }, [children, settledKey, anim])

  useLayoutEffect(() => {
    if (!anim || anim.flipped) return
    if (typeof window === "undefined") return
    const inNode = inRef.current as { offsetHeight?: number } | null
    const outNode = outRef.current as { offsetHeight?: number } | null
    if (typeof inNode?.offsetHeight === "number") void inNode.offsetHeight
    else if (typeof outNode?.offsetHeight === "number") void outNode.offsetHeight
    else void document.documentElement.offsetHeight
    setAnim((cur) => (cur && !cur.flipped ? { ...cur, flipped: true } : cur))

    if (outDropRef.current) clearTimeout(outDropRef.current)
    outDropRef.current = setTimeout(() => {
      outDropRef.current = null
      setAnim((cur) => (cur && !cur.outDropped ? { ...cur, outDropped: true } : cur))
    }, OUT_DURATION)
  }, [anim])

  useEffect(() => {
    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current)
      if (outDropRef.current) clearTimeout(outDropRef.current)
    }
  }, [])

  if (!anim) {
    return <View style={styles.host}>{children}</View>
  }

  const phase = PHASES[anim.direction]
  const incoming = anim.flipped ? phase.incomingTo : phase.incomingFrom
  const outgoing = anim.flipped ? phase.outgoingTo : phase.outgoingFrom

  const settle = () => {
    if (fallbackRef.current) clearTimeout(fallbackRef.current)
    fallbackRef.current = null
    if (outDropRef.current) clearTimeout(outDropRef.current)
    outDropRef.current = null
    setAnim(null)
  }

  return (
    <View style={styles.host}>
      {anim.outDropped ? null : (
        <View
          ref={outRef}
          key={`out:${anim.outgoingKey}`}
          style={[styles.layer, castLayerStyle(outgoing, anim.flipped ? phase.outgoingTransition : "none")]}
          pointerEvents="none"
        >
          {anim.outgoing}
        </View>
      )}
      <View
        ref={inRef}
        key={`in:${settledKey}`}
        style={[styles.layer, castLayerStyle(incoming, anim.flipped ? phase.incomingTransition : "none")]}
        {...({
          onTransitionEnd: (e: any) => {
            if (e?.target !== e?.currentTarget) return
            const wants = phase.incomingFrom.transform !== phase.incomingTo.transform ? "transform" : "opacity"
            if (e?.propertyName && e.propertyName !== wants) return
            if (anim.flipped) settle()
          },
        } as any)}
      >
        {children}
      </View>
    </View>
  )
}

const styles = {
  host: { flex: 1, position: "relative", overflow: "hidden" } as ViewStyle,
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,
}
