"use client"

import * as React from "react"
import { BadgeCheck } from "lucide-react"
import type { DonationPageEventRef, DonationPageOrg } from "@civfix/shared"

const EVENT_WHEN = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function formatEventWhen(value: string): string | null {
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : EVENT_WHEN.format(at)
}

interface OrgHeaderProps {
  org: DonationPageOrg
  event?: DonationPageEventRef | null
}

export function OrgHeader({ org, event }: OrgHeaderProps) {
  const place = [org.city, org.state].filter((part) => !!part).join(", ")
  const when = event ? formatEventWhen(event.startsAt) : null

  return (
    <header className="donate-org">
      {org.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="donate-org-logo" src={org.logoUrl} alt="" width={56} height={56} />
      ) : null}
      <div className="donate-org-identity">
        <h1>
          Donate to {org.displayName}
          {org.verified ? (
            <BadgeCheck aria-label="Verified nonprofit" className="donate-org-verified" size={20} />
          ) : null}
        </h1>
        <p className="donate-org-legal">
          {org.legalName}
          {org.einLast4 ? ` · EIN ending ${org.einLast4}` : ""}
          {place.length > 0 ? ` · ${place}` : ""}
        </p>
        {event ? (
          <p className="donate-org-event">
            In support of {event.title}
            {when === null ? "" : ` · ${when}`}
          </p>
        ) : null}
      </div>
    </header>
  )
}
