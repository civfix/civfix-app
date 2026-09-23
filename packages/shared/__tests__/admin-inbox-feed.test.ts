import { describe, it, expect } from "vitest"
import {
  MAIL_AUTH_VERDICT_LABELS,
  MAIL_REPLY_PUBLICATION_LABELS,
  MailAuthVerdictSchema,
  MailReplyPublicationSchema,
} from "../src/schemas/admin/common.js"
import {
  MailMessageDTOSchema,
  PublishMailReplyRequestSchema,
  PublishMailReplyResponseSchema,
} from "../src/schemas/admin/mail.js"
import {
  INBOX_FEED_FILTER_LABELS,
  InboundEmailDTOSchema,
  InboxFeedFilterSchema,
  InboxFeedQuerySchema,
  InboxFeedResponseSchema,
} from "../src/schemas/admin/inbox.js"
import { endpoints } from "../src/client/endpoints.js"

const THREAD = "123e4567-e89b-12d3-a456-426614174000"
const MESSAGE = "223e4567-e89b-12d3-a456-426614174000"

const emailItem = {
  source: "email",
  id: "IN-1",
  from: "resident@example.com",
  recipient: "support@civfix.org",
  localPart: "support",
  subject: "Question",
  preview: "Hello there",
  ts: "2026-09-22T18:00:00.000Z",
  status: "unread",
  unread: true,
  hasAttachments: false,
  authVerdict: "unknown",
}

const replyItem = {
  source: "reply",
  id: MESSAGE,
  threadId: THREAD,
  reportId: "REP-1",
  cleanupId: null,
  org: "City of Waynesboro",
  from: "streets@waynesboro.gov",
  subject: "Re: [civfix: CF-1] Trash pile",
  preview: "A crew is scheduled for Thursday.",
  ts: "2026-09-22T19:00:00.000Z",
  unread: true,
  threadStatus: "needs_action",
  hasAttachments: false,
  authVerdict: "fail",
  publication: "withheld",
}

const message = {
  id: MESSAGE,
  who: "Streets",
  from: "streets@waynesboro.gov",
  to: "report-abc@civfix.org",
  dir: "in",
  body: "A crew is scheduled for Thursday.",
  ts: "2026-09-22T19:00:00.000Z",
  attachments: [],
}

describe("admin inbox feed contract", () => {
  it("pages email and reply items under one cursor", () => {
    const page = InboxFeedResponseSchema.parse({ items: [emailItem, replyItem], nextCursor: null })
    expect(page.items.map((item) => item.source)).toEqual(["email", "reply"])
  })

  it("rejects an unknown source and any extra key on either item", () => {
    expect(InboxFeedResponseSchema.safeParse({ items: [{ ...replyItem, source: "sms" }], nextCursor: null }).success).toBe(false)
    expect(InboxFeedResponseSchema.safeParse({ items: [{ ...emailItem, threadId: THREAD }], nextCursor: null }).success).toBe(false)
    expect(InboxFeedResponseSchema.safeParse({ items: [{ ...replyItem, status: "unread" }], nextCursor: null }).success).toBe(false)
  })

  it("keeps the verdict and publication optional on the existing mail and inbox DTOs", () => {
    expect(MailMessageDTOSchema.parse(message).authVerdict).toBeUndefined()
    expect(MailMessageDTOSchema.parse({ ...message, authVerdict: null, publication: null })).toMatchObject({
      authVerdict: null,
      publication: null,
    })
    expect(MailMessageDTOSchema.parse({ ...message, authVerdict: "pass", publication: "published" }).publication).toBe("published")
    const { source: _source, ...listItem } = emailItem
    const detail = { ...listItem, bodyText: "Hello there", bodyHtml: null, messageId: null, attachments: [] }
    expect(InboundEmailDTOSchema.parse(detail).authVerdict).toBe("unknown")
    const { authVerdict: _verdict, ...legacy } = detail
    expect(InboundEmailDTOSchema.parse(legacy).authVerdict).toBeUndefined()
  })

  it("validates the publish request and response", () => {
    expect(PublishMailReplyRequestSchema.parse({ id: THREAD, messageId: MESSAGE })).toEqual({ id: THREAD, messageId: MESSAGE })
    expect(PublishMailReplyRequestSchema.safeParse({ id: THREAD, messageId: "MSG-1" }).success).toBe(false)
    expect(PublishMailReplyRequestSchema.safeParse({ id: THREAD, messageId: MESSAGE, force: true }).success).toBe(false)
    expect(PublishMailReplyResponseSchema.parse({ publication: "pending" })).toEqual({ publication: "pending" })
    expect(PublishMailReplyResponseSchema.safeParse({ publication: "sent" }).success).toBe(false)
  })

  it("filters by a known facet and coerces the page size", () => {
    expect(InboxFeedQuerySchema.parse({ filter: "review", limit: "25" })).toEqual({ filter: "review", limit: 25 })
    expect(InboxFeedQuerySchema.safeParse({ filter: "bogus" }).success).toBe(false)
  })

  it("labels every verdict, publication state and feed filter", () => {
    for (const verdict of MailAuthVerdictSchema.options) expect(MAIL_AUTH_VERDICT_LABELS[verdict]).toBeTruthy()
    for (const state of MailReplyPublicationSchema.options) expect(MAIL_REPLY_PUBLICATION_LABELS[state]).toBeTruthy()
    for (const filter of InboxFeedFilterSchema.options) expect(INBOX_FEED_FILTER_LABELS[filter]).toBeTruthy()
  })

  it("registers the feed read and the csrf-guarded publish under /admin", () => {
    expect(endpoints.listInboxFeed).toMatchObject({ method: "GET", path: "/admin/inbox/feed", auth: "required", csrf: false })
    expect(endpoints.listInboxFeed.request).toBe(InboxFeedQuerySchema)
    expect(endpoints.publishMailReply).toMatchObject({
      method: "POST",
      path: "/admin/mail/:id/messages/:messageId/publish",
      auth: "required",
      csrf: true,
      version: "v1",
    })
    expect(endpoints.publishMailReply.request).toBe(PublishMailReplyRequestSchema)
  })
})
