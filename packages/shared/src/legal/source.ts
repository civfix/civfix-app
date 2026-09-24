export const SOURCE_REPO_URL = "https://github.com/civfix/civfix-app"

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i

export interface SourceLink {
  commit: string
  url: string
}

/**
 * AGPL section 13 link to the deployed source. Anything that is not a commit sha (a branch name, an
 * injected path) links the repository root, so a bad build value cannot forge the link.
 */
export function sourceLink(rawCommit: string | null | undefined): SourceLink {
  const commit = rawCommit && COMMIT_SHA.test(rawCommit) ? rawCommit.toLowerCase() : ""
  return { commit, url: commit ? `${SOURCE_REPO_URL}/tree/${commit}` : SOURCE_REPO_URL }
}
