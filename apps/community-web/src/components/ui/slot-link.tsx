import * as React from "react"

/**
 * A plain anchor for a `<Trans>` slot. Trans clones the slot element with the translated link text as its
 * children, so the anchor renders whatever children it receives; a bare `<a />` slot hides that content
 * from jsx-a11y/anchor-has-content.
 */
export function SlotLink({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}>{children}</a>
}
