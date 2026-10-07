import { ServiceRecordView } from "@/features/service-record/service-record-view"

// A `@media print` block cannot be expressed as Tailwind utilities, and printing is a first-class use
// of this page: a registrar or court clerk staples the confirmation to a paper transcript.
import "../service-record.css"

/**
 * Placeholder-shell catch-all; see the static-export note in /pin/[...id]/page.tsx. Every deep link is
 * served that one shell, which is why ServiceRecordView reads `window.location.pathname` rather than
 * `usePathname()`. The code comes from the pathname, not `useSearchParams()`, so no Suspense boundary
 * is needed. The route is not linked from the app (the code travels on paper), so it is plain DOM
 * rather than a @civfix/ui body.
 */
export function generateStaticParams(): Array<{ code: string[] }> {
  return [{ code: ["_"] }]
}

export const dynamicParams = false

export default function ServiceRecordPage() {
  return <ServiceRecordView />
}
