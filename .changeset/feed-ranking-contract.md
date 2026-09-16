---
"@civfix/shared": minor
---

Feed ranking contract: scored cursor, counts endpoint, realtime topics, `FEED_RANKING` schema

`GET /feed/home` keeps its method, path, query and response schemas; its `nextCursor` may now be a
ranked `"<score>|<postId>"` cursor alongside the legacy `"<iso>|<postId>"` one, and the contract
owns the codec (`FeedScoreCursorSchema`, `formatFeedScoreCursor`, `parseFeedScoreCursor`,
`quantizeFeedScore`, `isAfterFeedScoreCursor`, `FEED_SCORE_CURSOR_PRECISION`) so both forms stay
unambiguous and the continuation predicate has one definition.

New `getFeedCounts` (`POST /feed/counts`, auth required, no CSRF) takes up to
`FEED_COUNTS_MAX_IDS` post ids and returns counts only, with unreadable ids simply absent —
registry 318 → 319. `SignalTopicSchema` gains `feed` and `feed_counts` with `UserSignalSchema`
unchanged, so a stale client drops the new frames instead of failing. `FeedRankingConfigSchema` /
`FeedRankingConfig` / `DEFAULT_FEED_RANKING` add the strict, fully defaulted 27-knob ranking
profile that the backend loads from a JSON `FEED_RANKING` env var. All additive; see DECISIONS §47.
