"use client"

import * as React from "react"
import { CircleAlert, Loader2 } from "lucide-react"

interface DonateShellProps {
  busy?: boolean
  children: React.ReactNode
}

export function DonateShell({ busy, children }: DonateShellProps) {
  return (
    <main className="donate-page" aria-busy={busy ? true : undefined}>
      <div className="donate-shell donate-state">
        {busy ? <Loader2 aria-hidden="true" className="donate-spin" size={32} /> : null}
        <p>{children}</p>
      </div>
    </main>
  )
}

interface DonateUnavailableProps {
  title: string
  children: React.ReactNode
}

export function DonateUnavailable({ title, children }: DonateUnavailableProps) {
  return (
    <main className="donate-page">
      <div className="donate-shell donate-state">
        <CircleAlert aria-hidden="true" size={32} />
        <h1>{title}</h1>
        <p>{children}</p>
        <p className="donate-field-hint">
          <a href="/legal/donations">How donations through civfix work</a> ·{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Back to civfix</a>
        </p>
      </div>
    </main>
  )
}
