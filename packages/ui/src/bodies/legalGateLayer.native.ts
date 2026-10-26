import { StyleSheet, type View, type ViewStyle } from "react-native"
import type { RefObject } from "react"

/** The first-run gate's layer: over the app's stack, under the launch gate (60) that covers app start. */
export const LEGAL_GATE_LAYER: ViewStyle = { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 }

// A phone has no Tab order to leave the gate by, and the gate covers every touch behind it.
export function useContainOutside(_ref: RefObject<View | null>): void {}
