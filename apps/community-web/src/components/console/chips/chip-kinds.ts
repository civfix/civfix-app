import type {
  BroadcastChannel,
  BroadcastKind,
  BroadcastStatus,
  CheckinMethod,
  CleanupMemberRole,
  CleanupStatus,
  DeliveryStatus,
  EventPageStatus,
  EventVisibility,
  HostExportStatus,
  OrganizationMemberRole,
  OrgVerificationStatus,
  RegistrantKind,
  RegistrationState,
  RegistrationStatus,
  SeatStatus,
  TicketTypeVisibility,
  WaitlistStatus,
} from "@civfix/shared"
import type { LucideIcon } from "lucide-react"
import {
  Ban,
  BadgeCheck,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Check,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleHelp,
  CircleOff,
  CirclePause,
  CircleSlash,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Globe,
  HandHeart,
  Hourglass,
  KeyRound,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  PartyPopper,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TicketCheck,
  TriangleAlert,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react"

export type ChipHue = "sky" | "moss" | "sun" | "bloom" | "lilac" | "neutral" | "muted"

export interface ChipKindEntry {
  hue: ChipHue
  icon: LucideIcon
  labelKey: string
  outline?: boolean
  bold?: boolean
}

export const CHIP_HUE_CLASSES: Record<ChipHue, string> = {
  sky: "bg-console-sky-soft text-console-sky-strong",
  moss: "bg-console-moss-soft text-console-moss-strong",
  sun: "bg-console-sun-soft text-console-sun-strong",
  bloom: "bg-console-bloom-soft text-console-bloom-strong",
  lilac: "bg-console-lilac-soft text-console-lilac-strong",
  neutral: "bg-console-surface-alt text-console-ink-2",
  muted: "bg-console-tint text-console-ink-2",
}

export const CHIP_HUE_OUTLINE_CLASSES: Record<ChipHue, string> = {
  sky: "bg-console-surface text-console-sky-strong",
  moss: "bg-console-surface text-console-moss-strong",
  sun: "bg-console-surface text-console-sun-strong",
  bloom: "bg-console-surface text-console-bloom-strong",
  lilac: "bg-console-surface text-console-lilac-strong",
  neutral: "bg-console-surface text-console-ink-2",
  muted: "bg-console-surface text-console-ink-2",
}

const registrationStatus = {
  registered: { hue: "moss", icon: CircleCheck, labelKey: "enums:registrationStatus.registered" },
  cancelled: { hue: "bloom", icon: X, labelKey: "enums:registrationStatus.cancelled" },
  transferred: { hue: "sky", icon: RefreshCw, labelKey: "enums:registrationStatus.transferred" },
} satisfies Record<RegistrationStatus, ChipKindEntry>

const seatStatus = {
  active: { hue: "moss", icon: CircleCheck, labelKey: "enums:seatStatus.active" },
  cancelled: { hue: "bloom", icon: X, labelKey: "enums:seatStatus.cancelled" },
} satisfies Record<SeatStatus, ChipKindEntry>

const checkinMethod = {
  scan: { hue: "sky", icon: TicketCheck, labelKey: "enums:checkinMethod.scan", outline: true },
  manual: { hue: "neutral", icon: Pencil, labelKey: "enums:checkinMethod.manual", outline: true },
  self: { hue: "neutral", icon: UserCheck, labelKey: "enums:checkinMethod.self", outline: true },
  walkup: { hue: "sun", icon: UserPlus, labelKey: "enums:checkinMethod.walkup", outline: true },
} satisfies Record<CheckinMethod, ChipKindEntry>

const waitlistStatus = {
  waiting: { hue: "sun", icon: Hourglass, labelKey: "enums:waitlistStatus.waiting" },
  offered: { hue: "sky", icon: Bell, labelKey: "enums:waitlistStatus.offered" },
  claimed: { hue: "moss", icon: Check, labelKey: "enums:waitlistStatus.claimed" },
  expired: { hue: "neutral", icon: Clock, labelKey: "enums:waitlistStatus.expired" },
  cancelled: { hue: "bloom", icon: X, labelKey: "enums:waitlistStatus.cancelled" },
} satisfies Record<WaitlistStatus, ChipKindEntry>

const ticketVisibility = {
  public: { hue: "moss", icon: Globe, labelKey: "enums:ticketTypeVisibility.public" },
  hidden: { hue: "neutral", icon: EyeOff, labelKey: "enums:ticketTypeVisibility.hidden" },
  access_code: { hue: "lilac", icon: KeyRound, labelKey: "enums:ticketTypeVisibility.access_code" },
} satisfies Record<TicketTypeVisibility, ChipKindEntry>

const eventVisibility = {
  public: { hue: "moss", icon: Globe, labelKey: "enums:eventVisibility.public" },
  unlisted: { hue: "sun", icon: Eye, labelKey: "enums:eventVisibility.unlisted" },
  private: { hue: "neutral", icon: Lock, labelKey: "enums:eventVisibility.private" },
} satisfies Record<EventVisibility, ChipKindEntry>

const pageState = {
  draft: { hue: "neutral", icon: FileText, labelKey: "enums:eventPageStatus.draft" },
  published: { hue: "moss", icon: Globe, labelKey: "enums:eventPageStatus.published" },
  unpublished: { hue: "sun", icon: EyeOff, labelKey: "enums:eventPageStatus.unpublished" },
} satisfies Record<EventPageStatus, ChipKindEntry>

const registrationState = {
  open: { hue: "moss", icon: CircleCheck, labelKey: "enums:registrationState.open" },
  not_yet_open: { hue: "sky", icon: CalendarClock, labelKey: "enums:registrationState.not_yet_open" },
  closed: { hue: "neutral", icon: CircleSlash, labelKey: "enums:registrationState.closed" },
  full: { hue: "sun", icon: Users, labelKey: "enums:registrationState.full" },
  waitlist: { hue: "sun", icon: Hourglass, labelKey: "enums:registrationState.waitlist" },
} satisfies Record<RegistrationState, ChipKindEntry>

const eventStatus = {
  upcoming: { hue: "sky", icon: CalendarClock, labelKey: "enums:eventStatus.upcoming" },
  active: { hue: "moss", icon: CircleDot, labelKey: "enums:eventStatus.active" },
  done: { hue: "neutral", icon: CheckCheck, labelKey: "enums:eventStatus.done" },
  cancelled: { hue: "bloom", icon: CalendarX, labelKey: "enums:eventStatus.cancelled" },
} satisfies Record<CleanupStatus, ChipKindEntry>

const teamRole = {
  organizer: { hue: "lilac", icon: ShieldCheck, labelKey: "enums:cleanupMemberRole.organizer" },
  cohost: { hue: "sky", icon: UserCog, labelKey: "enums:cleanupMemberRole.cohost" },
  coordinator: { hue: "sun", icon: ClipboardList, labelKey: "enums:cleanupMemberRole.coordinator" },
  staff: { hue: "moss", icon: BadgeCheck, labelKey: "enums:cleanupMemberRole.staff" },
  member: { hue: "neutral", icon: Users, labelKey: "enums:cleanupMemberRole.member" },
} satisfies Record<CleanupMemberRole, ChipKindEntry>

const orgRole = {
  owner: { hue: "lilac", icon: ShieldCheck, labelKey: "enums:organizationMemberRole.owner" },
  admin: { hue: "sky", icon: UserCog, labelKey: "enums:organizationMemberRole.admin" },
  member: { hue: "neutral", icon: Users, labelKey: "enums:organizationMemberRole.member" },
} satisfies Record<OrganizationMemberRole, ChipKindEntry>

const orgVerification = {
  unverified: { hue: "neutral", icon: CircleDashed, labelKey: "enums:orgVerificationStatus.unverified" },
  pending: { hue: "sun", icon: Hourglass, labelKey: "enums:orgVerificationStatus.pending" },
  verified: { hue: "moss", icon: BadgeCheck, labelKey: "enums:orgVerificationStatus.verified" },
  rejected: { hue: "bloom", icon: Ban, labelKey: "enums:orgVerificationStatus.rejected" },
} satisfies Record<OrgVerificationStatus, ChipKindEntry>

const attendeeKind = {
  member: { hue: "sky", icon: UserCheck, labelKey: "enums:attendeeKind.member", outline: true },
  guest: { hue: "neutral", icon: Users, labelKey: "enums:attendeeKind.guest", outline: true },
} satisfies Record<RegistrantKind, ChipKindEntry>

const broadcastStatus = {
  draft: { hue: "neutral", icon: Pencil, labelKey: "enums:broadcastStatus.draft" },
  scheduled: { hue: "sky", icon: CalendarCheck, labelKey: "enums:broadcastStatus.scheduled" },
  sending: { hue: "sun", icon: Send, labelKey: "enums:broadcastStatus.sending" },
  sent: { hue: "moss", icon: CheckCheck, labelKey: "enums:broadcastStatus.sent" },
  cancelled: { hue: "neutral", icon: CircleOff, labelKey: "enums:broadcastStatus.cancelled" },
  failed: { hue: "bloom", icon: TriangleAlert, labelKey: "enums:broadcastStatus.failed", bold: true },
} satisfies Record<BroadcastStatus, ChipKindEntry>

const broadcastKind = {
  host_broadcast: { hue: "lilac", icon: Megaphone, labelKey: "enums:broadcastKind.host_broadcast" },
  announcement: { hue: "sky", icon: Megaphone, labelKey: "enums:broadcastKind.announcement" },
  confirmation: { hue: "moss", icon: CircleCheck, labelKey: "enums:broadcastKind.confirmation" },
  waitlist_promoted: { hue: "sky", icon: Bell, labelKey: "enums:broadcastKind.waitlist_promoted" },
  reminder: { hue: "sun", icon: Clock, labelKey: "enums:broadcastKind.reminder" },
  event_updated: { hue: "sky", icon: RefreshCw, labelKey: "enums:broadcastKind.event_updated" },
  event_cancelled: { hue: "bloom", icon: CalendarX, labelKey: "enums:broadcastKind.event_cancelled" },
  thank_you: { hue: "moss", icon: PartyPopper, labelKey: "enums:broadcastKind.thank_you" },
} satisfies Record<BroadcastKind, ChipKindEntry>

const channel = {
  inapp: { hue: "sky", icon: MessageSquare, labelKey: "enums:broadcastChannel.inapp", outline: true },
  push: { hue: "lilac", icon: Smartphone, labelKey: "enums:broadcastChannel.push", outline: true },
  email: { hue: "moss", icon: Mail, labelKey: "enums:broadcastChannel.email", outline: true },
  sms: { hue: "sun", icon: Smartphone, labelKey: "enums:broadcastChannel.sms", outline: true },
} satisfies Record<BroadcastChannel, ChipKindEntry>

const deliveryStatus = {
  pending: { hue: "neutral", icon: CircleDashed, labelKey: "enums:deliveryStatus.pending" },
  in_flight: { hue: "sky", icon: Send, labelKey: "enums:deliveryStatus.in_flight" },
  sent: { hue: "moss", icon: Check, labelKey: "enums:deliveryStatus.sent" },
  failed: { hue: "bloom", icon: TriangleAlert, labelKey: "enums:deliveryStatus.failed" },
  suppressed: { hue: "sun", icon: CirclePause, labelKey: "enums:deliveryStatus.suppressed" },
  skipped: { hue: "neutral", icon: CircleSlash, labelKey: "enums:deliveryStatus.skipped" },
} satisfies Record<DeliveryStatus, ChipKindEntry>





const exportStatus = {
  queued: { hue: "neutral", icon: CircleDashed, labelKey: "enums:hostExportStatus.queued" },
  running: { hue: "sky", icon: RefreshCw, labelKey: "enums:hostExportStatus.running" },
  ready: { hue: "moss", icon: CircleCheck, labelKey: "enums:hostExportStatus.ready" },
  failed: { hue: "bloom", icon: TriangleAlert, labelKey: "enums:hostExportStatus.failed" },
  expired: { hue: "neutral", icon: Clock, labelKey: "enums:hostExportStatus.expired" },
} satisfies Record<HostExportStatus, ChipKindEntry>

const orgKind = {
  nonprofit: { hue: "moss", icon: HandHeart, labelKey: "enums:orgVerificationKind.nonprofit" },
  government: { hue: "sky", icon: Building2, labelKey: "enums:orgVerificationKind.government" },
  community: { hue: "lilac", icon: Sparkles, labelKey: "enums:orgVerificationKind.community" },
} satisfies Record<"nonprofit" | "government" | "community", ChipKindEntry>

const attendance = {
  checked_in: { hue: "moss", icon: UserCheck, labelKey: "host-attendees:chip.checked_in" },
  not_checked_in: { hue: "neutral", icon: CircleDashed, labelKey: "host-attendees:chip.not_checked_in" },
  no_show: { hue: "bloom", icon: UserX, labelKey: "host-attendees:chip.no_show" },
} satisfies Record<"checked_in" | "not_checked_in" | "no_show", ChipKindEntry>

export const CHIP_KINDS = {
  "registration-status": registrationStatus,
  "seat-status": seatStatus,
  "checkin-method": checkinMethod,
  "waitlist-status": waitlistStatus,
  "ticket-visibility": ticketVisibility,
  "event-visibility": eventVisibility,
  "page-state": pageState,
  "registration-state": registrationState,
  "event-status": eventStatus,
  "team-role": teamRole,
  "org-role": orgRole,
  "org-verification": orgVerification,
  "org-kind": orgKind,
  "attendee-kind": attendeeKind,
  attendance,
  "broadcast-status": broadcastStatus,
  "broadcast-kind": broadcastKind,
  channel,
  "delivery-status": deliveryStatus,
  "export-status": exportStatus,
} as const

export type ChipKind = keyof typeof CHIP_KINDS
export type ChipValue<K extends ChipKind> = keyof (typeof CHIP_KINDS)[K] & string

export const UNKNOWN_CHIP_ENTRY: ChipKindEntry = {
  hue: "neutral",
  icon: CircleHelp,
  labelKey: "",
  outline: true,
}

export function chipEntry<K extends ChipKind>(kind: K, value: ChipValue<K>): ChipKindEntry {
  const family: Record<string, ChipKindEntry> = CHIP_KINDS[kind]
  return family[value] ?? UNKNOWN_CHIP_ENTRY
}
