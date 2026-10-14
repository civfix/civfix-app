import React, { useLayoutEffect, useRef, useState } from "react"
import { View, type ViewStyle } from "react-native"
import { bodyTransitionPlan, translateRatio, type BodyTransitionPlan } from "./bodyTransitionModel"
import { BODY_TIMING } from "./bodyTransitionTiming"
import { cssTransitionParts } from "./motionCss"
import type { StepTransitionProps } from "./StepTransition.types"
import { forceReflow, useFlipPhase } from "./useFlipPhase"
import { prefersReducedMotion } from "./webMedia"

const SETTLE_GUARD_MS = 60

interface Entrance {
  nav: number
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
  const navRef = useRef(0)
  const nodeRef = useRef<any>(null)

  useLayoutEffect(() => {
    if (transitionKey === prevKeyRef.current) return
    prevKeyRef.current = transitionKey
    navRef.current += 1
    if (prefersReducedMotion()) {
      setEntrance(null)
      return
    }
    setEntrance({ nav: navRef.current, plan: bodyTransitionPlan(direction, false, BODY_TIMING), flipped: false })
  }, [direction, transitionKey])

  useFlipPhase({
    pendingNav: entrance && !entrance.flipped ? entrance.nav : null,
    phaseNav: entrance ? entrance.nav : null,
    fallbackMs: entrance ? entrance.plan.duration + SETTLE_GUARD_MS : 0,
    reflow: () => forceReflow([nodeRef.current], true),
    flip: () => setEntrance((cur) => (cur && !cur.flipped ? { ...cur, flipped: true } : cur)),
    settle: () => setEntrance(null),
  })

  return (
    <View ref={nodeRef} style={[style, entranceStyle(entrance)]}>
      {children}
    </View>
  )
}
