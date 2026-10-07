"use client"

import { useEffect, useRef } from "react"
import type { RefObject } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  )
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  trap: boolean = true,
) {
  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return
    const previous = document.activeElement as HTMLElement | null

    const initial = visibleFocusables(container)[0]
    if (initial) initial.focus()
    else {
      container.tabIndex = -1
      container.focus()
    }

    return () => {
      previous?.focus?.()
    }
  }, [ref, active])

  // Kept apart from the focus move so a viewport resize that toggles trapping does not yank
  // focus back to the first control.
  useEffect(() => {
    if (!active || !trap) return
    const container = ref.current
    if (!container) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const items = visibleFocusables(container)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener("keydown", handleKeyDown)
    return () => container.removeEventListener("keydown", handleKeyDown)
  }, [ref, active, trap])
}

type EscapeHandler = () => void

const escapeStack: EscapeHandler[] = []
let escapeBound = false

function handleGlobalEscape(event: KeyboardEvent) {
  if (event.key !== "Escape") return
  const top = escapeStack[escapeStack.length - 1]
  if (!top) return
  event.stopImmediatePropagation()
  event.preventDefault()
  top()
}

export function useEscape(active: boolean, onEscape: () => void) {
  const handlerRef = useRef(onEscape)
  handlerRef.current = onEscape
  useEffect(() => {
    if (!active) return
    const handler: EscapeHandler = () => handlerRef.current()
    escapeStack.push(handler)
    if (!escapeBound) {
      document.addEventListener("keydown", handleGlobalEscape)
      escapeBound = true
    }
    return () => {
      const index = escapeStack.indexOf(handler)
      if (index !== -1) escapeStack.splice(index, 1)
    }
  }, [active])
}
