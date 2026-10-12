---
"@civfix/shared": minor
---

Adds `MAX_VIDEO_SECONDS` (10) and `MAX_VIDEO_LONG_EDGE` (1920), the video length and long edge the media worker accepts, next to `MAX_VIDEO_BYTES`. The web app checks a picked video against them before uploading, and the mobile camera caps recording at `MAX_VIDEO_SECONDS`. Additive: no schema changes.
