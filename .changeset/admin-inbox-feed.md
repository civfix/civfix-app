---
"@civfix/shared": minor
---

Admin inbox feed and reply publication. A fifth registry group, `adminInboxEndpoints`, adds `listInboxFeed` (`GET /admin/inbox/feed`, one keyset-paged feed of catch-all inbound email and threaded city replies, filtered by `InboxFeedFilter`) and `publishMailReply` (`POST /admin/mail/:id/messages/:messageId/publish`, csrf), so the registry is 333 entries with 106 under `/admin`. New `MailAuthVerdict` (`pass` / `fail` / `unknown`) and `MailReplyPublication` (`withheld` / `pending` / `published`) enums with label maps; optional `authVerdict` on `InboundEmailListItemDTO` / `InboundEmailDTO` and optional `authVerdict` + `publication` on `MailMessageDTO`, so an older server still validates. See DECISIONS §57.
