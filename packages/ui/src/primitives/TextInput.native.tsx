import React, { forwardRef, useCallback, useEffect, useRef } from "react"
import { TextInput as RNTextInput } from "react-native"
import { keyboardFocusStore, type KeyboardFocusNode } from "../shell/keyboardFocusStore"
import { useKeyboardRevealGroup } from "../shell/keyboardRevealGroup"
import { useKeyboardScrollScope } from "../shell/keyboardScrollScope"
import type { TextInputProps } from "./TextInput.types"

type FocusHandler = NonNullable<TextInputProps["onFocus"]>
type BlurHandler = NonNullable<TextInputProps["onBlur"]>
type ContentSizeHandler = NonNullable<TextInputProps["onContentSizeChange"]>

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { onFocus, onBlur, onContentSizeChange, ...rest },
  ref,
) {
  const scope = useKeyboardScrollScope()
  const revealGroup = useKeyboardRevealGroup()
  const nodeRef = useRef<KeyboardFocusNode | null>(null)
  const registeredRef = useRef<KeyboardFocusNode | null>(null)
  const focusedRef = useRef(false)
  const contentHeightRef = useRef(0)

  const setRefs = useCallback(
    (node: RNTextInput | null) => {
      nodeRef.current = node as KeyboardFocusNode | null
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<RNTextInput | null>).current = node
    },
    [ref],
  )

  useEffect(
    () => () => {
      keyboardFocusStore.clearFocused(registeredRef.current)
    },
    [],
  )

  const handleFocus = useCallback<FocusHandler>(
    (event) => {
      focusedRef.current = true
      registeredRef.current = nodeRef.current
      keyboardFocusStore.setFocused(nodeRef.current, scope, revealGroup?.current ?? null)
      onFocus?.(event)
    },
    [onFocus, scope, revealGroup],
  )

  const handleBlur = useCallback<BlurHandler>(
    (event) => {
      focusedRef.current = false
      keyboardFocusStore.clearFocused(nodeRef.current)
      onBlur?.(event)
    },
    [onBlur],
  )

  const handleContentSizeChange = useCallback<ContentSizeHandler>(
    (event) => {
      const height = event.nativeEvent.contentSize.height
      if (height !== contentHeightRef.current) {
        contentHeightRef.current = height
        if (focusedRef.current) keyboardFocusStore.bump()
      }
      onContentSizeChange?.(event)
    },
    [onContentSizeChange],
  )

  return (
    <RNTextInput
      {...rest}
      ref={setRefs}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onContentSizeChange={handleContentSizeChange}
    />
  )
})
