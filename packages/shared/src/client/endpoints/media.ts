import { def } from "./def.js"
import {
  CreateMediaUploadRequestSchema,
  CreateMediaUploadResponseSchema,
  FinalizeMediaRequestSchema,
  FinalizeMediaResponseSchema,
  GetMediaResponseSchema,
} from "../../schemas/media.js"

export const mediaEndpoints = {
  createMediaUpload: def({
    method: "POST",
    path: "/media/upload",
    request: CreateMediaUploadRequestSchema,
    response: CreateMediaUploadResponseSchema,
    auth: "optional",
    csrf: false,
    version: "v1",
  }),
  finalizeMedia: def({
    method: "POST",
    path: "/media/:uploadId/finalize",
    request: FinalizeMediaRequestSchema,
    response: FinalizeMediaResponseSchema,
    auth: "optional",
    csrf: false,
    version: "v1",
  }),
  getMedia: def({
    method: "GET",
    path: "/media/:id",
    request: null,
    response: GetMediaResponseSchema,
    auth: "optional",
    csrf: false,
    version: "v1",
  }),
} as const
