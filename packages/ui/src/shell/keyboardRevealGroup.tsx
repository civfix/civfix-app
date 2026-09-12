import React, { createContext, useContext, useRef } from "react"
import { View, type StyleProp, type ViewStyle } from "react-native"
import type { KeyboardFocusNode } from "./keyboardFocusStore"

export type KeyboardRevealGroupRef = React.MutableRefObject<KeyboardFocusNode | null>

const KeyboardRevealGroupContext = createContext<KeyboardRevealGroupRef | null>(null)
KeyboardRevealGroupContext.displayName = "KeyboardRevealGroupContext"

export interface KeyboardRevealGroupProps {
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

export function KeyboardRevealGroup({ style, children }: KeyboardRevealGroupProps) {
  const groupRef = useRef<KeyboardFocusNode | null>(null)
  return (
    <KeyboardRevealGroupContext.Provider value={groupRef}>
      <View
        style={style}
        ref={(node) => {
          groupRef.current = node as KeyboardFocusNode | null
        }}
      >
        {children}
      </View>
    </KeyboardRevealGroupContext.Provider>
  )
}

export function useKeyboardRevealGroup(): KeyboardRevealGroupRef | null {
  return useContext(KeyboardRevealGroupContext)
}
