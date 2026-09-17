---
"@civfix/shared": minor
---

Address system contract: street-level resolve endpoint, precision ladder, address provenance.

- New `resolveAddress` endpoint (`POST /map/resolve-address`, auth optional, csrf false, v1) with `ResolveAddressRequestSchema` (strict lat/lng) and `ResolveAddressResponseSchema` (`address`, `precision`, `cityStateLabel`). `reverseLabel` is unchanged. Registry 323 -> 324.
- New enums in `entities.ts`: `AddressPrecisionSchema` (`street | intersection | landmark | locality`), `EventAddressSourceSchema` (`resolved | edited | manual`), `ReportAddressSourceSchema` (`resolved | user`).
- `CleanupDTO.addressSource`, `CreateCleanupRequest.addressSource`, `UpdateCleanupRequest.addressSource` (all optional; `address` stays wire-optional for old clients).
- `ReportDTO.addrSource` and `ReportDTO.addrPrecision` (both optional).
- New `@civfix/shared/address` helpers: `ADDRESS_PRECISION_LADDER`, `isLocatedPrecision`, `needsNearPrefix`, `comparePrecision`, `isVerifiedEventAddress`, `isVerifiedReportAddress`, `roundGeocodeCoord`, `geocodePointKey`.
- Named length caps: `MAX_EVENT_ADDRESS_LENGTH` (200), `MAX_REPORT_ADDR_LENGTH` (300, now applied to the anon report request too).
