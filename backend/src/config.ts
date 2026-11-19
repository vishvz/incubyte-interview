import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  AUTH_PASSWORD: z.string().min(12),
  AUTH_SECRET: z.string().min(16),
  // Proxy hops in front of the app (Render: 3). 0 when the app is reached directly.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
