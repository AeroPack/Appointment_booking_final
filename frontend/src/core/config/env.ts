import { z } from 'zod'

const envSchema = z.object({
  VITE_API_URL: z.string().default('/api'),
  VITE_APP_NAME: z.string().default('Appointment Booking'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  )
}

export const env = parsed.data
  