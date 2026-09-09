import * as React from "react"
import Link from "next/link"
import { legalDocument, type LegalDocumentVersion } from "@civfix/shared/legal"
import type { LegalDocumentType } from "@civfix/shared"

import { Wordmark } from "@/components/brand"

import { CA_REGISTRATION_LABEL, CA_REGISTRATION_NUMBER, LEGAL_ENTITY } from "./legal-entity"

export type LegalDocId =
  | "terms"
  | "privacy"
  | "cookies"
  | "subprocessors"
  | "donations"
  | "org-donation-agreement"
  | "donation-disclosure"

export const LEGAL_DOC_TYPE: Readonly<Record<LegalDocId, LegalDocumentType>> = {
  terms: "terms",
  privacy: "privacy",
  cookies: "cookies",
  subprocessors: "subprocessors",
  donations: "donations",
  "org-donation-agreement": "org_donation_agreement",
  "donation-disclosure": "donation_disclosure",
}

const DOCS: { id: LegalDocId; href: string; label: string }[] = [
  { id: "terms", href: "/legal/terms", label: "Terms of Service" },
  { id: "privacy", href: "/legal/privacy", label: "Privacy Policy" },
  { id: "cookies", href: "/legal/cookies", label: "Cookies & Storage" },
  { id: "subprocessors", href: "/legal/subprocessors", label: "Sub-processors" },
  { id: "donations", href: "/legal/donations", label: "Donations & Fundraising" },
  {
    id: "org-donation-agreement",
    href: "/legal/org-donation-agreement",
    label: "Organization Donation Agreement",
  },
  {
    id: "donation-disclosure",
    href: "/legal/donation-disclosure",
    label: "Donation Disclosures",
  },
]

export { CA_REGISTRATION_LABEL, CA_REGISTRATION_NUMBER, LEGAL_ENTITY }

export function legalVersionFor(id: LegalDocId): LegalDocumentVersion {
  return legalDocument(LEGAL_DOC_TYPE[id])
}

const EFFECTIVE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})

export function formatEffectiveDate(effectiveAt: string): string {
  const at = new Date(effectiveAt)
  return Number.isNaN(at.getTime()) ? effectiveAt : EFFECTIVE_DATE_FORMAT.format(at)
}

interface LegalPageProps {
  active: LegalDocId
  title: string
  intro?: string
  children: React.ReactNode
}

export function LegalPage({ active, title, intro, children }: LegalPageProps) {
  const document = legalVersionFor(active)

  return (
    <div className="legal-page">
      <div className="legal-shell">
        <header className="legal-top">
          <Link href="/" aria-label="civfix home">
            <Wordmark />
          </Link>
          <Link href="/" className="legal-back">
            ← Back to map
          </Link>
        </header>

        <nav className="legal-nav" aria-label="Legal documents">
          {DOCS.map((doc) => (
            <Link
              key={doc.id}
              href={doc.href}
              aria-current={doc.id === active ? "page" : undefined}
            >
              {doc.label}
            </Link>
          ))}
        </nav>

        <h1 className="legal-title">{title}</h1>
        <p className="legal-meta">
          Version {document.version} · effective {formatEffectiveDate(document.effectiveAt)}
          {intro ? ` · ${intro}` : ""}
        </p>

        <article
          className="legal-prose"
          data-legal-doc={document.type}
          data-legal-version={document.version}
        >
          {children}
        </article>

        <footer className="legal-foot">
          <span>© 2026 {LEGAL_ENTITY}. All rights reserved.</span>
          <nav aria-label="Legal documents">
            {DOCS.map((doc) => (
              <Link key={doc.id} href={doc.href}>
                {doc.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  )
}
