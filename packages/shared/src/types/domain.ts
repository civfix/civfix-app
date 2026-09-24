/** Short aliases so app code can import domain names instead of the XxxDTO names. */

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
