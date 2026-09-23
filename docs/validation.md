# Validation log

This document records end-to-end source checks that are useful as engineering baselines. It is not product content.

## London — July 2026

Validated on 2026-09-23 with the official `data.police.uk` custom crime download and the official July 2026 NPT boundary archive.

- Metropolitan street-crime rows: **101,644**
- Metropolitan NPT boundaries: **679**
- Rows assigned to an NPT: **101,512**
- Unmatched rows: **132 (0.13%)**
- Aggregate area/category cells produced: **7,843**
- End-to-end dry-run: **passed**
- Approximate GitHub Actions processing time from script start to result: **23 seconds**

Checks exercised:

- CSRF-protected custom download flow
- CSV contract validation
- monthly NPT boundary ZIP download
- KML parsing
- source ID/filename consistency
- multipolygon and inner-ring support
- spatial indexing and point-in-polygon assignment
- crime category mapping
- unmatched-point quality gate
- dry-run output without database writes

The monthly archive is intentionally paired with crime data from the same month so historical observations are not assigned using a modern boundary.
