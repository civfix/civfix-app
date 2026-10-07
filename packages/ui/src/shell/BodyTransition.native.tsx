import React from "react"
import { Animated, StyleSheet } from "react-native"
import type { BodyTransitionProps } from "./BodyTransition.types"
import { useEntranceTransition } from "./useEntranceTransition.native"

export function BodyTransition({ children, transitionKey, direction }: BodyTransitionProps) {
  const { onLayout, animatedStyle } = useEntranceTransition(transitionKey, direction)
  return (
    <Animated.View onLayout={onLayout} style={[styles.host, animatedStyle]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  host: { flex: 1, overflow: "hidden" },
})
