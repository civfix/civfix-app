import type { z } from "zod"
import { systemEndpoints } from "./endpoints/system.js"
import { authEndpoints } from "./endpoints/auth.js"
import { reportEndpoints } from "./endpoints/reports.js"
import { mapEndpoints } from "./endpoints/map.js"
import { cleanupEndpoints } from "./endpoints/cleanups.js"
import { chatEndpoints } from "./endpoints/chat.js"
import { groupEndpoints } from "./endpoints/groups.js"
import { socialEndpoints } from "./endpoints/social.js"
import { postEndpoints } from "./endpoints/posts.js"
import { accountEndpoints } from "./endpoints/account.js"
import { volunteerEndpoints } from "./endpoints/volunteer.js"
import { notificationEndpoints } from "./endpoints/notifications.js"
import { mediaEndpoints } from "./endpoints/media.js"
import { anonClaimEndpoints } from "./endpoints/anon-claim.js"
import { adminAuthEndpoints } from "./endpoints/admin/auth.js"
import { adminOverviewEndpoints } from "./endpoints/admin/overview.js"
import { adminJurisdictionEndpoints } from "./endpoints/admin/jurisdictions.js"
import { adminReportEndpoints, adminReportChatEndpoints } from "./endpoints/admin/reports.js"
import { adminEventEndpoints } from "./endpoints/admin/events.js"
import { adminUserEndpoints } from "./endpoints/admin/users.js"
import { adminModerationEndpoints } from "./endpoints/admin/moderation.js"
import { adminMailEndpoints, adminInboxEndpoints } from "./endpoints/admin/mail.js"
import { adminAnalyticsEndpoints } from "./endpoints/admin/analytics.js"
import { hostAdminEndpoints } from "./endpoints/admin/host-oversight.js"
import { hostOrganizationEndpoints } from "./endpoints/host/organizations.js"
import { hostTeamEndpoints } from "./endpoints/host/team.js"
import { hostTicketEndpoints } from "./endpoints/host/tickets.js"
import { hostRegistrationEndpoints } from "./endpoints/host/registrations.js"
import { hostPageEndpoints } from "./endpoints/host/pages.js"
import { hostCheckinEndpoints } from "./endpoints/host/checkin.js"
import { hostBroadcastEndpoints } from "./endpoints/host/broadcasts.js"
import { hostAnalyticsEndpoints } from "./endpoints/host/analytics.js"

export type { EndpointAuth, EndpointDef, HttpMethod } from "./endpoints/def.js"
export { adminInboxEndpoints, adminReportChatEndpoints, hostAdminEndpoints }

export const coreEndpoints: typeof systemEndpoints &
  typeof authEndpoints &
  typeof reportEndpoints &
  typeof mapEndpoints &
  typeof cleanupEndpoints &
  typeof chatEndpoints &
  typeof groupEndpoints &
  typeof socialEndpoints &
  typeof postEndpoints &
  typeof accountEndpoints &
  typeof volunteerEndpoints &
  typeof notificationEndpoints &
  typeof mediaEndpoints &
  typeof anonClaimEndpoints &
  typeof adminAuthEndpoints &
  typeof adminOverviewEndpoints &
  typeof adminJurisdictionEndpoints &
  typeof adminReportEndpoints &
  typeof adminEventEndpoints &
  typeof adminUserEndpoints &
  typeof adminModerationEndpoints &
  typeof adminMailEndpoints &
  typeof adminAnalyticsEndpoints = {
  ...systemEndpoints,
  ...authEndpoints,
  ...reportEndpoints,
  ...mapEndpoints,
  ...cleanupEndpoints,
  ...chatEndpoints,
  ...groupEndpoints,
  ...socialEndpoints,
  ...postEndpoints,
  ...accountEndpoints,
  ...volunteerEndpoints,
  ...notificationEndpoints,
  ...mediaEndpoints,
  ...anonClaimEndpoints,
  ...adminAuthEndpoints,
  ...adminOverviewEndpoints,
  ...adminJurisdictionEndpoints,
  ...adminReportEndpoints,
  ...adminEventEndpoints,
  ...adminUserEndpoints,
  ...adminModerationEndpoints,
  ...adminMailEndpoints,
  ...adminAnalyticsEndpoints,
}

export const hostEndpoints: typeof hostOrganizationEndpoints &
  typeof hostTeamEndpoints &
  typeof hostTicketEndpoints &
  typeof hostRegistrationEndpoints &
  typeof hostPageEndpoints &
  typeof hostCheckinEndpoints &
  typeof hostBroadcastEndpoints &
  typeof hostAnalyticsEndpoints = {
  ...hostOrganizationEndpoints,
  ...hostTeamEndpoints,
  ...hostTicketEndpoints,
  ...hostRegistrationEndpoints,
  ...hostPageEndpoints,
  ...hostCheckinEndpoints,
  ...hostBroadcastEndpoints,
  ...hostAnalyticsEndpoints,
}

export const endpoints: typeof coreEndpoints &
  typeof hostEndpoints &
  typeof hostAdminEndpoints &
  typeof adminReportChatEndpoints &
  typeof adminInboxEndpoints = {
  ...coreEndpoints,
  ...hostEndpoints,
  ...hostAdminEndpoints,
  ...adminReportChatEndpoints,
  ...adminInboxEndpoints,
}

export type Endpoints = typeof endpoints
export type EndpointName = keyof Endpoints

export type RequestOf<N extends EndpointName> = Endpoints[N]["request"] extends z.ZodTypeAny
  ? z.infer<Endpoints[N]["request"]>
  : never

export type ResponseOf<N extends EndpointName> = z.infer<Endpoints[N]["response"]>
