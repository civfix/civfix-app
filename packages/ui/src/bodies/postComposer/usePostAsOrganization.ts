import { useEffect } from "react"
import { actableOrganizations, useMyOrganizations } from "../../data"
import { authorAsSelection } from "../AuthorAsChips"
import type { PostComposerDraft } from "../postComposerStore"

/** Posting as an organization is offered only for the ones the viewer can still act for. */
export function usePostAsOrganization(
  draft: Pick<PostComposerDraft, "organizationId">,
  setOrganizationId: (organizationId: string | null) => void,
) {
  const myOrgs = useMyOrganizations()
  const actableOrgs = actableOrganizations(myOrgs.data)
  const postAsOrganizations = actableOrgs ?? []
  const postAsOrganizationId = authorAsSelection(draft.organizationId, actableOrgs)
  useEffect(() => {
    if (draft.organizationId !== null && postAsOrganizationId === null) setOrganizationId(null)
  }, [draft.organizationId, postAsOrganizationId, setOrganizationId])
  const postAsOrganization =
    postAsOrganizations.find((org) => org.id === postAsOrganizationId) ?? null
  return { postAsOrganizations, postAsOrganizationId, postAsOrganization }
}
