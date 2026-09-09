import { handlePreview, type PreviewContextArg } from "../_preview"

export const onRequestGet = (context: PreviewContextArg) => handlePreview(context, "org")
