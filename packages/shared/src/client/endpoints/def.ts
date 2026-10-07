import type { z } from "zod"
import type { EndpointVersion } from "../versioning.js"

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
export type EndpointAuth = "public" | "optional" | "required"

export interface EndpointDef<
  Req extends z.ZodTypeAny | null = z.ZodTypeAny | null,
  Res extends z.ZodTypeAny = z.ZodTypeAny,
  Path extends string = string,
> {
  method: HttpMethod
  path: Path
  request: Req
  response: Res
  auth: EndpointAuth
  csrf: boolean
  version: EndpointVersion
}

export function def<Req extends z.ZodTypeAny | null, Res extends z.ZodTypeAny, Path extends string>(
  d: EndpointDef<Req, Res, Path>,
): EndpointDef<Req, Res, Path> {
  return d
}
