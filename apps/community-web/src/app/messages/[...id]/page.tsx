import { ConversationRoute } from "@/features/messages/conversation-route"

/**
 * output: "export" needs every dynamic segment enumerated at build time, so this emits one placeholder
 * shell and the real thread id is read client-side. public/_redirects rewrites every /messages/<id>
 * deep link to that shell.
 */
export function generateStaticParams(): Array<{ id: string[] }> {
  return [{ id: ["_"] }]
}

export const dynamicParams = false

export default function ThreadDetailPage() {
  return <ConversationRoute />
}
