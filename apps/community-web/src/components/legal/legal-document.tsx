"use client"

import * as React from "react"
import type { LegalDocumentType } from "@civfix/contract"
import { LegalDocumentBody } from "@civfix/ui"

export function LegalDocument({ type }: { type: LegalDocumentType }) {
  // Mounted on the client only, so the query string is there to read; an export has no server to see it.
  const [version] = React.useState(() => new URLSearchParams(window.location.search).get("version") ?? undefined)
  return <LegalDocumentBody type={type} version={version} />
}
