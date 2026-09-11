import React, { forwardRef, useCallback, useEffect, useRef } from "react"
import { TextInput as RNTextInput } from "react-native"
import { keyboardFocusStore, type KeyboardFocusNode } from "../shell/keyboardFocusStore"
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
  const nodeRef = useRef<KeyboardFocusNode | null>(null)
  const focusedRef = useRef(false)

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
      if (focusedRef.current) keyboardFocusStore.clearFocused(nodeRef.current)
    },
    [],
  )

  const handleFocus = useCallback<FocusHandler>(
    (event) => {
      focusedRef.current = true
      keyboardFocusStore.setFocused(nodeRef.current, scope)
      onFocus?.(event)
    },
    [onFocus, scope],
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
      if (focusedRef.current) keyboardFocusStore.bump()
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
