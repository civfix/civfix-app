import { sourceLink, type SourceLink } from "@civfix/ui/helpers"

export const SOURCE: SourceLink = sourceLink(process.env.NEXT_PUBLIC_COMMIT_SHA)
