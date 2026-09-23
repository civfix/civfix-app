"use client"

import * as React from "react"

/**
 * The civfix brand surfaces (wordmark), ported from the civfix MOBILE handoff
 * (project/brand.jsx + the .cf-logo CSS). We deliberately use the civfix branding, NOT the design's
 * rainbow "PinIt" wordmark:
 *
 *  - Wordmark: per-letter colored "civfix" (c=bloom, i=sun-600, v=moss, f=sky, i=lilac, x=bloom),
 *    rendered with the display family. Colors live in design.css (.cf-logo .s1..s6).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={["cf-logo", className].filter(Boolean).join(" ")} role="img" aria-label="civfix">
      <span className="ch s1" aria-hidden="true">
        <b>c</b>
      </span>
      <span className="ch s2" aria-hidden="true">
        <b>i</b>
      </span>
      <span className="ch s3" aria-hidden="true">
        <b>v</b>
      </span>
      <span className="ch s4" aria-hidden="true">
        <b>f</b>
      </span>
      <span className="ch s5" aria-hidden="true">
        <b>i</b>
      </span>
      <span className="ch s6" aria-hidden="true">
        <b>x</b>
      </span>
    </span>
  )
}
