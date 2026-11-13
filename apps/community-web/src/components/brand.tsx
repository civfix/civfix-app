"use client"

import * as React from "react"
import { seasonLook } from "@civfix/tokens"

/** The per-letter colors live in design.css (`.cf-logo .s1` to `.s6`). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={["cf-logo", className].filter(Boolean).join(" ")}
      role="img"
      aria-label="civfix"
    >
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
      {seasonLook?.hat ? <SeasonHat /> : null}
    </span>
  )
}

/** Colors come from design.css (`--hat-felt`, `--hat-trim`), so the hat follows the scheme with no JS. */
function SeasonHat() {
  return (
    <svg className="cf-hat" viewBox="0 0 40 32" aria-hidden="true">
      <path
        d="M5 24 C8 11 18 2 31 5 C34 6 36.5 9 37 13 C31 9.5 25 12 23 24 Z"
        fill="var(--hat-felt)"
      />
      <rect
        x="2"
        y="21"
        width="25"
        height="8.5"
        rx="4.25"
        fill="var(--hat-trim)"
        stroke="var(--hat-edge)"
        strokeWidth="1.2"
      />
      <circle
        cx="36.5"
        cy="15"
        r="4.2"
        fill="var(--hat-trim)"
        stroke="var(--hat-edge)"
        strokeWidth="1.2"
      />
    </svg>
  )
}
