---
"@civfix/shared": minor
---

`PersonDTO` gains an optional, server-set `official: boolean`. The backend sets it on the one platform-owned account that admin-panel chat posts are authored as, and omits it for everyone else; no request carries it and no endpoint sets it. Because `UserProfileDTO`, `AttendeeDTO`, `ChatMessageDTO.from` and every post author embed `PersonDTO`, the flag reaches chat authors, profiles and people lists alike. Additive: an older server omits it and an older client strips it. See DECISIONS §56.
