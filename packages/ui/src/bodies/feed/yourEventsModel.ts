export const YOUR_EVENTS_COLLAPSED_COUNT = 1

export interface YourEventsInput<E, I> {
  isAuthenticated: boolean
  events: readonly E[]
  invites: readonly I[]
  expanded: boolean
  eventsPending: boolean
  invitesPending: boolean
  invitesError: boolean
}

export interface YourEventsModel<E, I> {
  visible: boolean
  invites: readonly I[]
  events: readonly E[]
  inviteErrorVisible: boolean
  hiddenCount: number
  showMoreVisible: boolean
  showFewerVisible: boolean
}

const NOTHING: readonly never[] = []

export function yourEventsSectionVisible(input: {
  isAuthenticated: boolean
  eventCount: number
  inviteCount: number
  inviteErrorVisible?: boolean
}): boolean {
  if (!input.isAuthenticated) return false
  return input.eventCount > 0 || input.inviteCount > 0 || input.inviteErrorVisible === true
}

export function inviteErrorVisible(input: {
  isAuthenticated: boolean
  invitesPending: boolean
  invitesError: boolean
  inviteCount: number
}): boolean {
  if (!input.isAuthenticated || input.invitesPending || !input.invitesError) return false
  return input.inviteCount === 0
}

export function buildYourEventsModel<E, I>(input: YourEventsInput<E, I>): YourEventsModel<E, I> {
  const invites = input.invitesPending ? (NOTHING as readonly I[]) : input.invites
  const loadedEvents = input.eventsPending ? (NOTHING as readonly E[]) : input.events
  const errorVisible = inviteErrorVisible({
    isAuthenticated: input.isAuthenticated,
    invitesPending: input.invitesPending,
    invitesError: input.invitesError,
    inviteCount: invites.length,
  })
  const visible = yourEventsSectionVisible({
    isAuthenticated: input.isAuthenticated,
    eventCount: loadedEvents.length,
    inviteCount: invites.length,
    inviteErrorVisible: errorVisible,
  })
  if (!visible) {
    return {
      visible: false,
      invites: NOTHING as readonly I[],
      events: NOTHING as readonly E[],
      inviteErrorVisible: false,
      hiddenCount: 0,
      showMoreVisible: false,
      showFewerVisible: false,
    }
  }

  const collapsible = loadedEvents.length > YOUR_EVENTS_COLLAPSED_COUNT
  const events = input.expanded ? loadedEvents : loadedEvents.slice(0, YOUR_EVENTS_COLLAPSED_COUNT)

  return {
    visible: true,
    invites,
    events,
    inviteErrorVisible: errorVisible,
    hiddenCount: loadedEvents.length - events.length,
    showMoreVisible: collapsible && !input.expanded,
    showFewerVisible: collapsible && input.expanded,
  }
}
