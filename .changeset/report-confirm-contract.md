---
"@civfix/shared": minor
---

Me too on reports, named confirmations in the contract (DECISIONS §60). All additive: the registry goes from 336 to 339 entries, none of them admin.

- `ReportDTO` gains `confirmCount` (non-negative integer, default 0) and `confirmedByMe` (default false). `ReportPinDTO` gains `confirmCount` (default 0). An older server's response still parses.
- New endpoints: `confirmReport` (`POST /reports/:id/confirm`) and `unconfirmReport` (`DELETE /reports/:id/confirm`), both auth required with csrf, taking `ReportConfirmRequest` (`{ id }`) and returning `ReportConfirmResponse` (`{ confirmCount, confirmedByMe }`). `pressingReports` (`GET /reports/pressing`) is auth optional, takes `PressingReportsRequest` (`{ bbox }`) and returns `PressingReportsResponse` (`{ items: ReportPinDTO[] }`, at most 20).
- `PUBLIC_REPORT_STATUSES` (published, acknowledged, in_progress, resolved) and `OPEN_REPORT_STATUSES` (published, acknowledged, in_progress).
- The admin report list's `confirmations` is now documented as the report's Me too count. Its shape is unchanged.
