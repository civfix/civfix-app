"use client"

import * as React from "react"

/** The per-letter colors live in design.css (`.cf-logo .s1` to `.s6`). */
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
