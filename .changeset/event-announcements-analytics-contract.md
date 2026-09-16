---
"@civfix/shared": minor
---

Event announcements and one consolidated event-analytics read, both additive.

Announcements ride the existing broadcast pipeline as `BroadcastKind` `announcement` (appended
last): `AnnouncementDTO`, `AnnouncementAudience` (a `BroadcastSegment` subset proved by
`announcementAudienceToSegment`) and three endpoints — `createEventAnnouncement`
(POST `/cleanups/:id/announcements`, auth required, csrf), `listEventAnnouncements` and
`getEventAnnouncement` (GET, auth optional, since an announcement is public event content whose
audience decides who is notified, not who may read). Delivery counts and the audience snapshot are
optional fields present only on the host projection.

New `getEventAnalytics` (`GET /cleanups/:id/analytics`, auth required, `scope=card|full`) answers
the dashboard card and the analytics page in one round trip, composing the existing `SeriesPoint`,
`Panel`, `SuppressedRate` and `FunnelStep` schemas and keeping `ANALYTICS_SUPPRESSION_K`. The five
per-panel `eventAnalytics*` endpoints are unchanged. Registry 319 → 323; see DECISIONS §48 and §49.
