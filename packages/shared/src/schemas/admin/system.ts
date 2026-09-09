import { z } from "zod"

/**
 * System health: per-service status for the HealthPage / MailSystem summary. Degrades gracefully
 * (report what is reachable; Phase 3 services like the VRP/Valhalla router are "not_deployed", the
 * legacy "Video transcoder" is renamed to the media worker). See enumeration 2.J + 4.10, endpoint #7.
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
