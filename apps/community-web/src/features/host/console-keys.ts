export const consoleKeys = {
  page: (eventId: string) => ["host", eventId, "page"] as const,
  slugCheck: (eventId: string, slug: string) =>
    ["host", eventId, "page", "slug-check", slug] as const,
  broadcastsRoot: (eventId: string) => ["host", eventId, "broadcasts"] as const,
  /**
   * The literal "all" keeps this key from equalling the root, so invalidating the list does not
   * also refetch every detail, preview and delivery page.
   */
  broadcasts: (eventId: string) => ["host", eventId, "broadcasts", "all"] as const,
  broadcast: (eventId: string, broadcastId: string) =>
    ["host", eventId, "broadcasts", "detail", broadcastId] as const,
  broadcastPreview: (eventId: string, broadcastId: string) =>
    ["host", eventId, "broadcasts", "preview", broadcastId] as const,
  deliveries: (eventId: string, broadcastId: string, status: string) =>
    ["host", eventId, "broadcasts", "deliveries", broadcastId, status, "all"] as const,
  analytics: (eventId: string, panel: string, range: string) =>
    ["host", eventId, "analytics", panel, range] as const,
  exports: (eventId: string) => ["host", eventId, "exports"] as const,
  rosterRoot: (eventId: string) => ["host", eventId, "roster"] as const,
  roster: (
    eventId: string,
    filter: string,
    sort: string,
    q: string,
    ticketTypeId: string | null,
  ) => ["host", eventId, "roster", "console", filter, sort, q, ticketTypeId ?? "all"] as const,
  answers: (eventId: string, registrationId: string) =>
    ["host", eventId, "answers", registrationId] as const,

  org: (orgId: string) => ["org-console", orgId] as const,
  orgMembers: (orgId: string) => ["org-console", orgId, "members"] as const,
  orgInvites: (orgId: string) => ["org-console", orgId, "invites"] as const,
  orgVerification: (orgId: string) => ["org-console", orgId, "verification"] as const,
} as const
