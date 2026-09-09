import { ServiceRecordView } from "@/features/service-record/service-record-view"

// Print + chrome rules for this route only (the /legal precedent). A `@media print` block cannot be
// expressed as Tailwind utilities, and printing is a first-class use of this page: the audience is a
// school registrar or court clerk who staples the confirmation to a paper transcript.
import "../service-record.css"

/**
 * /service-record/<code> - the PUBLIC service-hours certificate verification page (P5).
 *
 * Catch-all like /pin/[...id]: with output:"export" a dynamic segment must enumerate its params at build
 * time, and certificate codes are unguessable by construction, so we emit one placeholder shell at
 * out/service-record/_/index.html and read the real code client-side. The SPA-fallback rule in
 * public/_redirects (`/service-record/* -> /service-record/_/ 200`) serves it for every deep link -
 * which is exactly why ServiceRecordView reads `window.location.pathname` rather than `usePathname()`.
 *
 * No Suspense boundary is needed (unlike /claim): the code comes from the pathname, not from
 * `useSearchParams()`, so nothing here suspends during the static export.
 *
 * The route is not linked from the app - the code travels on paper - so it is deliberately plain DOM
 * inside DetailShell rather than a @civfix/ui body.
 */
export function generateStaticParams(): Array<{ code: string[] }> {
  return [{ code: ["_"] }]
}

export const dynamicParams = false

export default function ServiceRecordPage() {
  return <ServiceRecordView />
}
