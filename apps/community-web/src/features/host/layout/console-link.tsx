"use client"

import * as React from "react"

import { navigateConsole } from "@/components/console/url-state"

export interface ConsoleLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string
}

export const ConsoleLink = React.forwardRef<HTMLAnchorElement, ConsoleLinkProps>(
  ({ href, onClick, ...props }, ref) => (
    <a
      ref={ref}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (event.button !== 0) return
        event.preventDefault()
        navigateConsole(href)
      }}
      {...props}
    />
  ),
)
ConsoleLink.displayName = "ConsoleLink"
