---
"@civfix/shared": minor
---

`getEventInsights` (`GET /cleanups/:id/insights`): one per-event host read with exact seat counts, a
registration trend, per-ticket-type and per-source seats, the broadcast log, arrival offsets, credited
hours, donations and returning volunteers, plus `EventPhaseSchema` and `eventPhase()` in
`@civfix/shared/host` as the one phase vocabulary (DECISIONS §36). Portfolio analytics report exact
values for roster-capable viewers; the response shape is unchanged. `money.netMinor` is a signed
integer so a fully refunded event can report the processor fee it kept.
