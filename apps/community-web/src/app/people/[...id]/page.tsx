import { PersonProfileRoute } from "@/features/people/person-profile-route"

/** Placeholder-shell catch-all; see the static-export note in /pin/[...id]/page.tsx. */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function PersonProfilePage() {
  return <PersonProfileRoute />
}
