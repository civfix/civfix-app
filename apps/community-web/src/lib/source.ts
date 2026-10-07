import { sourceLink, type SourceLink } from "@civfix/shared/legal"

export const SOURCE: SourceLink = sourceLink(process.env.NEXT_PUBLIC_COMMIT_SHA)
