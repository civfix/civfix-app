---
"@civfix/shared": minor
---

Organization affiliation, the event dashboard contract and org payouts; the verified community
organizer system is retired. Registry 337 -> 343 (107 admin). Removes `myVerification`,
`setUserVerified`, `schemas/verification.ts`, `PersonDTO.verified`, `LeaderboardEntryDTO.verified`,
`AdminUserDTO.verificationStatus` and the `verification` media purpose; adds
`PersonDTO.organization`, `UserDTO.primaryOrganizationId`, `PostComposeInput.organizationId`,
`PostDTO.organization`, `listOrganizationEvents`, `duplicateCleanup`, the org invite inbox
(`listMyOrgInvites` / `acceptMyOrgInvite` / `declineMyOrgInvite`), org balance and payouts
(`getOrgBalance` / `createOrgPayout` / `listOrgPayouts` plus the `Payments` seam methods),
`AdminUserDTO.organizations` and `manage_team` for `ORG_ADMIN`. See DECISIONS §34.
