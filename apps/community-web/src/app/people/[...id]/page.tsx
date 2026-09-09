import { PersonProfileRoute } from "@/features/people/person-profile-route"

/**
 * Catch-all person profile route. See the static-export note in /pin/[...id]/page.tsx and the app
 * README: real ids are read client-side; arbitrary URLs need a SPA fallback on the static host.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function PersonProfilePage() {
  return <PersonProfileRoute />
}
