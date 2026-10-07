export interface WsTransportDeps<S> {
  apiUrl: string
  readToken: () => Promise<string | null>
  mintTicket: () => Promise<string | null>
  connect: (url: string) => S
}

export interface OpenedSocket<S> {
  socket: S
  authKey: string
}

function ticketedWsUrl(apiUrl: string, ticket: string): string {
  const base = apiUrl.replace(/\/$/, "")
  const wsBase = base.startsWith("https")
    ? `wss${base.slice("https".length)}`
    : base.startsWith("http")
      ? `ws${base.slice("http".length)}`
      : base
  return `${wsBase}/ws?ticket=${encodeURIComponent(ticket)}`
}

/**
 * The single-use ticket is the only credential that may ride in the /ws URL: URLs land in proxy and
 * CDN access logs, so the long-lived session bearer never goes there. Without a ticket this returns
 * null and the socket core retries on its backoff schedule.
 */
export async function openTicketedSocket<S>(deps: WsTransportDeps<S>): Promise<OpenedSocket<S> | null> {
  const token = await deps.readToken()
  if (!token) return null

  let ticket: string | null = null
  try {
    ticket = await deps.mintTicket()
  } catch {
    return null
  }
  if (!ticket) return null
  return { socket: deps.connect(ticketedWsUrl(deps.apiUrl, ticket)), authKey: token }
}
