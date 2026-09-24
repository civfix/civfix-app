import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { View, type ViewStyle } from "react-native"
import { bodyTransitionPlan, translateRatio, type BodyTransitionPlan } from "./bodyTransitionModel"
import { BODY_TIMING } from "./bodyTransitionTiming"
import { cssTransitionParts } from "./motionCss"
import type { StepTransitionProps } from "./StepTransition.types"
import { prefersReducedMotion } from "./webMedia"

const SETTLE_GUARD_MS = 60

interface Entrance {
  plan: BodyTransitionPlan
  flipped: boolean
}

function entranceStyle(entrance: Entrance | null): ViewStyle {
  if (!entrance) return {} as ViewStyle
  const { flipped, plan } = entrance
  return {
    transform: translateRatio(flipped ? 0 : plan.fromRatio),
    opacity: flipped ? 1 : 0,
    transition: flipped
      ? cssTransitionParts(
          plan.slide
            ? [
                ["transform", plan.duration],
                ["opacity", plan.fadeDuration],
              ]
            : [["opacity", plan.fadeDuration]],
        )
      : "none",
  } as unknown as ViewStyle
}

export function StepTransition({ children, direction, style, transitionKey }: StepTransitionProps) {
  const [entrance, setEntrance] = useState<Entrance | null>(null)
  const prevKeyRef = useRef(transitionKey)
  const nodeRef = useRef<any>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (transitionKey === prevKeyRef.current) return
    prevKeyRef.current = transitionKey
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = null
    if (prefersReducedMotion()) {
      setEntrance(null)
      return
    }
    setEntrance({ plan: bodyTransitionPlan(direction, false, BODY_TIMING), flipped: false })
  }, [direction, transitionKey])

  useLayoutEffect(() => {
    if (!entrance || entrance.flipped) return
    if (typeof window === "undefined") return
    const node = nodeRef.current as { offsetHeight?: number } | null
    if (typeof node?.offsetHeight === "number") void node.offsetHeight
    else void document.documentElement.offsetHeight
    setEntrance((cur) => (cur && !cur.flipped ? { ...cur, flipped: true } : cur))
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null
      setEntrance(null)
    }, entrance.plan.duration + SETTLE_GUARD_MS)
  }, [entrance])

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    [],
  )

  return (
    <View ref={nodeRef} style={[style, entranceStyle(entrance)]}>
      {children}
    </View>
  )
}
