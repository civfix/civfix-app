import { describe, it, expect } from "vitest"
import * as root from "../src/index.js"
import * as host from "../src/host/index.js"
import {
  ANON_REPORT_TURNSTILE_ACTION,
  CancelCleanupRequestSchema,
  CHAT_GROUP_DESCRIPTION_MAX,
  CHAT_GROUP_NAME_MAX,
  CreateChatGroupRequestSchema,
  CreateCleanupRequestSchema,
  CreatePollRequestSchema,
  CreateReportRequestSchema,
  DeleteAccountRequestSchema,
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  EMAIL_OTP_CODE_LENGTH,
  EVENT_PAGE_BLOCK_LIMITS,
  EventPageBlockSchema,
  EventQuestionDefSchema,
  GUEST_RSVP_TURNSTILE_ACTION,
  GuestRsvpRequestRequestSchema,
  HANDLE_MAX_LENGTH,
  HANDLE_REGEX,
  HOME_TURF_TURNSTILE_ACTION,
  InviteOrganizationMemberRequestSchema,
  ApplyOrganizationVerificationRequestSchema,
  HostEventEmailSchema,
  HTTPS_URL_MAX_LENGTH,
  HttpsUrlSchema,
  LeaderboardQuerySchema,
  LocaleEnum,
  MAX_CONSENT_TEXT,
  MAX_EVENT_CANCEL_REASON,
  MAX_EVENT_DESCRIPTION,
  MAX_EVENT_RESOURCES_MESSAGE,
  MAX_EVENT_TITLE,
  MAX_LEADERBOARD_OFFSET,
  MAX_ORG_VERIFICATION_NOTE,
  MAX_QUESTION_OPTION_VALUE,
  MAX_REPORT_DESCRIPTION_LENGTH,
  MAX_REPORT_MEDIA,
  MAX_REPORT_TITLE_LENGTH,
  OtpCodeSchema,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  RequestEventResourcesRequestSchema,
  SOCIAL_HANDLE_MAX_LENGTH,
  SOCIAL_HANDLE_PREFIX,
  SOCIAL_PLATFORMS,
  SocialLinksSchema,
  SupportedLocaleSchema,
  UpdateCleanupRequestSchema,
  UpdateChatGroupRequestSchema,
  UpdateProfileRequestSchema,
  VotePollRequestSchema,
  WHATSAPP_NUMBER_MAX_LENGTH,
  WS_CLIENT_ID_MAX,
  WsClientMessageSchema,
  WsErrorCode,
  WsServerMessageSchema,
} from "../src/index.js"

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function email(length: number): string {
  const domain = "@example.org"
  return `${"a".repeat(length - domain.length)}${domain}`
}

function httpsUrl(length: number): string {
  const prefix = "https://example.org/"
  return `${prefix}${"a".repeat(length - prefix.length)}`
}

