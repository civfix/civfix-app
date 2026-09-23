---
"@civfix/shared": patch
---

The `{photoLinks}` forward-template token's description now matches what the backend renders: one numbered line per photo or video (`- Photo 1: <link>`, `- Video 1: <link>`), or `(none)` when the report has no media. `FORWARD_TEMPLATE_SAMPLE_VALUES.photoLinks` stays a newline-separated URL list, since the backend builds its preview media from it.
