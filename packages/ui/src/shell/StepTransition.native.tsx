import React from "react"
import { Animated } from "react-native"
import type { StepTransitionProps } from "./StepTransition.types"
import { useEntranceTransition } from "./useEntranceTransition.native"

export function StepTransition({ children, direction, style, transitionKey }: StepTransitionProps) {
  const { onLayout, animatedStyle } = useEntranceTransition(transitionKey, direction)
  return (
    <Animated.View onLayout={onLayout} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  )
}
