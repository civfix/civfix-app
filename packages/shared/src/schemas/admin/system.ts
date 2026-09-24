import { z } from "zod"

/**
 * System health: per-service status. Degrades gracefully: it reports what is reachable, and a service
 * that is not running in this deployment reads "not_deployed".
 */

/** A single service health row. `val` is a short metric string (e.g. "p95 142ms", "CPU 38%"). */
export const SystemServiceSchema = z
  .object({
    name: z.string(),
    status: z.enum(["ok", "warn", "down", "not_deployed"]),
    val: z.string(),
  })
  .strict()
export type SystemService = z.infer<typeof SystemServiceSchema>

export const SystemHealthResponseSchema = z
  .object({
    services: z.array(SystemServiceSchema),
  })
  .strict()
export type SystemHealthResponse = z.infer<typeof SystemHealthResponseSchema>
