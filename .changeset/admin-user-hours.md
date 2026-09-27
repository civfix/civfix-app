---
"@civfix/shared": minor
---

Operator volunteer-hours corrections on the admin users surface: `getUserHours` (`GET /admin/users/:id/hours`, the user's whole ledger with voided rows and totals), `creditUserHours` (`POST /admin/users/:id/hours`, a strict union on `kind` — an `event` credit for a real event or a `manual` adjustment with a `serviceDate`) and `voidUserHours` (`POST /admin/users/:id/hours/:entryId/void`, which returns the live certificates that still list the entry), in a new `adminUserHoursEndpoints` registry group (333 → 336 endpoints). `AdminReasonSchema` is now exported from the admin common schemas and shared with the org writes. `EventHoursResponse.entries[].creditedByOfficial` is a new optional boolean. Additive. See DECISIONS §58.
