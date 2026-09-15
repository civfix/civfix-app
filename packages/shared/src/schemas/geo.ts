import { z } from "zod"

export const GetApproximateLocationRequestSchema = z.object({}).strict()
export type GetApproximateLocationRequest = z.infer<typeof GetApproximateLocationRequestSchema>

export const ApproximateLocationSourceSchema = z.enum(["ip", "region"])
export type ApproximateLocationSource = z.infer<typeof ApproximateLocationSourceSchema>

export const GetApproximateLocationResponseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().positive(),
  source: ApproximateLocationSourceSchema,
})
export type GetApproximateLocationResponse = z.infer<typeof GetApproximateLocationResponseSchema>
