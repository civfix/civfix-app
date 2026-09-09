import type { ReactNode } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import type { BodyTransitionDirection } from "./BodyTransition.types"

export interface StepTransitionProps {
  children: ReactNode
  transitionKey: string
  direction: BodyTransitionDirection
  style?: StyleProp<ViewStyle>
}
