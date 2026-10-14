---
"@civfix/shared": minor
---

Adds `MAX_VIDEO_SECONDS` (10) and `MAX_VIDEO_LONG_EDGE` (1920), the video length and long edge the media worker accepts, next to `MAX_VIDEO_BYTES`. The web app checks a picked video against them before uploading, and the mobile camera caps recording at `MAX_VIDEO_SECONDS`.

Adds `ReportDTO.mediaRejected`, the number of the report's media the media worker or a moderator refused. The server fills it only for the reporter; it is 0 for everyone else and never counts media held for moderation. Additive: it defaults to 0, so payloads from servers that don't send it still parse.
