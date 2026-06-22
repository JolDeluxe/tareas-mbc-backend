import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES: z.string(),
  VAPID_SUBJECT: z.string(),
  VAPID_PUBLIC_KEY: z.string(),
  VAPID_PRIVATE_KEY: z.string(),
  CLOUDINARY_URL: z.string(),
  PORT: z.coerce.number().default(3000),
});

// Si falta algo en el .env, aquí te avisará
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Faltan variables en el .env:", parsed.error.flatten().fieldErrors);
  process.exit(1); 
}

export const envs = parsed.data;