describe("exported contract limits are the schema boundaries", () => {
  it("EMAIL_MAX_LENGTH caps host event, guest and org-invite emails", () => {
    expect(EMAIL_MAX_LENGTH).toBe(254)
    expect(HostEventEmailSchema.safeParse(email(EMAIL_MAX_LENGTH)).success).toBe(true)
    expect(HostEventEmailSchema.safeParse(email(EMAIL_MAX_LENGTH + 1)).success).toBe(false)
    const invite = (identifier: string) =>
      InviteOrganizationMemberRequestSchema.safeParse({ id: ID, identifierKind: "email", identifier, role: "member" })
        .success
    expect(invite(email(EMAIL_MAX_LENGTH))).toBe(true)
    expect(invite(email(EMAIL_MAX_LENGTH + 1))).toBe(false)
    const guest = (value: string) =>
      GuestRsvpRequestRequestSchema.safeParse({
        id: ID,
        name: "Guest",
        channel: "email",
        email: value,
        turnstileToken: "tok",
      }).success
    expect(guest(email(EMAIL_MAX_LENGTH))).toBe(true)
    expect(guest(email(EMAIL_MAX_LENGTH + 1))).toBe(false)
  })

  it("HTTPS_URL_MAX_LENGTH caps HttpsUrlSchema", () => {
    expect(HTTPS_URL_MAX_LENGTH).toBe(500)
    expect(HttpsUrlSchema.safeParse(httpsUrl(HTTPS_URL_MAX_LENGTH)).success).toBe(true)
    expect(HttpsUrlSchema.safeParse(httpsUrl(HTTPS_URL_MAX_LENGTH + 1)).success).toBe(false)
  })

  it("HANDLE_MAX_LENGTH is the handle pattern's upper bound, with the pattern text unchanged", () => {
    expect(HANDLE_MAX_LENGTH).toBe(20)
    expect(HANDLE_REGEX.source).toBe("^[a-zA-Z0-9_]{3,20}$")
    expect(HANDLE_REGEX.flags).toBe("")
    expect(HANDLE_REGEX.test("a".repeat(HANDLE_MAX_LENGTH))).toBe(true)
    expect(HANDLE_REGEX.test("a".repeat(HANDLE_MAX_LENGTH + 1))).toBe(false)
  })

  it("DISPLAY_NAME_MAX_LENGTH caps the profile display name", () => {
    const profile = (displayName: string) =>
      UpdateProfileRequestSchema.safeParse({ handle: "jane_doe", displayName }).success
    expect(DISPLAY_NAME_MAX_LENGTH).toBe(80)
    expect(profile("a".repeat(DISPLAY_NAME_MAX_LENGTH))).toBe(true)
    expect(profile("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(false)
  })

  it("social handle and WhatsApp caps bound SocialLinksSchema", () => {
    const links = (value: Record<string, string>) => SocialLinksSchema.safeParse(value).success
    expect(SOCIAL_HANDLE_MAX_LENGTH).toBe(30)
    expect(WHATSAPP_NUMBER_MAX_LENGTH).toBe(15)
    expect(links({ instagram: "a".repeat(SOCIAL_HANDLE_MAX_LENGTH) })).toBe(true)
    expect(links({ instagram: "a".repeat(SOCIAL_HANDLE_MAX_LENGTH + 1) })).toBe(false)
    expect(links({ whatsapp: `1${"2".repeat(WHATSAPP_NUMBER_MAX_LENGTH - 1)}` })).toBe(true)
    expect(links({ whatsapp: `1${"2".repeat(WHATSAPP_NUMBER_MAX_LENGTH)}` })).toBe(false)
    expect(links({ whatsapp: "1234567" })).toBe(true)
    expect(links({ whatsapp: "123456" })).toBe(false)
    expect(links({ whatsapp: "0234567" })).toBe(false)
  })

  it("SOCIAL_HANDLE_PREFIX has one display prefix per platform", () => {
    expect(Object.keys(SOCIAL_HANDLE_PREFIX).sort()).toEqual([...SOCIAL_PLATFORMS].sort())
    expect(SOCIAL_HANDLE_PREFIX.tiktok).toBe("tiktok.com/@")
    expect(SOCIAL_HANDLE_PREFIX.whatsapp).toBe("+")
  })

  it("EMAIL_OTP_CODE_LENGTH is the numeric OTP length for sign-in and account deletion", () => {
    expect(EMAIL_OTP_CODE_LENGTH).toBe(6)
    const digits = (n: number) => "1".repeat(n)
    expect(OtpCodeSchema.safeParse(digits(EMAIL_OTP_CODE_LENGTH)).success).toBe(true)
    expect(OtpCodeSchema.safeParse(digits(EMAIL_OTP_CODE_LENGTH - 1)).success).toBe(false)
    expect(OtpCodeSchema.safeParse(digits(EMAIL_OTP_CODE_LENGTH + 1)).success).toBe(false)
    const del = (emailOtp: string) => DeleteAccountRequestSchema.safeParse({ emailOtp }).success
    expect(del(digits(EMAIL_OTP_CODE_LENGTH))).toBe(true)
    expect(del(digits(EMAIL_OTP_CODE_LENGTH + 1))).toBe(false)
    expect(del("12345a")).toBe(false)
  })

  it("poll bounds bound CreatePollRequest and VotePollRequest", () => {
    const poll = (question: string, options: string[]) =>
      CreatePollRequestSchema.safeParse({ roomKind: "group", roomId: ID, question, options }).success
    const two = ["a", "b"]
    expect([POLL_QUESTION_MAX, POLL_OPTION_MAX, POLL_MIN_OPTIONS, POLL_MAX_OPTIONS]).toEqual([300, 100, 2, 10])
    expect(poll("q".repeat(POLL_QUESTION_MAX), two)).toBe(true)
    expect(poll("q".repeat(POLL_QUESTION_MAX + 1), two)).toBe(false)
    expect(poll("q", ["o".repeat(POLL_OPTION_MAX), "b"])).toBe(true)
    expect(poll("q", ["o".repeat(POLL_OPTION_MAX + 1), "b"])).toBe(false)
    expect(poll("q", Array.from({ length: POLL_MIN_OPTIONS - 1 }, () => "a"))).toBe(false)
    expect(poll("q", Array.from({ length: POLL_MAX_OPTIONS }, () => "a"))).toBe(true)
    expect(poll("q", Array.from({ length: POLL_MAX_OPTIONS + 1 }, () => "a"))).toBe(false)
    const vote = (optionIdxs: number[]) => VotePollRequestSchema.safeParse({ messageId: ID, optionIdxs }).success
    expect(vote([POLL_MAX_OPTIONS - 1])).toBe(true)
    expect(vote([POLL_MAX_OPTIONS])).toBe(false)
  })

  it("chat group caps bound create and update", () => {
    expect([CHAT_GROUP_NAME_MAX, CHAT_GROUP_DESCRIPTION_MAX]).toEqual([80, 500])
    const create = (name: string, description: string) =>
      CreateChatGroupRequestSchema.safeParse({ name, description }).success
    expect(create("n".repeat(CHAT_GROUP_NAME_MAX), "d".repeat(CHAT_GROUP_DESCRIPTION_MAX))).toBe(true)
    expect(create("n".repeat(CHAT_GROUP_NAME_MAX + 1), "")).toBe(false)
    expect(create("n", "d".repeat(CHAT_GROUP_DESCRIPTION_MAX + 1))).toBe(false)
    const update = (name: string) => UpdateChatGroupRequestSchema.safeParse({ id: ID, name }).success
    expect(update("n".repeat(CHAT_GROUP_NAME_MAX))).toBe(true)
    expect(update("n".repeat(CHAT_GROUP_NAME_MAX + 1))).toBe(false)
  })

  it("report caps bound CreateReportRequest", () => {
    const report = (fields: Record<string, unknown>) =>
      CreateReportRequestSchema.safeParse({
        idempotencyKey: ID,
        category: "trash",
        type: "dump",
        lat: 34,
        lng: -118,
        geomSource: "device",
        mediaUploadIds: [],
        ...fields,
      }).success
    expect([MAX_REPORT_TITLE_LENGTH, MAX_REPORT_DESCRIPTION_LENGTH, MAX_REPORT_MEDIA]).toEqual([120, 2000, 5])
    expect(report({})).toBe(true)
    expect(report({ title: "t".repeat(MAX_REPORT_TITLE_LENGTH) })).toBe(true)
    expect(report({ title: "t".repeat(MAX_REPORT_TITLE_LENGTH + 1) })).toBe(false)
    expect(report({ description: "d".repeat(MAX_REPORT_DESCRIPTION_LENGTH) })).toBe(true)
    expect(report({ description: "d".repeat(MAX_REPORT_DESCRIPTION_LENGTH + 1) })).toBe(false)
    expect(report({ mediaUploadIds: Array.from({ length: MAX_REPORT_MEDIA }, () => ID) })).toBe(true)
    expect(report({ mediaUploadIds: Array.from({ length: MAX_REPORT_MEDIA + 1 }, () => ID) })).toBe(false)
  })

  it("event caps bound create, update, cancel and the resources request", () => {
    expect([MAX_EVENT_TITLE, MAX_EVENT_DESCRIPTION, MAX_EVENT_CANCEL_REASON, MAX_EVENT_RESOURCES_MESSAGE]).toEqual([
      120, 2000, 500, 2000,
    ])
    const update = (fields: Record<string, unknown>) =>
      UpdateCleanupRequestSchema.safeParse({ id: ID, ...fields }).success
    expect(update({ title: "t".repeat(MAX_EVENT_TITLE) })).toBe(true)
    expect(update({ title: "t".repeat(MAX_EVENT_TITLE + 1) })).toBe(false)
    expect(update({ description: "d".repeat(MAX_EVENT_DESCRIPTION) })).toBe(true)
    expect(update({ description: "d".repeat(MAX_EVENT_DESCRIPTION + 1) })).toBe(false)
    expect(CreateCleanupRequestSchema.shape.title.maxLength).toBe(MAX_EVENT_TITLE)
    const cancel = (reason: string) => CancelCleanupRequestSchema.safeParse({ id: ID, reason }).success
    expect(cancel("r".repeat(MAX_EVENT_CANCEL_REASON))).toBe(true)
    expect(cancel("r".repeat(MAX_EVENT_CANCEL_REASON + 1))).toBe(false)
    const resources = (message: string) =>
      RequestEventResourcesRequestSchema.safeParse({ id: ID, message }).success
    expect(resources("m".repeat(MAX_EVENT_RESOURCES_MESSAGE))).toBe(true)
    expect(resources("m".repeat(MAX_EVENT_RESOURCES_MESSAGE + 1))).toBe(false)
  })

  it("EVENT_PAGE_BLOCK_LIMITS bound the page block fields", () => {
    const block = (value: Record<string, unknown>) => EventPageBlockSchema.safeParse({ id: "b1", ...value }).success
    const L = EVENT_PAGE_BLOCK_LIMITS
    const text = (n: number) => "x".repeat(n)
    expect(block({ kind: "hero", headline: text(L.heroHeadline), subhead: text(L.heroSubhead) })).toBe(true)
    expect(block({ kind: "hero", headline: text(L.heroHeadline + 1) })).toBe(false)
    expect(block({ kind: "hero", subhead: text(L.heroSubhead + 1) })).toBe(false)
    expect(block({ kind: "location", title: text(L.title), note: text(L.text) })).toBe(true)
    expect(block({ kind: "location", title: text(L.title + 1) })).toBe(false)
    expect(block({ kind: "location", note: text(L.text + 1) })).toBe(false)
    const agendaItem = { time: text(L.agendaTime), title: text(L.agendaItemTitle), description: text(L.rowDescription) }
    expect(block({ kind: "agenda", items: Array.from({ length: L.agendaItems }, () => agendaItem) })).toBe(true)
    expect(block({ kind: "agenda", items: Array.from({ length: L.agendaItems + 1 }, () => agendaItem) })).toBe(false)
    expect(block({ kind: "agenda", items: [{ ...agendaItem, time: text(L.agendaTime + 1) }] })).toBe(false)
    expect(block({ kind: "agenda", items: [{ ...agendaItem, title: text(L.agendaItemTitle + 1) }] })).toBe(false)
    expect(block({ kind: "agenda", items: [{ ...agendaItem, description: text(L.rowDescription + 1) }] })).toBe(false)
    const hostEntry = { name: text(L.entryName), role: text(L.hostRole), bio: text(L.rowDescription) }
    expect(block({ kind: "hosts", entries: Array.from({ length: L.hostEntries }, () => hostEntry) })).toBe(true)
    expect(block({ kind: "hosts", entries: Array.from({ length: L.hostEntries + 1 }, () => hostEntry) })).toBe(false)
    expect(block({ kind: "hosts", entries: [{ ...hostEntry, name: text(L.entryName + 1) }] })).toBe(false)
    expect(block({ kind: "hosts", entries: [{ ...hostEntry, role: text(L.hostRole + 1) }] })).toBe(false)
    expect(block({ kind: "hosts", entries: [{ ...hostEntry, bio: text(L.rowDescription + 1) }] })).toBe(false)
    const faq = { question: text(L.faqQuestion), answer: text(L.text) }
    expect(block({ kind: "faq", items: Array.from({ length: L.faqItems }, () => faq) })).toBe(true)
    expect(block({ kind: "faq", items: Array.from({ length: L.faqItems + 1 }, () => faq) })).toBe(false)
    expect(block({ kind: "faq", items: [{ ...faq, question: text(L.faqQuestion + 1) }] })).toBe(false)
    expect(block({ kind: "faq", items: [{ ...faq, answer: text(L.text + 1) }] })).toBe(false)
    const sponsor = { name: text(L.entryName) }
    expect(block({ kind: "sponsors", entries: Array.from({ length: L.sponsorEntries }, () => sponsor) })).toBe(true)
    expect(block({ kind: "sponsors", entries: Array.from({ length: L.sponsorEntries + 1 }, () => sponsor) })).toBe(
      false,
    )
    expect(block({ kind: "donate", blurb: text(L.text + 1) })).toBe(false)
    expect(block({ kind: "registration", note: text(L.text + 1) })).toBe(false)
    expect(block({ kind: "contact", body: text(L.text + 1) })).toBe(false)
  })

  it("MAX_ORG_VERIFICATION_NOTE caps the verification note", () => {
    const submit = (note: string) =>
      ApplyOrganizationVerificationRequestSchema.safeParse({ id: ID, kind: "community", note }).success
    expect(MAX_ORG_VERIFICATION_NOTE).toBe(1000)
    expect(submit("n".repeat(MAX_ORG_VERIFICATION_NOTE))).toBe(true)
    expect(submit("n".repeat(MAX_ORG_VERIFICATION_NOTE + 1))).toBe(false)
  })

  it("MAX_CONSENT_TEXT and MAX_QUESTION_OPTION_VALUE bound the question definitions", () => {
    expect([MAX_CONSENT_TEXT, MAX_QUESTION_OPTION_VALUE]).toEqual([2000, 80])
    const consent = (consentText: string) =>
      EventQuestionDefSchema.safeParse({ kind: "consent", prompt: "Agree?", consentText }).success
    expect(consent("c".repeat(MAX_CONSENT_TEXT))).toBe(true)
    expect(consent("c".repeat(MAX_CONSENT_TEXT + 1))).toBe(false)
    const choice = (value: string) =>
      EventQuestionDefSchema.safeParse({
        kind: "single_select",
        prompt: "Pick",
        options: [{ value, label: "One" }],
      }).success
    expect(choice("v".repeat(MAX_QUESTION_OPTION_VALUE))).toBe(true)
    expect(choice("v".repeat(MAX_QUESTION_OPTION_VALUE + 1))).toBe(false)
  })

  it("MAX_LEADERBOARD_OFFSET caps the leaderboard offset", () => {
    const board = (offset: number) => LeaderboardQuerySchema.safeParse({ geoid: "06037", offset }).success
    expect(MAX_LEADERBOARD_OFFSET).toBe(500)
    expect(board(MAX_LEADERBOARD_OFFSET)).toBe(true)
    expect(board(MAX_LEADERBOARD_OFFSET + 1)).toBe(false)
  })

  it("WS_CLIENT_ID_MAX caps the send frame's clientId", () => {
    const send = (clientId: string) =>
      WsClientMessageSchema.safeParse({ type: "send", cleanupId: ID, clientId, body: "hi" }).success
    expect(WS_CLIENT_ID_MAX).toBe(64)
    expect(send("c".repeat(WS_CLIENT_ID_MAX))).toBe(true)
    expect(send("c".repeat(WS_CLIENT_ID_MAX + 1))).toBe(false)
  })
})

describe("WsErrorCode", () => {
  it("names the socket-only codes the server sends", () => {
    expect(Object.values(WsErrorCode).sort()).toEqual(
      ["BAD_FRAME", "BLOCKED", "channel_read_only", "reply_deleted_target", "reply_wrong_room"].sort(),
    )
  })

  it("keeps the error frame open to any string code, known or not", () => {
    for (const code of [...Object.values(WsErrorCode), "FORBIDDEN", "some_future_code", ""]) {
      const parsed = WsServerMessageSchema.safeParse({ type: "error", code, message: "no", cleanupId: ID2 })
      expect(parsed.success, code).toBe(true)
      if (parsed.success && parsed.data.type === "error") expect(parsed.data.code).toBe(code)
    }
    expect(WsServerMessageSchema.safeParse({ type: "error", code: 7, message: "no" }).success).toBe(false)
  })
})

describe("turnstile actions", () => {
  it("are the action strings the backend verifies, exported from both the root and /host", () => {
    expect([GUEST_RSVP_TURNSTILE_ACTION, ANON_REPORT_TURNSTILE_ACTION, HOME_TURF_TURNSTILE_ACTION]).toEqual([
      "guest-rsvp",
      "anon-report",
      "home-turf",
    ])
    expect(host.ANON_REPORT_TURNSTILE_ACTION).toBe(ANON_REPORT_TURNSTILE_ACTION)
    expect(host.HOME_TURF_TURNSTILE_ACTION).toBe(HOME_TURF_TURNSTILE_ACTION)
  })
})

describe("SupportedLocaleSchema", () => {
  it("is the same schema as LocaleEnum", () => {
    expect(SupportedLocaleSchema).toBe(LocaleEnum)
    expect(root.SupportedLocaleSchema.options).toEqual(["en", "es", "de", "ko"])
  })
})

describe("guest registration refusal reasons", () => {
  it("names the field and the reasons the backend refuses a guest registration with", async () => {
    const { GUEST_REGISTRATION_ERROR_FIELD, GuestRegistrationRefusalReason } = await import("../src/index.js")
    expect(GUEST_REGISTRATION_ERROR_FIELD).toBe("registration")
    expect(Object.values(GuestRegistrationRefusalReason).sort()).toEqual([
      "access_code_invalid",
      "access_code_required",
      "answers_invalid",
      "event_closed",
      "party_too_large",
      "registration_closed",
      "sales_closed",
      "sold_out",
      "ticket_type_unavailable",
    ])
  })
})
