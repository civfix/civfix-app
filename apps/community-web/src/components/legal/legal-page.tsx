"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import type { LegalDocumentType } from "@civfix/contract"

import { Wordmark } from "@/components/brand"

import { LEGAL_ENTITY } from "./legal-entity"
import { SOURCE } from "@/lib/source"

// The document is React Native Web, which touches the DOM as it loads, so the static page is its shell.
const LegalDocument = dynamic(() => import("./legal-document").then((m) => m.LegalDocument), { ssr: false })

const DOCS: { id: LegalDocumentType; href: string; label: string }[] = [
  { id: "terms", href: "/legal/terms", label: "Terms of Service" },
  { id: "privacy", href: "/legal/privacy", label: "Privacy Policy" },
  { id: "cookies", href: "/legal/cookies", label: "Cookies & Storage" },
  { id: "subprocessors", href: "/legal/subprocessors", label: "Sub-processors" },
]

export function LegalPage({ active }: { active: LegalDocumentType }) {
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

        <LegalDocument type={active} />

        <footer className="legal-foot">
          <span>
            © 2026 {LEGAL_ENTITY}. Free software:{" "}
            <a href={SOURCE.url} target="_blank" rel="noreferrer noopener">
              Source code (AGPL-3.0)
            </a>
          </span>
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
