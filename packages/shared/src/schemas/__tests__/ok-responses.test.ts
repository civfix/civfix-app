import { describe, expect, it } from "vitest"
import { endpoints } from "../../client/endpoints.js"
import {
  DeleteEventBroadcastResponseSchema,
  TestSendEventBroadcastResponseSchema,
  UnsubscribeBroadcastsResponseSchema,
} from "../host/broadcasts.js"
import {
  DeclineMyOrgInviteResponseSchema,
  RemoveOrganizationMemberResponseSchema,
  RevokeOrganizationInviteResponseSchema,
  SetOrganizationMemberRoleResponseSchema,
} from "../host/organizations.js"
import { RecordEventPageViewResponseSchema } from "../host/pages.js"
import {
  RemoveEventRegistrationResponseSchema,
  SetEventRegistrationNoteResponseSchema,
} from "../host/registrations.js"
import { DeclineMyEventInviteResponseSchema, RevokeEventTeamInviteResponseSchema } from "../host/team.js"
import { DeleteEventTicketTypeResponseSchema } from "../host/tickets.js"
import { LeaveEventWaitlistResponseSchema } from "../host/waitlist.js"

const okResponses = {
  DeleteEventBroadcastResponseSchema,
  TestSendEventBroadcastResponseSchema,
  UnsubscribeBroadcastsResponseSchema,
  DeclineMyOrgInviteResponseSchema,
  RemoveOrganizationMemberResponseSchema,
  RevokeOrganizationInviteResponseSchema,
  SetOrganizationMemberRoleResponseSchema,
  RecordEventPageViewResponseSchema,
  RemoveEventRegistrationResponseSchema,
  SetEventRegistrationNoteResponseSchema,
  DeclineMyEventInviteResponseSchema,
  RevokeEventTeamInviteResponseSchema,
  DeleteEventTicketTypeResponseSchema,
  LeaveEventWaitlistResponseSchema,
  leaveReportChat: endpoints.leaveReportChat.response,
  joinReportChat: endpoints.joinReportChat.response,
  removeGroupMember: endpoints.removeGroupMember.response,
}

describe("ok-only responses", () => {
  for (const [name, schema] of Object.entries(okResponses)) {
    it(`${name} accepts ok:true, strips extra keys and rejects anything else`, () => {
      expect(schema.parse({ ok: true })).toEqual({ ok: true })
      expect(schema.parse({ ok: true, extra: 1 })).toEqual({ ok: true })
      expect(schema.safeParse({ ok: false }).success).toBe(false)
      expect(schema.safeParse({}).success).toBe(false)
      expect(schema.safeParse(null).success).toBe(false)
    })
  }
})
