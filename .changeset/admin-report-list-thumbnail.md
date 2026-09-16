---
"@civfix/shared": minor
---

Admin report list rows carry a presigned `thumbnailUrl`

`AdminReportListItemDTO` gains `thumbnailUrl`: a presigned preview of the report's first ready image asset (the pipeline thumbnail when one exists, else the served image), so the admin reports list can render the report's own photo instead of the category pin. Nullable and defaulted to `null`, so a report with no usable image and a response from a server that does not yet send the field both parse unchanged.
