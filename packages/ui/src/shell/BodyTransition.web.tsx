import React, { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import { View, type ViewStyle } from "react-native"
import { motion } from "../theme"
import type { BodyTransitionDirection, BodyTransitionProps } from "./BodyTransition.types"
import { bodyTransitionPlan, translateRatio } from "./bodyTransitionModel"
import { BODY_TIMING } from "./bodyTransitionTiming"
import { cssTransitionParts } from "./motionCss"
import { forceReflow, useFlipPhase } from "./useFlipPhase"
import { prefersReducedMotion } from "./webMedia"

const IN_DURATION = motion.bodyPush.duration
const OUT_DURATION = motion.bodyExit.duration
const SETTLE_FALLBACK_MS = IN_DURATION + 60

type SlotId = "a" | "b"

const OTHER_SLOT: Record<SlotId, SlotId> = { a: "b", b: "a" }

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

const ARRIVED: LayerStyle = { transform: translateRatio(0), opacity: 1 }
const OUTGOING_FROM: LayerStyle = { transform: translateRatio(0), opacity: 1 }
const IDLE: LayerStyle = { transform: "none", opacity: 1 }
const VACANT: LayerStyle = { transform: "none", opacity: 0 }

function phaseFor(direction: BodyTransitionDirection): Phase {
  const plan = bodyTransitionPlan(direction, false, BODY_TIMING)
  return {
    incomingFrom: { transform: translateRatio(plan.fromRatio), opacity: 0 },
    incomingTo: ARRIVED,
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

function castLayerStyle(
  layer: LayerStyle,
  transition: string,
  zIndex: number | undefined,
  interactive: boolean,
): ViewStyle {
  return {
    transform: layer.transform,
    opacity: layer.opacity,
    transition,
    zIndex,
    pointerEvents: interactive ? undefined : "none",
  } as unknown as ViewStyle
}

interface Animation {
  outgoing: React.ReactNode
  outgoingKey: string
  direction: BodyTransitionDirection
  flipped: boolean
  outDropped: boolean
}

interface TransitionState {
  key: string
  nav: number
  activeSlot: SlotId
  anim: Animation | null
}

function withAnim(state: TransitionState, patch: Partial<Animation>): TransitionState {
  if (!state.anim) return state
  return { ...state, anim: { ...state.anim, ...patch } }
}

export function BodyTransition({ children, transitionKey, direction }: BodyTransitionProps) {
  const [state, setState] = useState<TransitionState>(() => ({
    key: transitionKey,
    nav: 0,
    activeSlot: "a",
    anim: null,
  }))

  const committedChildRef = useRef<React.ReactNode>(children)
  const slotARef = useRef<any>(null)
  const slotBRef = useRef<any>(null)

  if (state.key !== transitionKey) {
    const instant = prefersReducedMotion()
    setState({
      key: transitionKey,
      nav: state.nav + 1,
      activeSlot: instant ? state.activeSlot : OTHER_SLOT[state.activeSlot],
      anim: instant
        ? null
        : {
            outgoing: committedChildRef.current,
            outgoingKey: state.key,
            direction,
            flipped: false,
            outDropped: false,
          },
    })
  }

  const { activeSlot, anim } = state

  useEffect(() => {
    committedChildRef.current = children
  }, [children])

  const settle = () => {
    setState((cur) => (cur.anim ? { ...cur, anim: null } : cur))
  }

  const phaseNav = anim ? state.nav : null
  useFlipPhase({
    pendingNav: anim && !anim.flipped ? state.nav : null,
    phaseNav,
    fallbackMs: SETTLE_FALLBACK_MS,
    reflow: () => {
      const activeNode = (activeSlot === "a" ? slotARef : slotBRef).current
      const outgoingNode = (activeSlot === "a" ? slotBRef : slotARef).current
      forceReflow([activeNode, outgoingNode], true)
    },
    flip: () => setState((cur) => (cur.anim && !cur.anim.flipped ? withAnim(cur, { flipped: true }) : cur)),
    settle,
  })

  useLayoutEffect(() => {
    if (phaseNav === null) return
    const outDrop = setTimeout(() => {
      setState((cur) => (cur.anim && !cur.anim.outDropped ? withAnim(cur, { outDropped: true }) : cur))
    }, OUT_DURATION)
    return () => clearTimeout(outDrop)
  }, [phaseNav])

  const phase = anim ? PHASES[anim.direction] : null
  const flipped = !!anim?.flipped

  const activeLayer = phase ? (flipped ? phase.incomingTo : phase.incomingFrom) : IDLE
  const activeTransition = phase && flipped ? phase.incomingTransition : "none"
  const outgoingLayer = phase ? (flipped ? phase.outgoingTo : phase.outgoingFrom) : VACANT
  const outgoingTransition = phase && flipped ? phase.outgoingTransition : "none"
  const activeContent = <Fragment key={state.key}>{children}</Fragment>
  const outgoingContent =
    anim && !anim.outDropped ? <Fragment key={anim.outgoingKey}>{anim.outgoing}</Fragment> : null

  const onLayerTransitionEnd = (slot: SlotId, event: any) => {
    if (!phase || !flipped) return
    if (slot !== activeSlot) return
    if (event?.target !== event?.currentTarget) return
    const wants = phase.incomingFrom.transform !== phase.incomingTo.transform ? "transform" : "opacity"
    if (event?.propertyName && event.propertyName !== wants) return
    settle()
  }

  const renderLayer = (slot: SlotId) => {
    const active = slot === activeSlot
    const layer = active ? activeLayer : outgoingLayer
    const transition = active ? activeTransition : outgoingTransition
    const zIndex = anim ? (active ? 1 : 0) : undefined
    return (
      <View
        key={slot}
        ref={slot === "a" ? slotARef : slotBRef}
        style={[styles.layer, castLayerStyle(layer, transition, zIndex, active)]}
        {...({
          onTransitionEnd: (event: any) => onLayerTransitionEnd(slot, event),
        } as any)}
      >
        {active ? activeContent : outgoingContent}
      </View>
    )
  }

  return (
    <View style={styles.host}>
      {renderLayer("a")}
      {renderLayer("b")}
    </View>
  )
}

const styles = {
  host: { flex: 1, position: "relative", overflow: "hidden" } as ViewStyle,
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,
}
