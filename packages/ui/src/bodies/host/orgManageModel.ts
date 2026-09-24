import type {
  OrganizationDTO,
  OrganizationMemberDTO,
  SocialLinks,
  SocialPlatform,
  UpdateOrganizationRequest,
} from "@civfix/shared"
import {
  ErrorCode,
  SOCIAL_HANDLE_MAX_LENGTH,
  SOCIAL_PLATFORMS,
  SafeHttpsLinkSchema,
  SocialLinksSchema,
  UpdateOrganizationRequestSchema,
  WHATSAPP_NUMBER_MAX_LENGTH,
  byErrorCode,
  type ErrorCodeTable,
} from "@civfix/shared"

const ORG_COUNTER_AT = 0.9

// UpdateOrganizationRequestSchema requires a uuid id; profile validation only reads the name and
// description issues, so any well-formed id stands in.
const VALIDATION_PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000"

export interface OrgProfileDraft {
  name: string
  description: string
  logoMediaId: string | null
}

export interface OrgLinksDraft {
  websiteUrl: string
  donationUrl: string
  facebook: string
  instagram: string
  tiktok: string
  x: string
  whatsapp: string
}

export function profileDraftFrom(org: OrganizationDTO | null | undefined): OrgProfileDraft {
  return {
    name: org?.name ?? "",
    description: org?.description ?? "",
    logoMediaId: org?.logoMediaId ?? null,
  }
}

export function linksDraftFrom(org: OrganizationDTO | null | undefined): OrgLinksDraft {
  const links = org?.socialLinks ?? {}
  return {
    websiteUrl: org?.websiteUrl ?? "",
    donationUrl: org?.donationUrl ?? "",
    facebook: links.facebook ?? "",
    instagram: links.instagram ?? "",
    tiktok: links.tiktok ?? "",
    x: links.x ?? "",
    whatsapp: links.whatsapp ?? "",
  }
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export function socialLinksFromDraft(draft: OrgLinksDraft): SocialLinks | null {
  const out: SocialLinks = {}
  let any = false
  for (const platform of SOCIAL_PLATFORMS) {
    const value = draft[platform].trim().replace(/^@/, "")
    if (value === "") continue
    out[platform] = value
    any = true
  }
  return any ? out : null
}

export function profilePayload(id: string, draft: OrgProfileDraft): UpdateOrganizationRequest {
  return {
    id,
    name: draft.name.trim(),
    description: trimmedOrNull(draft.description),
    logoMediaId: draft.logoMediaId,
  }
}

export function linksPayload(id: string, draft: OrgLinksDraft): UpdateOrganizationRequest {
  return {
    id,
    websiteUrl: trimmedOrNull(draft.websiteUrl),
    donationUrl: trimmedOrNull(draft.donationUrl),
    socialLinks: socialLinksFromDraft(draft),
  }
}

export function profileDirty(draft: OrgProfileDraft, initial: OrgProfileDraft): boolean {
  return (
    draft.name !== initial.name ||
    draft.description !== initial.description ||
    draft.logoMediaId !== initial.logoMediaId
  )
}

export function linksDirty(draft: OrgLinksDraft, initial: OrgLinksDraft): boolean {
  return (Object.keys(initial) as Array<keyof OrgLinksDraft>).some(
    (field) => draft[field] !== initial[field],
  )
}

export function profileErrors(draft: OrgProfileDraft): Record<string, string> {
  const parsed = UpdateOrganizationRequestSchema.safeParse({
    ...profilePayload(VALIDATION_PLACEHOLDER_ID, draft),
  })
  const out: Record<string, string> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".")
      if (key === "name" || key === "description") out[key] ||= `manage.error_${key}`
    }
  }
  if (draft.name.trim().length === 0) out.name = "manage.error_name"
  return out
}

export function linksErrors(draft: OrgLinksDraft): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of ["websiteUrl", "donationUrl"] as const) {
    const value = trimmedOrNull(draft[field])
    if (value !== null && !SafeHttpsLinkSchema.safeParse(value).success) {
      out[field] = "manage.error_https"
    }
  }
  for (const platform of SOCIAL_PLATFORMS) {
    const value = draft[platform].trim().replace(/^@/, "")
    if (value === "") continue
    const parsed = SocialLinksSchema.safeParse({ [platform]: value })
    if (!parsed.success) {
      out[`socialLinks.${platform}`] =
        platform === "whatsapp" ? "manage.error_whatsapp" : "manage.error_handle"
    }
  }
  return out
}

export function socialHandleMax(platform: SocialPlatform): number {
  return platform === "whatsapp" ? WHATSAPP_NUMBER_MAX_LENGTH : SOCIAL_HANDLE_MAX_LENGTH
}

export function counterVisible(length: number, max: number): boolean {
  return length >= Math.floor(max * ORG_COUNTER_AT)
}

export function canOpenOrgManage(org: OrganizationDTO | null | undefined): boolean {
  return org?.myRole === "owner" || org?.myRole === "admin"
}

export function lastAdminSeat(members: readonly OrganizationMemberDTO[]): boolean {
  return members.filter((member) => member.role !== "member").length <= 1
}

const ORG_LAST_ADMIN_FIELD = "userId"

const ORG_LAST_ADMIN_REASON = "ORG_LAST_ADMIN"

const ORG_MANAGE_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.FORBIDDEN]: "manage.error_forbidden",
  [ErrorCode.VALIDATION]: "manage.error_validation",
  [ErrorCode.RATE_LIMITED]: "manage.error_rate_limited",
}

// The server refuses to empty the last admin seat as VALIDATION with the reason on `userId`; CONFLICT
// means other things, such as a taken handle.
export function orgManageErrorKey(
  code: string | undefined,
  fields?: Record<string, string>,
): string {
  if (code === ErrorCode.VALIDATION && fields?.[ORG_LAST_ADMIN_FIELD] === ORG_LAST_ADMIN_REASON) {
    return "manage.error_last_admin"
  }
  return byErrorCode(code, ORG_MANAGE_ERROR_KEYS, "manage.error_generic")
}

const ORG_LOGO_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.MEDIA_REJECTED]: "manage.logo_rejected",
  [ErrorCode.RATE_LIMITED]: "manage.error_rate_limited",
}

export function orgLogoErrorKey(code: string | undefined): string {
  return byErrorCode(code, ORG_LOGO_ERROR_KEYS, "manage.logo_error")
}
