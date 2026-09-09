/**
 * Clean domain type aliases. App code imports these names instead of the verbose XxxDTO names.
 * These are pure type re-exports of the inferred Zod entity types.
 */

import type { ReportDTO } from "../schemas/entities.js"
import type { CleanupDTO } from "../schemas/entities.js"
import type { PersonDTO } from "../schemas/entities.js"
import type { ChatMessageDTO } from "../schemas/entities.js"
import type { MediaDTO } from "../schemas/entities.js"
import type { MessageThreadDTO } from "../schemas/chat.js"
import type { UserProfileDTO } from "../schemas/social.js"
import type { NotificationDTO } from "../schemas/notifications.js"
import type { JurisdictionDTO } from "../schemas/map.js"

export type Report = ReportDTO
export type Cleanup = CleanupDTO
export type Person = PersonDTO
export type MessageThread = MessageThreadDTO
export type ChatMessage = ChatMessageDTO
export type UserProfile = UserProfileDTO
export type Notification = NotificationDTO
export type Jurisdiction = JurisdictionDTO
export type MediaAsset = MediaDTO
